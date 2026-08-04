import {
  getSupabaseAdmin,
  pagBankRequest,
  readRequestBody,
  sendApiError,
  toCents,
} from "../../server/integrations.js";

const statusMap = {
  PAID: "approved",
  IN_ANALYSIS: "pending",
  WAITING: "pending",
  DECLINED: "refused",
  CANCELED: "refused",
  REFUNDED: "refunded",
};

function selectCharge(charges = []) {
  return charges.find((charge) => charge.status === "PAID") || charges.at(-1) || null;
}

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Método não permitido." });
  }

  try {
    const notification = readRequestBody(request);
    const resourceId = String(notification?.id || "");
    if (!/^(ORDE|CHEC|CHAR)_/i.test(resourceId)) {
      return response.status(400).json({ error: "Notificação inválida." });
    }

    let verified;
    let referenceId;
    let providerOrderId = null;
    let providerStatus = null;
    let paidAmount = null;

    if (resourceId.startsWith("CHEC_")) {
      verified = await pagBankRequest(`/checkouts/${encodeURIComponent(resourceId)}`);
      referenceId = verified?.reference_id;
      providerStatus = verified?.status === "EXPIRED" ? "refused" : null;
    } else if (resourceId.startsWith("ORDE_")) {
      verified = await pagBankRequest(`/orders/${encodeURIComponent(resourceId)}`);
      const charge = selectCharge(verified?.charges);
      referenceId = verified?.reference_id;
      providerOrderId = verified?.id;
      providerStatus = statusMap[charge?.status] || null;
      paidAmount = charge?.amount?.value ?? null;
    } else {
      verified = await pagBankRequest(`/charges/${encodeURIComponent(resourceId)}`);
      referenceId = verified?.reference_id;
      providerStatus = statusMap[verified?.status] || null;
      paidAmount = verified?.amount?.value ?? null;
    }

    if (!referenceId || !providerStatus) {
      return response.status(200).json({ received: true, changed: false });
    }

    const supabase = getSupabaseAdmin();
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id,total,payment_status")
      .eq("order_number", referenceId)
      .maybeSingle();

    if (orderError) throw orderError;
    if (!order) return response.status(200).json({ received: true, changed: false });

    if (
      providerStatus === "approved" &&
      paidAmount != null &&
      Number(paidAmount) !== toCents(order.total)
    ) {
      const amountError = new Error("O valor confirmado pelo PagBank não corresponde ao pedido.");
      amountError.statusCode = 409;
      throw amountError;
    }

    if (order.payment_status === "approved" && providerStatus !== "refunded") {
      return response.status(200).json({ received: true, changed: false });
    }

    const { error: updateError } = await supabase
      .from("orders")
      .update({
        payment_status: providerStatus,
        payment_provider_order_id: providerOrderId,
        payment_updated_at: new Date().toISOString(),
      })
      .eq("id", order.id);

    if (updateError) throw updateError;
    return response.status(200).json({ received: true, changed: true });
  } catch (error) {
    return sendApiError(response, error, "Não foi possível validar a notificação do PagBank.");
  }
}

