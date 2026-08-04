-- ROSINSKI FLORICULTURA · V10
-- Execute este arquivo uma vez no SQL Editor do Supabase depois da V9.
-- Adiciona reservas com validade, devolução automática ao estoque e suporte a reembolso.

alter table public.orders
  add column if not exists reservation_expires_at timestamptz,
  add column if not exists stock_released_at timestamptz,
  add column if not exists payment_charge_id text;

alter table public.orders
  alter column reservation_expires_at set default (now() + interval '30 minutes');

update public.orders
set reservation_expires_at = coalesce(payment_updated_at, created_at) + interval '30 minutes'
where payment_provider = 'pagbank'
  and payment_status in ('pending', 'refused')
  and reservation_expires_at is null;

-- Os pedidos cancelados antes da V10 já tiveram o estoque devolvido pelo gatilho anterior.
update public.orders
set stock_released_at = coalesce(updated_at, now())
where status = 'cancelled'
  and stock_released_at is null;

alter table public.orders drop constraint if exists orders_payment_status_check;
alter table public.orders add constraint orders_payment_status_check
  check (payment_status in (
    'simulated',
    'pending',
    'approved',
    'refused',
    'expired',
    'refunded'
  ));

alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check
  check (status in (
    'received',
    'confirmed',
    'preparing',
    'shipped',
    'delivered',
    'completed',
    'cancelled',
    'expired',
    'payment_review'
  ));

create index if not exists orders_reservation_expires_at_idx
  on public.orders (reservation_expires_at)
  where payment_status in ('pending', 'refused');

create index if not exists orders_payment_charge_id_idx
  on public.orders (payment_charge_id)
  where payment_charge_id is not null;

create or replace function public.restore_stock_on_order_cancel()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status in ('cancelled', 'expired')
    and new.status <> old.status
    and new.status <> 'payment_review'
  then
    raise exception 'Pedidos cancelados ou expirados não podem ser reabertos.';
  elsif old.status = 'completed' and new.status <> 'completed' then
    raise exception 'Pedidos finalizados não podem ser reabertos.';
  elsif new.status in ('cancelled', 'expired')
    and old.status not in ('cancelled', 'expired', 'completed')
    and old.stock_released_at is null
  then
    update public.products as product
    set stock = product.stock + item.quantity
    from public.order_items as item
    where item.order_id = new.id
      and item.product_id = product.id;

    if coalesce(new.coupon_code, '') <> '' then
      update public.coupons
      set times_used = greatest(0, times_used - 1)
      where code = new.coupon_code;
    end if;

    new.stock_released_at := now();
  end if;

  return new;
end;
$$;

drop trigger if exists orders_restore_stock_on_cancel on public.orders;
create trigger orders_restore_stock_on_cancel
before update of status on public.orders
for each row execute function public.restore_stock_on_order_cancel();

create or replace function public.expire_abandoned_orders()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_expired integer := 0;
begin
  update public.orders
  set
    status = 'expired',
    payment_status = 'expired',
    payment_updated_at = now()
  where payment_provider = 'pagbank'
    and payment_status in ('pending', 'refused')
    and status not in ('cancelled', 'expired', 'completed', 'payment_review')
    and reservation_expires_at is not null
    -- Pequena tolerância para uma notificação de pagamento que esteja em trânsito.
    and reservation_expires_at <= now() - interval '2 minutes';

  get diagnostics v_expired = row_count;
  return v_expired;
end;
$$;

revoke all on function public.expire_abandoned_orders() from public;

-- Supabase Cron usa pg_cron e executa a limpeza sem depender de uma visita ao site.
create extension if not exists pg_cron;

do $$
begin
  perform cron.schedule(
    'rosinski-expire-payment-reservations',
    '*/5 * * * *',
    'select public.expire_abandoned_orders();'
  );
end;
$$;

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
  reservation_expires_at timestamptz,
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
    order_record.reservation_expires_at,
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

create or replace function public.delete_catalog_product(p_product_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Acesso administrativo necessário.';
  end if;

  if not exists (select 1 from public.products where id = p_product_id) then
    raise exception 'Produto não encontrado.';
  end if;

  if exists (
    select 1
    from public.order_items as item
    join public.orders as order_record on order_record.id = item.order_id
    where item.product_id = p_product_id
      and order_record.status not in ('cancelled', 'expired', 'completed')
  ) then
    raise exception 'Este produto pertence a um pedido em andamento. Cancele, expire ou finalize o pedido antes de excluí-lo.';
  end if;

  delete from public.products where id = p_product_id;
end;
$$;

revoke all on function public.delete_catalog_product(bigint) from public;
grant execute on function public.delete_catalog_product(bigint) to authenticated;
