import { randomUUID } from "node:crypto";
import {
  pagBankRequest,
  readRequestBody,
  requireAdmin,
  sendApiError,
  toCents,
} from "../../server/integrations.js";

function paidCharge(charges = []) {
  return charges.find((charge) => charge.status === "PAID") || null;
}

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
      .select(`
        id, order_number, status, total, payment_provider, payment_status,
        payment_provider_order_id, payment_charge_id
      `)
      .eq("order_number", String(orderNumber).trim())
      .maybeSingle();

    if (orderError) throw orderError;
    if (!order) return response.status(404).json({ error: "Pedido não encontrado." });
    if (order.payment_provider !== "pagbank") {
      return response.status(409).json({ error: "Este pedido não possui pagamento PagBank." });
    }
    if (order.payment_status === "refunded") {
      return response.status(200).json({ refunded: true, reused: true });
    }
    if (order.payment_status !== "approved") {
      return response.status(409).json({ error: "Somente pagamentos aprovados podem ser reembolsados." });
    }
    if (order.status === "completed") {
      return response.status(409).json({
        error: "Pedidos finalizados exigem conferência manual antes do reembolso.",
      });
    }

    let chargeId = order.payment_charge_id;
    if (!chargeId && order.payment_provider_order_id) {
      const providerOrder = await pagBankRequest(
        `/orders/${encodeURIComponent(order.payment_provider_order_id)}`,
      );
      chargeId = paidCharge(providerOrder?.charges)?.id;
    }

    if (!chargeId) {
      return response.status(409).json({
        error: "A cobrança ainda não foi conciliada. Atualize os pedidos em alguns instantes.",
      });
    }

    await pagBankRequest(`/charges/${encodeURIComponent(chargeId)}/cancel`, {
      method: "POST",
      headers: { "x-idempotency-key": randomUUID() },
      body: JSON.stringify({ amount: { value: toCents(order.total) } }),
    });

    const { error: updateError } = await supabase
      .from("orders")
      .update({
        status: "cancelled",
        payment_status: "refunded",
        payment_charge_id: chargeId,
        payment_updated_at: new Date().toISOString(),
      })
      .eq("id", order.id);

    if (updateError) throw updateError;
    return response.status(200).json({ refunded: true });
  } catch (error) {
    return sendApiError(response, error, "Não foi possível reembolsar o pagamento.");
  }
}
