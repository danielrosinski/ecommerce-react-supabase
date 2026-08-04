import { defaultProducts } from "../data";
import { isSupabaseConfigured, supabase } from "../lib/supabase";

const productColumns =
  "id,name,category,price,stock,featured,active,tag,image,description,care_instructions,size_options,addons,created_at,updated_at";

const defaultSizes = [{ id: "standard", label: "Tamanho único", price_delta: 0 }];

function normalizeProduct(product) {
  return {
    ...product,
    id: Number(product.id),
    price: Number(product.price),
    stock: Number(product.stock),
    description: product.description ?? "",
    care_instructions: product.care_instructions ?? "",
    size_options: Array.isArray(product.size_options) && product.size_options.length
      ? product.size_options.map((option) => ({
          ...option,
          price_delta: Number(option.price_delta ?? 0),
        }))
      : defaultSizes,
    addons: Array.isArray(product.addons)
      ? product.addons.map((addon) => ({ ...addon, price: Number(addon.price ?? 0) }))
      : [],
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
    description: product.description?.trim() ?? "",
    care_instructions: product.care_instructions?.trim() ?? "",
    size_options: product.size_options ?? defaultSizes,
    addons: product.addons ?? [],
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

  const { error } = await supabase.rpc("delete_catalog_product", {
    p_product_id: id,
  });

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
    description: product.description ?? "",
    care_instructions: product.care_instructions ?? "",
    size_options: product.size_options ?? defaultSizes,
    addons: product.addons ?? [],
  }));

  const { error } = await supabase.from("products").upsert(rows, {
    onConflict: "id",
  });

  if (error) throw error;
  return loadProducts();
}
