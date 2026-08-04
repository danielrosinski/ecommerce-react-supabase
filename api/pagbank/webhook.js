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
  REFUNDED: "refunded",
};

function selectCharge(charges = []) {
  return charges.find((charge) => charge.status === "PAID") || charges.at(-1) || null;
}

function mapChargeStatus(charge) {
  if (!charge) return null;
  if (charge.status === "CANCELED") {
    return Number(charge.amount?.summary?.refunded || 0) > 0 ? "refunded" : "refused";
  }
  return statusMap[charge.status] || null;
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
    let paymentChargeId = null;
    let providerStatus = null;
    let paidAmount = null;
    let paidAt = null;

    if (resourceId.startsWith("CHEC_")) {
      verified = await pagBankRequest(`/checkouts/${encodeURIComponent(resourceId)}`);
      referenceId = verified?.reference_id;
      providerStatus = verified?.status === "EXPIRED" ? "expired" : null;
    } else if (resourceId.startsWith("ORDE_")) {
      verified = await pagBankRequest(`/orders/${encodeURIComponent(resourceId)}`);
      const charge = selectCharge(verified?.charges);
      referenceId = verified?.reference_id;
      providerOrderId = verified?.id;
      paymentChargeId = charge?.id || null;
      providerStatus = mapChargeStatus(charge);
      paidAmount = charge?.amount?.value ?? null;
      paidAt = charge?.paid_at || null;
    } else {
      verified = await pagBankRequest(`/charges/${encodeURIComponent(resourceId)}`);
      referenceId = verified?.reference_id;
      paymentChargeId = verified?.id || resourceId;
      providerStatus = mapChargeStatus(verified);
      paidAmount = verified?.amount?.value ?? null;
      paidAt = verified?.paid_at || null;
    }

    if (!referenceId || !providerStatus) {
      return response.status(200).json({ received: true, changed: false });
    }

    const supabase = getSupabaseAdmin();
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id,total,status,payment_status,payment_provider_order_id,payment_charge_id,reservation_expires_at")
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

    if (
      order.payment_status === "approved" &&
      providerStatus !== "refunded" &&
      !providerOrderId &&
      !paymentChargeId
    ) {
      return response.status(200).json({ received: true, changed: false });
    }

    const effectivePaymentStatus = order.payment_status === "refunded"
      ? "refunded"
      : order.payment_status === "approved" && providerStatus !== "refunded"
        ? "approved"
        : providerStatus;

    const update = {
      payment_status: effectivePaymentStatus,
      payment_updated_at: new Date().toISOString(),
    };
    if (providerOrderId) update.payment_provider_order_id = providerOrderId;
    if (paymentChargeId) update.payment_charge_id = paymentChargeId;

    const paidAfterReservation = providerStatus === "approved" &&
      paidAt &&
      order.reservation_expires_at &&
      new Date(paidAt).getTime() > new Date(order.reservation_expires_at).getTime();

    if (
      providerStatus === "expired" &&
      !["approved", "refunded"].includes(order.payment_status) &&
      !["cancelled", "expired", "completed", "payment_review"].includes(order.status)
    ) {
      update.status = "expired";
    } else if (
      providerStatus === "refunded" &&
      !["cancelled", "expired", "completed"].includes(order.status)
    ) {
      update.status = "cancelled";
    } else if (
      providerStatus === "approved" &&
      (["cancelled", "expired"].includes(order.status) || paidAfterReservation)
    ) {
      // Situação rara: a confirmação chegou depois que a reserva foi liberada.
      // O painel deve revisar e reembolsar, sem comprometer estoque já devolvido.
      update.status = "payment_review";
    }

    const { error: updateError } = await supabase
      .from("orders")
      .update(update)
      .eq("id", order.id);

    if (updateError) throw updateError;
    return response.status(200).json({ received: true, changed: true });
  } catch (error) {
    return sendApiError(response, error, "Não foi possível validar a notificação do PagBank.");
  }
}
