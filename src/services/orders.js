import { isSupabaseConfigured, supabase } from "../lib/supabase";

const orderColumns = `
  id,
  order_number,
  customer_name,
  customer_email,
  customer_phone,
  postal_code,
  address_line,
  address_number,
  complement,
  neighborhood,
  city,
  state,
  delivery_method,
  recipient_name,
  recipient_phone,
  delivery_date,
  delivery_period,
  occasion,
  gift_message,
  anonymous_delivery,
  delivery_instructions,
  subtotal,
  shipping,
  total,
  payment_method,
  payment_status,
  status,
  created_at,
  updated_at,
  order_items (
    id,
    product_id,
    product_name,
    unit_price,
    quantity,
    line_total
  )
`;

function normalizeOrder(order) {
  return {
    ...order,
    id: Number(order.id),
    subtotal: Number(order.subtotal),
    shipping: Number(order.shipping),
    total: Number(order.total),
    order_items: (order.order_items ?? []).map((item) => ({
      ...item,
      id: Number(item.id),
      product_id: Number(item.product_id),
      unit_price: Number(item.unit_price),
      quantity: Number(item.quantity),
      line_total: Number(item.line_total),
    })),
  };
}

function createDemoOrder(customer, cart, products) {
  const subtotal = cart.reduce((sum, item) => {
    const product = products.find((candidate) => candidate.id === item.id);
    return sum + (product?.price ?? 0) * item.quantity;
  }, 0);
  const shipping = customer.delivery_method === "pickup" ? 0 : 14.9;

  return {
    order_number: `ROSINSKI-DEMO-${String(Date.now()).slice(-6)}`,
    subtotal,
    shipping,
    total: subtotal + shipping,
    status: "confirmed",
    demo: true,
  };
}

export async function createOrder({ customer, cart, products }) {
  if (!isSupabaseConfigured) {
    return createDemoOrder(customer, cart, products);
  }

  const items = cart.map((item) => ({
    product_id: item.id,
    quantity: item.quantity,
  }));

  const { data, error } = await supabase.rpc("create_order", {
    p_customer: customer,
    p_items: items,
  });

  if (error) throw error;
  const result = Array.isArray(data) ? data[0] : data;

  return {
    ...result,
    subtotal: Number(result?.subtotal ?? 0),
    shipping: Number(result?.shipping ?? 0),
    total: Number(result?.total ?? 0),
  };
}

export async function loadOrders() {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await supabase
    .from("orders")
    .select(orderColumns)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).map(normalizeOrder);
}

export async function updateOrderStatus(id, status) {
  if (!isSupabaseConfigured) return { id, status };

  const { data, error } = await supabase
    .from("orders")
    .update({ status })
    .eq("id", id)
    .select(orderColumns)
    .single();

  if (error) throw error;
  return normalizeOrder(data);
}

export async function lookupOrder(orderNumber, email) {
  if (!isSupabaseConfigured) {
    throw new Error("A consulta de pedidos requer a conexão com o Supabase.");
  }

  const { data, error } = await supabase.rpc("lookup_order", {
    p_order_number: orderNumber.trim(),
    p_email: email.trim().toLowerCase(),
  });

  if (error) throw error;
  const result = Array.isArray(data) ? data[0] : data;

  if (!result) {
    throw new Error("Pedido não encontrado. Confira o número e o e-mail informado na compra.");
  }

  return {
    ...result,
    shipping: Number(result.shipping ?? 0),
    total: Number(result.total ?? 0),
    items: Array.isArray(result.items) ? result.items : [],
  };
}
