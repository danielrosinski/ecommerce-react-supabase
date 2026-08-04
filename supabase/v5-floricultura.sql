-- ROSINSKI FLORICULTURA V5
-- Execute este arquivo uma única vez no SQL Editor do Supabase após a V3.

alter table public.orders add column if not exists delivery_method text not null default 'delivery';
alter table public.orders add column if not exists recipient_name text not null default '';
alter table public.orders add column if not exists recipient_phone text not null default '';
alter table public.orders add column if not exists delivery_date date;
alter table public.orders add column if not exists delivery_period text not null default 'flexible';
alter table public.orders add column if not exists occasion text not null default '';
alter table public.orders add column if not exists gift_message text not null default '';
alter table public.orders add column if not exists anonymous_delivery boolean not null default false;
alter table public.orders add column if not exists delivery_instructions text not null default '';

alter table public.orders drop constraint if exists orders_delivery_method_check;
alter table public.orders add constraint orders_delivery_method_check
  check (delivery_method in ('delivery', 'pickup'));

alter table public.orders drop constraint if exists orders_delivery_period_check;
alter table public.orders add constraint orders_delivery_period_check
  check (delivery_period in ('morning', 'afternoon', 'evening', 'flexible'));

alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check
  check (status in ('received', 'confirmed', 'preparing', 'shipped', 'delivered', 'cancelled'));

alter table public.orders alter column status set default 'received';
alter table public.orders alter column order_number set default (
  'ROSINSKI-' ||
  to_char(now(), 'YYYYMMDD') ||
  '-' ||
  upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6))
);

create or replace function public.create_order(
  p_customer jsonb,
  p_items jsonb
)
returns table (
  order_number text,
  subtotal numeric,
  shipping numeric,
  total numeric,
  status text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item jsonb;
  v_product public.products%rowtype;
  v_quantity integer;
  v_subtotal numeric(10, 2) := 0;
  v_shipping numeric(10, 2) := 0;
  v_total numeric(10, 2) := 0;
  v_order_id bigint;
  v_order_number text;
  v_delivery_method text := coalesce(btrim(p_customer->>'delivery_method'), 'delivery');
  v_delivery_date date;
begin
  if p_customer is null
    or coalesce(btrim(p_customer->>'name'), '') = ''
    or coalesce(btrim(p_customer->>'email'), '') = ''
    or coalesce(btrim(p_customer->>'phone'), '') = ''
    or coalesce(btrim(p_customer->>'recipient_name'), '') = ''
    or coalesce(btrim(p_customer->>'recipient_phone'), '') = ''
    or v_delivery_method not in ('delivery', 'pickup')
  then
    raise exception 'Preencha os dados do cliente e do destinatário.';
  end if;

  begin
    v_delivery_date := nullif(btrim(p_customer->>'delivery_date'), '')::date;
  exception when others then
    raise exception 'Informe uma data de entrega válida.';
  end;

  if v_delivery_date is null or v_delivery_date < current_date then
    raise exception 'Escolha uma data de entrega válida.';
  end if;

  if coalesce(btrim(p_customer->>'delivery_period'), '') not in ('morning', 'afternoon', 'evening', 'flexible') then
    raise exception 'Escolha um período de entrega válido.';
  end if;

  if v_delivery_method = 'delivery' and (
    coalesce(btrim(p_customer->>'postal_code'), '') = ''
    or coalesce(btrim(p_customer->>'address_line'), '') = ''
    or coalesce(btrim(p_customer->>'address_number'), '') = ''
    or coalesce(btrim(p_customer->>'neighborhood'), '') = ''
    or lower(coalesce(btrim(p_customer->>'city'), '')) <> 'guaratuba'
    or upper(coalesce(btrim(p_customer->>'state'), '')) <> 'PR'
  ) then
    raise exception 'No momento, as entregas estão disponíveis apenas em Guaratuba/PR.';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'O carrinho está vazio.';
  end if;

  if jsonb_array_length(p_items) > 30 then
    raise exception 'O pedido ultrapassa o limite de itens.';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_items) as entry(item)
    where coalesce(item->>'product_id', '') !~ '^[0-9]+$'
       or coalesce(item->>'quantity', '') !~ '^[1-9][0-9]*$'
  ) then
    raise exception 'O pedido contém itens inválidos.';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_items) as entry(item)
    group by item->>'product_id' having count(*) > 1
  ) then
    raise exception 'O pedido contém produtos duplicados.';
  end if;

  for v_item in
    select item from jsonb_array_elements(p_items) as entry(item)
    order by (item->>'product_id')::bigint
  loop
    v_quantity := (v_item->>'quantity')::integer;
    select * into v_product from public.products
    where id = (v_item->>'product_id')::bigint for update;

    if not found or not v_product.active then
      raise exception 'Um produto do carrinho não está mais disponível.';
    end if;

    if v_product.stock < v_quantity then
      raise exception 'Estoque insuficiente para %.', v_product.name;
    end if;

    v_subtotal := v_subtotal + (v_product.price * v_quantity);
  end loop;

  v_shipping := case when v_delivery_method = 'pickup' then 0 else 14.90 end;
  v_total := v_subtotal + v_shipping;

  insert into public.orders as new_order (
    customer_name, customer_email, customer_phone,
    postal_code, address_line, address_number, complement, neighborhood, city, state,
    delivery_method, recipient_name, recipient_phone, delivery_date, delivery_period,
    occasion, gift_message, anonymous_delivery, delivery_instructions,
    subtotal, shipping, total, status
  ) values (
    btrim(p_customer->>'name'), lower(btrim(p_customer->>'email')), btrim(p_customer->>'phone'),
    btrim(p_customer->>'postal_code'), btrim(p_customer->>'address_line'), btrim(p_customer->>'address_number'),
    coalesce(btrim(p_customer->>'complement'), ''), btrim(p_customer->>'neighborhood'),
    btrim(p_customer->>'city'), upper(btrim(p_customer->>'state')),
    v_delivery_method, btrim(p_customer->>'recipient_name'), btrim(p_customer->>'recipient_phone'),
    v_delivery_date, btrim(p_customer->>'delivery_period'), coalesce(btrim(p_customer->>'occasion'), ''),
    coalesce(btrim(p_customer->>'gift_message'), ''),
    coalesce((p_customer->>'anonymous_delivery')::boolean, false),
    coalesce(btrim(p_customer->>'delivery_instructions'), ''),
    v_subtotal, v_shipping, v_total, 'received'
  ) returning new_order.id, new_order.order_number into v_order_id, v_order_number;

  for v_item in
    select item from jsonb_array_elements(p_items) as entry(item)
    order by (item->>'product_id')::bigint
  loop
    v_quantity := (v_item->>'quantity')::integer;
    select * into v_product from public.products where id = (v_item->>'product_id')::bigint;

    insert into public.order_items (order_id, product_id, product_name, unit_price, quantity, line_total)
    values (v_order_id, v_product.id, v_product.name, v_product.price, v_quantity, v_product.price * v_quantity);

    update public.products set stock = stock - v_quantity where id = v_product.id;
  end loop;

  return query select v_order_number, v_subtotal::numeric, v_shipping::numeric, v_total::numeric, 'received'::text;
