-- Fix locally reproduced invalid orders; preserve the existing RPC and RLS.
-- Public catalog policies already call this read-only helper. An anonymous
-- session has no auth.uid(), so it returns false and grants no admin privileges.
grant execute on function public.is_admin() to anon;

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

  -- Serialize retries with the same key before any inventory lock is taken.
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

  -- Each row is locked before its stock is decremented. Any raised exception
  -- aborts the full function transaction, including prior decrements/inserts.
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

    if v_product.stock_quantity is null or v_product.stock_quantity < v_quantity then
      raise exception using errcode = 'P0001', message = 'Some items are no longer available in the requested quantity.';
    end if;

    update public.products
    set stock_quantity = stock_quantity - v_quantity
    where id = v_product.id;

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
