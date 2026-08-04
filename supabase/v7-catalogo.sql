-- ROSINSKI FLORICULTURA V7
-- Execute este arquivo uma única vez no SQL Editor do Supabase após a V5.
-- Adiciona detalhes, tamanhos e complementos aos produtos e aos pedidos.

alter table public.products add column if not exists description text not null default '';
alter table public.products add column if not exists care_instructions text not null default '';
alter table public.products add column if not exists size_options jsonb not null default '[{"id":"standard","label":"Tamanho único","price_delta":0}]'::jsonb;
alter table public.products add column if not exists addons jsonb not null default '[]'::jsonb;

alter table public.order_items add column if not exists selected_size text not null default '';
alter table public.order_items add column if not exists selected_addons jsonb not null default '[]'::jsonb;
alter table public.order_items add column if not exists options_total numeric(10, 2) not null default 0 check (options_total >= 0);

update public.products
set
  description = case
    when category = 'Buquês' then 'Composição de flores frescas preparada artesanalmente para presentear em diferentes ocasiões.'
    else 'Planta selecionada e preparada com acabamento delicado para presentear ou decorar.'
  end,
  care_instructions = case
    when category = 'Buquês' then 'Mantenha em local fresco, troque a água diariamente e corte a ponta dos caules na diagonal.'
    else 'Mantenha em local iluminado sem sol forte e regue de acordo com a umidade do substrato.'
  end
where description = '' or care_instructions = '';

update public.products
set size_options = case
  when category = 'Buquês' then '[
    {"id":"standard","label":"Padrão","price_delta":0},
    {"id":"medium","label":"Médio","price_delta":35},
    {"id":"large","label":"Grande","price_delta":70}
  ]'::jsonb
  else '[{"id":"standard","label":"Tamanho único","price_delta":0}]'::jsonb
end
where size_options = '[{"id":"standard","label":"Tamanho único","price_delta":0}]'::jsonb;

update public.products
set addons = case
  when category = 'Buquês' then '[
    {"id":"card","label":"Cartão especial","price":9.90},
    {"id":"chocolate","label":"Chocolate","price":24.90},
    {"id":"vase","label":"Vaso de vidro","price":39.90}
  ]'::jsonb
  else '[{"id":"card","label":"Cartão especial","price":9.90}]'::jsonb
end
where addons = '[]'::jsonb;

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
  v_size_id text;
  v_size jsonb;
  v_addon_ids jsonb;
  v_addon_id text;
  v_addon jsonb;
  v_selected_addons jsonb;
  v_options_total numeric(10, 2);
  v_unit_price numeric(10, 2);
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

    v_size_id := coalesce(nullif(btrim(v_item->>'size_id'), ''), 'standard');
    select option into v_size
    from jsonb_array_elements(v_product.size_options) as options(option)
    where option->>'id' = v_size_id
    limit 1;
    if not found then
      raise exception 'O tamanho escolhido para % não está disponível.', v_product.name;
    end if;

    v_addon_ids := coalesce(v_item->'addon_ids', '[]'::jsonb);
    if jsonb_typeof(v_addon_ids) <> 'array' then
      raise exception 'Os complementos escolhidos são inválidos.';
    end if;

    v_options_total := coalesce((v_size->>'price_delta')::numeric, 0);
    for v_addon_id in select jsonb_array_elements_text(v_addon_ids)
    loop
      select option into v_addon
      from jsonb_array_elements(v_product.addons) as options(option)
      where option->>'id' = v_addon_id
      limit 1;
      if not found then
        raise exception 'Um complemento escolhido para % não está disponível.', v_product.name;
      end if;
      v_options_total := v_options_total + coalesce((v_addon->>'price')::numeric, 0);
    end loop;

    v_unit_price := v_product.price + v_options_total;
    v_subtotal := v_subtotal + (v_unit_price * v_quantity);
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

    v_size_id := coalesce(nullif(btrim(v_item->>'size_id'), ''), 'standard');
    select option into v_size
    from jsonb_array_elements(v_product.size_options) as options(option)
    where option->>'id' = v_size_id
    limit 1;

    v_addon_ids := coalesce(v_item->'addon_ids', '[]'::jsonb);
    v_selected_addons := '[]'::jsonb;
    v_options_total := coalesce((v_size->>'price_delta')::numeric, 0);

    for v_addon_id in select jsonb_array_elements_text(v_addon_ids)
    loop
      select option into v_addon
      from jsonb_array_elements(v_product.addons) as options(option)
      where option->>'id' = v_addon_id
      limit 1;
      v_options_total := v_options_total + coalesce((v_addon->>'price')::numeric, 0);
      v_selected_addons := v_selected_addons || jsonb_build_array(jsonb_build_object(
        'id', v_addon->>'id',
        'label', v_addon->>'label',
        'price', coalesce((v_addon->>'price')::numeric, 0)
      ));
    end loop;

    v_unit_price := v_product.price + v_options_total;
    insert into public.order_items (
      order_id, product_id, product_name, unit_price, quantity, line_total,
      selected_size, selected_addons, options_total
    ) values (
      v_order_id, v_product.id, v_product.name, v_unit_price, v_quantity, v_unit_price * v_quantity,
      coalesce(v_size->>'label', ''), v_selected_addons, v_options_total
    );

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
        'line_total', i.line_total,
        'selected_size', i.selected_size,
        'selected_addons', i.selected_addons,
        'options_total', i.options_total
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
