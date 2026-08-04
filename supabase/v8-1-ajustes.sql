-- ROSINSKI FLORICULTURA · V8.1
-- Execute este arquivo uma vez no SQL Editor do Supabase.
-- Ele adiciona o status Finalizado e permite a exclusão segura do catálogo.

alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check
  check (status in (
    'received',
    'confirmed',
    'preparing',
    'shipped',
    'delivered',
    'completed',
    'cancelled'
  ));

create or replace function public.restore_stock_on_order_cancel()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = 'cancelled' and new.status <> 'cancelled' then
    raise exception 'Pedidos cancelados não podem ser reabertos.';
  elsif old.status = 'completed' and new.status <> 'completed' then
    raise exception 'Pedidos finalizados não podem ser reabertos.';
  elsif new.status = 'cancelled' and old.status <> 'cancelled' then
    update public.products as product
    set stock = product.stock + item.quantity
    from public.order_items as item
    where item.order_id = new.id
      and item.product_id = product.id;
  end if;

  return new;
end;
$$;

alter table public.order_items alter column product_id drop not null;
alter table public.order_items drop constraint if exists order_items_product_id_fkey;
alter table public.order_items add constraint order_items_product_id_fkey
  foreign key (product_id)
  references public.products(id)
  on delete set null;

drop policy if exists "Admins can delete products" on public.products;
revoke delete on public.products from authenticated;

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

  if not exists (
    select 1 from public.products where id = p_product_id
  ) then
    raise exception 'Produto não encontrado.';
  end if;

  if exists (
    select 1
    from public.order_items as item
    join public.orders as order_record on order_record.id = item.order_id
    where item.product_id = p_product_id
      and order_record.status not in ('cancelled', 'completed')
  ) then
    raise exception 'Este produto pertence a um pedido em andamento. Cancele ou finalize o pedido antes de excluí-lo.';
  end if;

  delete from public.products where id = p_product_id;
end;
$$;

revoke all on function public.delete_catalog_product(bigint) from public;
grant execute on function public.delete_catalog_product(bigint) to authenticated;

