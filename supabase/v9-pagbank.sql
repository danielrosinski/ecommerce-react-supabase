-- ROSINSKI FLORICULTURA · V9
-- Execute este arquivo uma vez no SQL Editor do Supabase.
-- Adiciona os dados necessários para pagamentos pelo Checkout PagBank.

alter table public.orders
  add column if not exists payment_provider text not null default 'simulated',
  add column if not exists payment_checkout_id text,
  add column if not exists payment_checkout_url text,
  add column if not exists payment_provider_order_id text,
  add column if not exists payment_updated_at timestamptz;

alter table public.orders drop constraint if exists orders_payment_status_check;
alter table public.orders add constraint orders_payment_status_check
  check (payment_status in ('simulated', 'pending', 'approved', 'refused', 'refunded'));

create unique index if not exists orders_payment_checkout_id_unique
  on public.orders (payment_checkout_id)
  where payment_checkout_id is not null;

create index if not exists orders_payment_status_idx
  on public.orders (payment_status);

drop function if exists public.lookup_order(text, text);
create function public.lookup_order(p_order_number text, p_email text)
returns table (
  order_number text,
  customer_name text,
  status text,
  payment_method text,
  payment_provider text,
  payment_status text,
  payment_checkout_url text,
  delivery_method text,
  recipient_name text,
  delivery_date date,
  delivery_period text,
  city text,
  subtotal numeric,
  discount numeric,
  coupon_code text,
  shipping numeric,
  total numeric,
  created_at timestamptz,
  items jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    order_record.order_number,
    order_record.customer_name,
    order_record.status,
    order_record.payment_method,
    order_record.payment_provider,
    order_record.payment_status,
    order_record.payment_checkout_url,
    order_record.delivery_method,
    order_record.recipient_name,
    order_record.delivery_date,
    order_record.delivery_period,
    order_record.city,
    order_record.subtotal,
    order_record.discount,
    order_record.coupon_code,
    order_record.shipping,
    order_record.total,
    order_record.created_at,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'product_name', item.product_name,
        'quantity', item.quantity,
        'unit_price', item.unit_price,
        'line_total', item.line_total,
        'selected_size', item.selected_size,
        'selected_addons', item.selected_addons,
        'options_total', item.options_total
      ) order by item.id)
      from public.order_items as item
      where item.order_id = order_record.id
    ), '[]'::jsonb) as items
  from public.orders as order_record
  where upper(order_record.order_number) = upper(btrim(p_order_number))
    and lower(order_record.customer_email) = lower(btrim(p_email))
  limit 1;
$$;

revoke all on function public.lookup_order(text, text) from public;
grant execute on function public.lookup_order(text, text) to anon, authenticated;

