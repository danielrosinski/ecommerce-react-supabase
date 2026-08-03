import { defaultProducts } from "../data";
import { isSupabaseConfigured, supabase } from "../lib/supabase";

const productColumns =
  "id,name,category,price,stock,featured,active,tag,image,created_at,updated_at";

function normalizeProduct(product) {
  return {
    ...product,
    id: Number(product.id),
    price: Number(product.price),
    stock: Number(product.stock),
  };
}

export async function loadProducts() {
  if (!isSupabaseConfigured) {
    return defaultProducts;
  }

  const { data, error } = await supabase
    .from("products")
    .select(productColumns)
    .order("featured", { ascending: false })
    .order("id", { ascending: true });

  if (error) throw error;
  return (data ?? []).map(normalizeProduct);
}

export async function saveProductChange(id, changes) {
  if (!isSupabaseConfigured) {
    return { id, ...changes };
  }

  const { data, error } = await supabase
    .from("products")
    .update(changes)
    .eq("id", id)
    .select(productColumns)
    .single();

  if (error) throw error;
  return normalizeProduct(data);
}

export async function createProduct(product) {
  const row = {
    name: product.name.trim(),
    category: product.category,
    price: Number(product.price),
    stock: Number(product.stock),
    featured: Boolean(product.featured),
    active: Boolean(product.active),
    tag: product.tag.trim(),
    image: product.image.trim(),
  };

  if (!isSupabaseConfigured) {
    return normalizeProduct({
      ...row,
      id: Date.now(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }

  const { data, error } = await supabase
    .from("products")
    .insert(row)
    .select(productColumns)
    .single();

  if (error) throw error;
  return normalizeProduct(data);
}

export async function deleteProduct(id) {
  if (!isSupabaseConfigured) return;

  const { error } = await supabase.from("products").delete().eq("id", id);

  if (error) throw error;
}

export async function restoreExampleProducts() {
  if (!isSupabaseConfigured) {
    return defaultProducts;
  }

  const rows = defaultProducts.map((product) => ({
    id: product.id,
    name: product.name,
    category: product.category,
    price: product.price,
    stock: product.stock,
    featured: product.featured,
    active: product.active,
    tag: product.tag,
    image: product.image,
  }));

  const { error } = await supabase.from("products").upsert(rows, {
    onConflict: "id",
  });

  if (error) throw error;
  return loadProducts();
}
