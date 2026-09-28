-- Optional inventory tracking + atomic admin bulk canonical category moves.
-- Does not alter merchandising RLS policies.
-- Existing products remain inventory-tracked (column default true).

alter table public.products
  add column if not exists track_inventory boolean not null default true;

alter table public.products
  add column if not exists needs_category_review boolean not null default false;

comment on column public.products.track_inventory is
  'When true, stock_quantity is required and checkout decrements stock. When false, quantity is not required and checkout does not decrement stock.';

-- Flag obvious cookware/household items currently in Foods for admin review. Does not change category_id.
update public.products p
set needs_category_review = true
from public.categories c
where p.category_id = c.id
  and c.slug = 'foods'
  and p.name ~* '(^|[^a-z])(pots?|pans?|cookware|saucepan|skillet|wok|casserole|dutch oven|frying[[:space:]-]?pan|kitchen utensil|spatula|ladle|colander|cutting board|chopping board|mixing bowl|dinnerware|food[[:space:]-]?storage|storage container)([^a-z]|$)';

create or replace function public.create_checkout_order(
  p_items jsonb,
  p_customer_name text,
  p_customer_email text,
  p_customer_phone text,
  p_shipping_address jsonb,
  p_fulfillment_method public.fulfillment_method,
  p_idempotency_key uuid
)
returns table (
  order_id uuid,
  order_number text,
  status public.order_status,
  total numeric(12, 2)
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_item jsonb;
  v_product_id uuid;
  v_quantity integer;
  v_product public.products%rowtype;
  v_product_name text;
  v_product_price numeric(12, 2);
  v_subtotal numeric(12, 2) := 0;
  v_order public.orders%rowtype;
  v_existing public.orders%rowtype;
begin
  if p_idempotency_key is null then
    raise exception using errcode = 'P0001', message = 'A checkout key is required.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_idempotency_key::text, 0));

  select * into v_existing
  from public.orders
  where checkout_idempotency_key = p_idempotency_key;

  if found then
    if v_existing.user_id is distinct from v_user_id then
      raise exception using errcode = 'P0001', message = 'This checkout belongs to a different session.';
    end if;
    return query select v_existing.id, v_existing.order_number, v_existing.status, v_existing.total;
    return;
  end if;

  if exists (select 1 from public.store_settings where id = 'default' and is_open = false) then
    raise exception using errcode = 'P0001', message = 'Ordering is temporarily unavailable. Please check back soon.';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception using errcode = 'P0001', message = 'Your cart is empty.';
  end if;
  if jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 100 then
    raise exception using errcode = 'P0001', message = 'Your cart is empty.';
  end if;

  if nullif(btrim(p_customer_name), '') is null
     or nullif(btrim(p_customer_email), '') is null
     or p_customer_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception using errcode = 'P0001', message = 'A valid name and email are required.';
  end if;

  if p_customer_phone is null or p_customer_phone !~ '^[+()0-9[:space:].-]{7,40}$'
     or length(regexp_replace(p_customer_phone, '[^0-9]', '', 'g')) < 7 then
    raise exception using errcode = 'P0001', message = 'A valid phone number is required.';
  end if;
  if p_fulfillment_method is null then
    raise exception using errcode = 'P0001', message = 'Choose delivery or pickup.';
  end if;
  if p_shipping_address is null or jsonb_typeof(p_shipping_address) <> 'object'
     or (p_fulfillment_method = 'delivery' and (
       nullif(btrim(p_shipping_address ->> 'address_line_1'), '') is null
       or nullif(btrim(p_shipping_address ->> 'city'), '') is null
       or nullif(btrim(p_shipping_address ->> 'country'), '') is null
     )) then
    raise exception using errcode = 'P0001', message = 'A shipping address is required.';
  end if;

  for v_item in select value from jsonb_array_elements(p_items) order by value ->> 'product_id'
  loop
    if jsonb_typeof(v_item) <> 'object'
       or coalesce(v_item ->> 'product_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
       or coalesce(v_item ->> 'quantity', '') !~ '^[1-9][0-9]*$' then
      raise exception using errcode = 'P0001', message = 'Your cart contains an invalid item.';
    end if;

    v_product_id := (v_item ->> 'product_id')::uuid;
    v_quantity := (v_item ->> 'quantity')::integer;

    select p.* into v_product
    from public.products p
    join public.categories c on c.id = p.category_id
    where p.id = v_product_id
      and p.is_active
      and c.is_active
    for update of p;

    if not found then
      raise exception using errcode = 'P0001', message = 'A product in your cart is no longer available.';
    end if;

    if v_product.price is null or v_product.price = 'NaN'::numeric or v_product.price <= 0 then
      raise exception using errcode = 'P0001', message = 'A product in your cart is no longer available.';
    end if;

    if coalesce(v_product.track_inventory, true) then
      if v_product.stock_quantity is null or v_product.stock_quantity < v_quantity then
        raise exception using errcode = 'P0001', message = 'Some items are no longer available in the requested quantity.';
      end if;

      update public.products
      set stock_quantity = stock_quantity - v_quantity
      where id = v_product.id;
    end if;

    v_subtotal := v_subtotal + (v_product.price * v_quantity);
  end loop;

  insert into public.orders (
    order_number,
    checkout_idempotency_key,
    user_id,
    customer_email,
    customer_name,
    customer_phone,
    status,
    payment_status,
    payment_method,
    fulfillment_method,
    subtotal,
    shipping_cost,
    discount_amount,
    total,
    shipping_address
  ) values (
    'IV-' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6)),
    p_idempotency_key,
    v_user_id,
    lower(btrim(p_customer_email)),
    btrim(p_customer_name),
    nullif(btrim(p_customer_phone), ''),
    'pending',
    'pending',
    'not_collected',
    p_fulfillment_method,
    v_subtotal,
    0,
    0,
    v_subtotal,
    p_shipping_address
  )
  returning * into v_order;

  for v_item in select value from jsonb_array_elements(p_items) order by value ->> 'product_id'
  loop
    v_product_id := (v_item ->> 'product_id')::uuid;
    v_quantity := (v_item ->> 'quantity')::integer;

    select name, price into v_product_name, v_product_price
    from public.products
    where id = v_product_id;

    insert into public.order_items (order_id, product_id, product_name, product_price, quantity)
    values (v_order.id, v_product_id, v_product_name, v_product_price, v_quantity);
  end loop;

  return query select v_order.id, v_order.order_number, v_order.status, v_order.total;
