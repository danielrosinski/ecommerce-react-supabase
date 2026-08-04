import {
  getSupabaseAdmin,
  pagBankRequest,
  readRequestBody,
  sendApiError,
} from "../../server/integrations.js";

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Método não permitido." });
  }

  try {
    const accessToken = request.headers.authorization?.replace(/^Bearer\s+/i, "");
    const { orderNumber } = readRequestBody(request);
    if (!accessToken || !orderNumber) {
      return response.status(401).json({ error: "Autenticação administrativa necessária." });
    }

    const supabase = getSupabaseAdmin();
    const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);
    if (userError || !userData?.user) {
      return response.status(401).json({ error: "Sessão administrativa inválida." });
    }

    const { data: admin } = await supabase
      .from("admin_users")
      .select("user_id")
      .eq("user_id", userData.user.id)
      .maybeSingle();
    if (!admin) return response.status(403).json({ error: "Acesso administrativo negado." });

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id,status,payment_status,payment_checkout_id")
      .eq("order_number", orderNumber)
      .maybeSingle();
    if (orderError) throw orderError;
    if (!order) return response.status(404).json({ error: "Pedido não encontrado." });
    if (order.payment_status === "approved") {
      return response.status(409).json({
        error: "O pagamento já foi aprovado. Faça o reembolso no PagBank antes de cancelar o pedido.",
      });
    }

    if (order.payment_checkout_id) {
      await pagBankRequest(`/checkouts/${encodeURIComponent(order.payment_checkout_id)}/inactivate`, {
        method: "POST",
      });
    }

    const { error: updateError } = await supabase
      .from("orders")
      .update({ status: "cancelled", payment_status: "refused", payment_updated_at: new Date().toISOString() })
      .eq("id", order.id);
    if (updateError) throw updateError;

    return response.status(200).json({ cancelled: true });
  } catch (error) {
    return sendApiError(response, error, "Não foi possível cancelar o checkout do PagBank.");
  }
}

