import { randomUUID } from "node:crypto";
import {
  getPublicSiteUrl,
  getSupabaseAdmin,
  pagBankRequest,
  readRequestBody,
  sendApiError,
  toCents,
} from "../../server/integrations.js";

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Método não permitido." });
  }

  try {
    const { orderNumber, email } = readRequestBody(request);
    if (!orderNumber || !email) {
      return response.status(400).json({ error: "Pedido e e-mail são obrigatórios." });
    }

    const supabase = getSupabaseAdmin();
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select(`
        id, order_number, customer_email, subtotal, discount, shipping, total,
        status, payment_status, payment_checkout_id, payment_checkout_url,
        reservation_expires_at,
        order_items (id, product_name, unit_price, quantity, line_total)
      `)
      .eq("order_number", String(orderNumber).trim())
      .maybeSingle();

    if (orderError) throw orderError;
    if (!order || order.customer_email.toLowerCase() !== String(email).trim().toLowerCase()) {
      return response.status(404).json({ error: "Pedido não encontrado." });
    }
    if (["cancelled", "expired", "completed", "payment_review"].includes(order.status)) {
      return response.status(409).json({ error: "Este pedido não aceita novos pagamentos." });
    }
    if (order.payment_status === "approved") {
      return response.status(200).json({ approved: true, orderNumber: order.order_number });
    }
    const reservationExpired = order.reservation_expires_at &&
      new Date(order.reservation_expires_at).getTime() <= Date.now();

    if (reservationExpired) {
      await supabase
        .from("orders")
        .update({
          status: "expired",
          payment_status: "expired",
          payment_updated_at: new Date().toISOString(),
        })
        .eq("id", order.id);
      return response.status(409).json({
        error: "A reserva deste pedido expirou. Volte à loja e faça um novo pedido.",
      });
    }

    if (order.payment_checkout_url) {
      return response.status(200).json({
        checkoutId: order.payment_checkout_id,
        checkoutUrl: order.payment_checkout_url,
        reservationExpiresAt: order.reservation_expires_at,
        reused: true,
      });
    }
    if (!order.order_items?.length) {
      return response.status(409).json({ error: "Este pedido não possui itens para pagamento." });
    }

    const reservationExpiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    const { error: pendingError } = await supabase
      .from("orders")
      .update({
        payment_method: "pagbank_checkout",
        payment_provider: "pagbank",
        payment_status: "pending",
        reservation_expires_at: reservationExpiresAt,
        payment_updated_at: new Date().toISOString(),
      })
      .eq("id", order.id);
    if (pendingError) throw pendingError;

    const siteUrl = getPublicSiteUrl();
    const webhookUrl = `${siteUrl}/api/pagbank/webhook`;
    const returnUrl = `${siteUrl}/pedido?pagamento=retorno&pedido=${encodeURIComponent(order.order_number)}`;
    const checkout = await pagBankRequest("/checkouts", {
      method: "POST",
      headers: { "x-idempotency-key": randomUUID() },
      body: JSON.stringify({
        reference_id: order.order_number,
        expiration_date: reservationExpiresAt,
        items: order.order_items.map((item) => ({
          reference_id: String(item.id),
          name: String(item.product_name).slice(0, 100),
          quantity: Number(item.quantity),
          unit_amount: toCents(item.unit_price),
        })),
        additional_amount: toCents(order.shipping),
        discount_amount: toCents(order.discount),
        payment_methods: [{ type: "PIX" }, { type: "CREDIT_CARD" }],
        payment_methods_configs: [{
          type: "CREDIT_CARD",
          config_options: [{ option: "INSTALLMENTS_LIMIT", value: "6" }],
        }],
        soft_descriptor: "ROSINSKI",
        redirect_url: returnUrl,
        return_url: returnUrl,
        redirect_waiting_time: 5,
        notification_urls: [webhookUrl],
        payment_notification_urls: [webhookUrl],
      }),
    });

    const checkoutUrl = checkout?.links?.find((link) => link.rel === "PAY")?.href;
    if (!checkout?.id || !checkoutUrl) {
      throw new Error("O PagBank não devolveu o link seguro de pagamento.");
    }

    const { error: updateError } = await supabase
      .from("orders")
      .update({
        payment_method: "pagbank_checkout",
        payment_provider: "pagbank",
        payment_status: "pending",
        payment_checkout_id: checkout.id,
        payment_checkout_url: checkoutUrl,
        reservation_expires_at: checkout.expiration_date || reservationExpiresAt,
        payment_updated_at: new Date().toISOString(),
      })
      .eq("id", order.id);

    if (updateError) throw updateError;
    return response.status(200).json({
      checkoutId: checkout.id,
      checkoutUrl,
      reservationExpiresAt: checkout.expiration_date || reservationExpiresAt,
    });
  } catch (error) {
    return sendApiError(response, error, "Não foi possível criar o pagamento seguro.");
  }
}
