import { createClient } from "@supabase/supabase-js";

export function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("As credenciais privadas do Supabase não foram configuradas.");
  }

  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function requireAdmin(request) {
  const accessToken = request.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!accessToken) {
    const error = new Error("Autenticação administrativa necessária.");
    error.statusCode = 401;
    error.publicMessage = error.message;
    throw error;
  }

  const supabase = getSupabaseAdmin();
  const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);
  if (userError || !userData?.user) {
    const error = new Error("Sessão administrativa inválida.");
    error.statusCode = 401;
    error.publicMessage = error.message;
    throw error;
  }

  const { data: admin, error: adminError } = await supabase
    .from("admin_users")
    .select("user_id")
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (adminError) throw adminError;
  if (!admin) {
    const error = new Error("Acesso administrativo negado.");
    error.statusCode = 403;
    error.publicMessage = error.message;
    throw error;
  }

  return { supabase, user: userData.user };
}

export function getPagBankConfig() {
  const token = process.env.PAGBANK_TOKEN;
  const apiUrl = (process.env.PAGBANK_API_URL || "https://sandbox.api.pagseguro.com")
    .replace(/\/$/, "");

  if (!token) {
    throw new Error("O token privado do PagBank não foi configurado.");
  }

  return { token, apiUrl };
}

export function getPublicSiteUrl() {
  return (process.env.PUBLIC_SITE_URL || "https://ecommerce-react-supabase.vercel.app")
    .replace(/\/$/, "");
}

export async function pagBankRequest(path, options = {}) {
  const { token, apiUrl } = getPagBankConfig();
  const response = await fetch(`${apiUrl}${path}`, {
    ...options,
    headers: {
      accept: "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...options.headers,
    },
  });

  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text ? { message: text } : null;
  }

  if (!response.ok) {
    const providerMessage =
      data?.error_messages?.map((item) => item.description || item.message).filter(Boolean).join(" ") ||
      data?.message ||
      `O PagBank respondeu com o código ${response.status}.`;
    const error = new Error(providerMessage);
    error.statusCode = response.status;
    throw error;
  }

  return data;
}

export function toCents(value) {
  return Math.round(Number(value || 0) * 100);
}

export function readRequestBody(request) {
  if (typeof request.body === "string") return JSON.parse(request.body || "{}");
  return request.body || {};
}

export function sendApiError(response, error, fallbackMessage) {
  console.error(fallbackMessage, error?.message || error);
  const status = Number(error?.statusCode) >= 400 && Number(error?.statusCode) < 500
    ? Number(error.statusCode)
    : 500;
  response.status(status).json({ error: error?.publicMessage || fallbackMessage });
}
