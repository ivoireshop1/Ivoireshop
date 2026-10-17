-- Demo checkout must never decrement sellable stock, even briefly.
-- Applied in a separate file from the enum add so payment_status 'demo' is committed first.

create or replace function public.restore_order_inventory(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_item record;
begin
  update public.orders
  set inventory_restored = true, updated_at = now()
  where id = p_order_id
    and inventory_restored = false
    and coalesce(is_demo, false) = false
    and payment_status is distinct from 'demo'
    and payment_provider is distinct from 'demo'
    and payment_status is distinct from 'paid'
    and payment_status is distinct from 'partially_refunded';
  if not found then
    return;
  end if;

  for v_item in
    select oi.product_id, oi.quantity, p.track_inventory
    from public.order_items oi
    join public.products p on p.id = oi.product_id
    where oi.order_id = p_order_id
  loop
    if coalesce(v_item.track_inventory, true) then
      update public.products
      set stock_quantity = coalesce(stock_quantity, 0) + v_item.quantity
      where id = v_item.product_id;
    end if;
  end loop;
end;
$$;

revoke all on function public.restore_order_inventory(uuid) from public, anon, authenticated;
grant execute on function public.restore_order_inventory(uuid) to service_role;

drop function if exists public.create_checkout_order(jsonb, text, text, text, jsonb, public.fulfillment_method, uuid);

create function public.create_checkout_order(
  p_items jsonb,
  p_customer_name text,
  p_customer_email text,
  p_customer_phone text,
  p_shipping_address jsonb,
  p_fulfillment_method public.fulfillment_method,
  p_idempotency_key uuid,
  p_is_demo boolean default false
)
returns table (
  order_id uuid,
  order_number text,
  status public.order_status,
  total numeric(12, 2),
  confirmation_code text,
  guest_access_token text,
  payment_status public.payment_status,
  fulfillment_method public.fulfillment_method,
  customer_email text,
  customer_name text,
  payment_method text,
  payment_provider text
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
  v_image_url text;
  v_subtotal numeric(12, 2) := 0;
  v_order public.orders%rowtype;
  v_existing public.orders%rowtype;
  v_attempt integer;
  v_demo boolean := coalesce(p_is_demo, false);
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
    if coalesce(v_existing.is_demo, false) is distinct from v_demo then
      raise exception using errcode = 'P0001', message = 'This checkout was started with a different payment method.';
    end if;
    return query select
      v_existing.id,
      v_existing.order_number,
      v_existing.status,
      v_existing.total,
      v_existing.confirmation_code,
      v_existing.guest_access_token,
      v_existing.payment_status,
      v_existing.fulfillment_method,
      v_existing.customer_email,
      v_existing.customer_name,
      v_existing.payment_method,
      v_existing.payment_provider;
    return;
  end if;

  if v_demo and not exists (
    select 1 from public.store_settings where id = 'default' and demo_payment_enabled = true
  ) then
    raise exception using errcode = 'P0001', message = 'Demo payment is turned off.';
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

    if v_demo then
      select p.* into v_product
      from public.products p
      join public.categories c on c.id = p.category_id
      where p.id = v_product_id
        and p.is_active
        and c.is_active;
    else
      select p.* into v_product
      from public.products p
      join public.categories c on c.id = p.category_id
      where p.id = v_product_id
        and p.is_active
        and c.is_active
      for update of p;
    end if;

    if not found then
      raise exception using errcode = 'P0001', message = 'A product in your cart is no longer available.';
    end if;

    if v_product.price is null or v_product.price = 'NaN'::numeric or v_product.price <= 0 then
      raise exception using errcode = 'P0001', message = 'A product in your cart is no longer available.';
    end if;

    if not v_demo and coalesce(v_product.track_inventory, true) then
      if v_product.stock_quantity is null or v_product.stock_quantity < v_quantity then
        raise exception using errcode = 'P0001', message = 'Some items are no longer available in the requested quantity.';
      end if;

      update public.products
      set stock_quantity = stock_quantity - v_quantity
      where id = v_product.id;
    end if;

    v_subtotal := v_subtotal + (v_product.price * v_quantity);
  end loop;

  for v_attempt in 1..16 loop
    begin
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
        payment_provider,
        is_demo,
        inventory_restored,
        amount_paid,
        fulfillment_method,
        subtotal,
        shipping_cost,
        discount_amount,
        total,
        shipping_address,
        confirmation_code,
        guest_access_token
      ) values (
        'IV-' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6)),
        p_idempotency_key,
        v_user_id,
        lower(btrim(p_customer_email)),
        btrim(p_customer_name),
        nullif(btrim(p_customer_phone), ''),
        'pending',
        case when v_demo then 'demo'::public.payment_status else 'pending'::public.payment_status end,
        case when v_demo then 'demo' else 'not_collected' end,
        case when v_demo then 'demo' else null end,
        v_demo,
        v_demo,
        0,
        p_fulfillment_method,
        v_subtotal,
        0,
        0,
        v_subtotal,
        p_shipping_address,
        public.generate_order_confirmation_code(),
        replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')
      )
      returning * into v_order;
      exit;
    exception
      when unique_violation then
        if v_attempt = 16 then
          raise;
        end if;
    end;
  end loop;

  for v_item in select value from jsonb_array_elements(p_items) order by value ->> 'product_id'
  loop
    v_product_id := (v_item ->> 'product_id')::uuid;
    v_quantity := (v_item ->> 'quantity')::integer;

    select name, price into v_product_name, v_product_price
    from public.products
    where id = v_product_id;

    select pi.image_url into v_image_url
    from public.product_images pi
    where pi.product_id = v_product_id
    order by pi.position
    limit 1;

    insert into public.order_items (order_id, product_id, product_name, product_price, quantity, image_url)
    values (v_order.id, v_product_id, v_product_name, v_product_price, v_quantity, v_image_url);
  end loop;

  return query select
    v_order.id,
    v_order.order_number,
    v_order.status,
    v_order.total,
    v_order.confirmation_code,
    v_order.guest_access_token,
    v_order.payment_status,
    v_order.fulfillment_method,
    v_order.customer_email,
    v_order.customer_name,
    v_order.payment_method,
    v_order.payment_provider;
end;
$$;

revoke all on function public.create_checkout_order(jsonb, text, text, text, jsonb, public.fulfillment_method, uuid, boolean) from public;
grant execute on function public.create_checkout_order(jsonb, text, text, text, jsonb, public.fulfillment_method, uuid, boolean) to anon, authenticated;