end;
$$;

create or replace function public.lookup_order(p_order_number text, p_email text)
returns table (
  order_number text,
  customer_name text,
  status text,
  payment_status text,
  delivery_method text,
  recipient_name text,
  delivery_date date,
  delivery_period text,
  city text,
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
    o.order_number,
    o.customer_name,
    o.status,
    o.payment_status,
    o.delivery_method,
    o.recipient_name,
    o.delivery_date,
    o.delivery_period,
    o.city,
    o.shipping,
    o.total,
    o.created_at,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'product_name', i.product_name,
        'quantity', i.quantity,
        'unit_price', i.unit_price,
        'line_total', i.line_total
      ) order by i.id)
      from public.order_items as i
      where i.order_id = o.id
    ), '[]'::jsonb) as items
  from public.orders as o
  where upper(o.order_number) = upper(btrim(p_order_number))
    and lower(o.customer_email) = lower(btrim(p_email))
  limit 1;
$$;

revoke all on function public.lookup_order(text, text) from public;
grant execute on function public.lookup_order(text, text) to anon, authenticated;
revoke all on function public.create_order(jsonb, jsonb) from public;
grant execute on function public.create_order(jsonb, jsonb) to anon, authenticated;

-- Converte somente os produtos demonstrativos originais da NOVA.
update public.products set name = 'Buquê Aurora', category = 'Buquês', price = 149.90, stock = greatest(stock, 6), featured = true, active = true, tag = 'Mais pedido', image = 'https://images.unsplash.com/photo-1526047932273-341f2a7631f9?auto=format&fit=crop&w=900&q=85' where name = 'Vaso Cerâmica Areia';
update public.products set name = 'Buquê Jardim Rosé', category = 'Buquês', price = 189.90, stock = greatest(stock, 5), featured = true, active = true, tag = 'Delicado', image = 'https://images.unsplash.com/photo-1490750967868-88aa4486c946?auto=format&fit=crop&w=900&q=85' where name = 'Bolsa Linho Natural';
update public.products set name = 'Buquê Campo Natural', category = 'Buquês', price = 129.90, stock = greatest(stock, 5), featured = true, active = true, tag = 'Flores da estação', image = 'https://images.unsplash.com/photo-1487412912498-0447578fcca8?auto=format&fit=crop&w=900&q=85' where name = 'Perfume Âmbar 50 ml';
update public.products set name = 'Orquídea Branca', category = 'Plantas', price = 119.90, stock = greatest(stock, 4), featured = false, active = true, tag = 'Elegância natural', image = 'https://images.unsplash.com/photo-1459411621453-7b03977f4bfc?auto=format&fit=crop&w=900&q=85' where name = 'Manta Trama Natural';
update public.products set name = 'Jiboia em Vaso Palha', category = 'Plantas', price = 89.90, stock = greatest(stock, 6), featured = false, active = true, tag = 'Fácil de cuidar', image = 'https://images.unsplash.com/photo-1501004318641-b39e6451bec6?auto=format&fit=crop&w=900&q=85' where name = 'Luminária de Mesa Aura';
update public.products set name = 'Suculenta Afeto', category = 'Plantas', price = 49.90, stock = greatest(stock, 10), featured = false, active = true, tag = 'Pequeno presente', image = 'https://images.unsplash.com/photo-1459156212016-c812468e2115?auto=format&fit=crop&w=900&q=85' where name = 'Carteira Couro Siena';
update public.products set active = false where name in ('Difusor Cedro & Figo', 'Relógio Minimal Couro');