end;
$$;

revoke all on function public.create_checkout_order(jsonb, text, text, text, jsonb, public.fulfillment_method, uuid) from public;
grant execute on function public.create_checkout_order(jsonb, text, text, text, jsonb, public.fulfillment_method, uuid) to anon, authenticated;

create or replace function public.admin_bulk_move_canonical_category(
  p_product_ids uuid[],
  p_target_slug text
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_target_id uuid;
  v_expected integer;
  v_found integer;
  v_updated integer;
begin
  if not (select public.is_admin()) then
    raise exception using errcode = '42501', message = 'Only store administrators can move products.';
  end if;

  if p_product_ids is null or coalesce(array_length(p_product_ids, 1), 0) = 0 then
    raise exception using errcode = 'P0001', message = 'Select at least one product.';
  end if;

  select count(distinct id) into v_expected from unnest(p_product_ids) as id;
  if v_expected <> coalesce(array_length(p_product_ids, 1), 0) then
    raise exception using errcode = 'P0001', message = 'Duplicate product selections are not allowed.';
  end if;

  if p_target_slug is null or p_target_slug not in ('foods', 'cosmetics', 'ivoire-market') then
    raise exception using errcode = 'P0001', message = 'Choose Foods, Cosmetics, or Ivoire Market.';
  end if;

  select id into v_target_id
  from public.categories
  where slug = p_target_slug
    and is_active
  for update;

  if v_target_id is null then
    raise exception using errcode = 'P0001', message = 'That category is not available as a bulk destination.';
  end if;

  select count(*) into v_found
  from public.products
  where id = any(p_product_ids);

  if v_found <> v_expected then
    raise exception using errcode = 'P0001', message = 'One or more selected products could not be found. Nothing was moved.';
  end if;

  update public.products
  set category_id = v_target_id
  where id = any(p_product_ids);

  get diagnostics v_updated = row_count;
  if v_updated <> v_expected then
    raise exception using errcode = 'P0001', message = 'The category move could not be completed. Nothing was saved.';
  end if;

  return v_updated;
end;
$$;

revoke all on function public.admin_bulk_move_canonical_category(uuid[], text) from public;
grant execute on function public.admin_bulk_move_canonical_category(uuid[], text) to authenticated;
