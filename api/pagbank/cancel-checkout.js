import {
  pagBankRequest,
  readRequestBody,
  requireAdmin,
  sendApiError,
} from "../../server/integrations.js";

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Método não permitido." });
  }

  try {
    const { orderNumber } = readRequestBody(request);
    if (!orderNumber) {
      return response.status(400).json({ error: "O número do pedido é obrigatório." });
    }

    const { supabase } = await requireAdmin(request);

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id,status,payment_status,payment_checkout_id")
      .eq("order_number", orderNumber)
      .maybeSingle();
    if (orderError) throw orderError;
    if (!order) return response.status(404).json({ error: "Pedido não encontrado." });
    if (["cancelled", "expired"].includes(order.status)) {
      return response.status(200).json({ cancelled: true, reused: true });
    }
    if (order.payment_status === "approved") {
      return response.status(409).json({
        error: "O pagamento já foi aprovado. Use a opção Reembolsar e cancelar.",
      });
    }

    if (order.payment_checkout_id) {
      await pagBankRequest(`/checkouts/${encodeURIComponent(order.payment_checkout_id)}/inactivate`, {
        method: "POST",
      });
    }

    const { error: updateError } = await supabase
      .from("orders")
      .update({
        status: "cancelled",
        payment_status: order.payment_status === "refunded" ? "refunded" : "refused",
        payment_updated_at: new Date().toISOString(),
      })
      .eq("id", order.id);
    if (updateError) throw updateError;

    return response.status(200).json({ cancelled: true });
  } catch (error) {
    return sendApiError(response, error, "Não foi possível cancelar o checkout do PagBank.");
  }
}
