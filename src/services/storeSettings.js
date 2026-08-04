import { isSupabaseConfigured, supabase } from "../lib/supabase";

export const defaultDeliveryZones = [
  { id: 1, neighborhood: "Centro", fee: 10, min_order: 0, active: true },
  { id: 2, neighborhood: "Brejatuba", fee: 12.9, min_order: 0, active: true },
  { id: 3, neighborhood: "*", fee: 14.9, min_order: 0, active: true },
];

const normalizeZone = (zone) => ({
  ...zone,
  id: Number(zone.id),
  fee: Number(zone.fee),
  min_order: Number(zone.min_order ?? 0),
});

const normalizeCoupon = (coupon) => ({
  ...coupon,
  id: Number(coupon.id),
  discount_value: Number(coupon.discount_value),
  min_order: Number(coupon.min_order ?? 0),
  max_discount: coupon.max_discount == null ? null : Number(coupon.max_discount),
  usage_limit: coupon.usage_limit == null ? null : Number(coupon.usage_limit),
  times_used: Number(coupon.times_used ?? 0),
});

export async function loadDeliveryZones() {
  if (!isSupabaseConfigured) return defaultDeliveryZones;
  const { data, error } = await supabase
    .from("delivery_zones")
    .select("id,neighborhood,fee,min_order,active,created_at,updated_at")
    .order("neighborhood");
  if (error) throw error;
  return (data ?? []).map(normalizeZone);
}

export async function createDeliveryZone(zone) {
  const row = {
    neighborhood: zone.neighborhood.trim(),
    fee: Number(zone.fee),
    min_order: Number(zone.min_order ?? 0),
    active: zone.active !== false,
  };
  if (!isSupabaseConfigured) return normalizeZone({ ...row, id: Date.now() });
  const { data, error } = await supabase
    .from("delivery_zones")
    .insert(row)
    .select()
    .single();
  if (error) throw error;
  return normalizeZone(data);
}

export async function updateDeliveryZone(id, changes) {
  if (!isSupabaseConfigured) return normalizeZone({ id, ...changes });
  const { data, error } = await supabase
    .from("delivery_zones")
    .update(changes)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return normalizeZone(data);
}

export async function deleteDeliveryZone(id) {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase.from("delivery_zones").delete().eq("id", id);
  if (error) throw error;
}

export async function loadCoupons() {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from("coupons")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(normalizeCoupon);
}

export async function createCoupon(coupon) {
  const row = {
    code: coupon.code.trim().toUpperCase(),
    discount_type: coupon.discount_type,
    discount_value: Number(coupon.discount_value),
    min_order: Number(coupon.min_order ?? 0),
    max_discount: coupon.max_discount === "" ? null : Number(coupon.max_discount),
    starts_at: coupon.starts_at || null,
    ends_at: coupon.ends_at || null,
    usage_limit: coupon.usage_limit === "" ? null : Number(coupon.usage_limit),
    active: coupon.active !== false,
  };
  if (!isSupabaseConfigured) return normalizeCoupon({ ...row, id: Date.now(), times_used: 0 });
  const { data, error } = await supabase.from("coupons").insert(row).select().single();
  if (error) throw error;
  return normalizeCoupon(data);
}

export async function updateCoupon(id, changes) {
  if (!isSupabaseConfigured) return normalizeCoupon({ id, ...changes });
  const { data, error } = await supabase
    .from("coupons")
    .update(changes)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return normalizeCoupon(data);
}

export async function deleteCoupon(id) {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase.from("coupons").delete().eq("id", id);
  if (error) throw error;
}

export async function validateCoupon(code, subtotal) {
  const normalizedCode = code.trim().toUpperCase();
  if (!normalizedCode) throw new Error("Digite um cupom.");
  if (!isSupabaseConfigured) {
    if (normalizedCode !== "BEMVINDO10") throw new Error("Cupom inválido ou indisponível.");
    return { code: normalizedCode, discount: Math.min(Number(subtotal) * 0.1, 50) };
  }
  const { data, error } = await supabase.rpc("validate_coupon", {
    p_code: normalizedCode,
    p_subtotal: Number(subtotal),
  });
  if (error) throw error;
  const result = Array.isArray(data) ? data[0] : data;
  if (!result) throw new Error("Cupom inválido ou indisponível.");
  return { ...result, discount: Number(result.discount ?? 0) };
}

export async function uploadProductImage(file) {
  if (!isSupabaseConfigured) throw new Error("Conecte o Supabase para enviar imagens.");
  if (!file?.type?.startsWith("image/")) throw new Error("Escolha um arquivo de imagem.");
  if (file.size > 5 * 1024 * 1024) throw new Error("A imagem deve ter no máximo 5 MB.");

  const extension = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `catalogo/${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage
    .from("product-images")
    .upload(path, file, { cacheControl: "3600", upsert: false });
  if (error) throw error;
  const { data } = supabase.storage.from("product-images").getPublicUrl(path);
  return data.publicUrl;
}
