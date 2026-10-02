-- Snapshot primary product image onto new order items.
-- Refresh progress notification copy. Does not rewrite historical item prices.

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
        'pending',
        'not_collected',
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

create or replace function public.create_customer_order_notification(
  p_order_id uuid,
  p_event_type text,
  p_email_sent boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders%rowtype;
  v_title text;
  v_message text;
  v_pickup boolean;
  v_carrier boolean;
  v_local boolean;
  v_total text;
  v_code text;
  v_id uuid;
  v_caller uuid := auth.uid();
  v_pickup_block text;
  v_track text;
begin
  if p_order_id is null or p_event_type is null then
    return null;
  end if;

  select * into v_order from public.orders where id = p_order_id;
  if not found or v_order.user_id is null then
    return null;
  end if;

  if v_caller is not null
     and v_caller is distinct from v_order.user_id
     and not (select public.is_admin()) then
    raise exception using errcode = '42501', message = 'You cannot create notifications for another customer.';
  end if;

  if p_event_type = 'payment_received' and v_order.payment_status is distinct from 'paid' then
    return null;
  end if;
  if p_event_type = 'payment_failed' and v_order.payment_status is distinct from 'failed' then
    return null;
  end if;
  if p_event_type = 'payment_pending' and v_order.payment_status is distinct from 'pending' then
    return null;
  end if;

  v_pickup := v_order.fulfillment_method = 'local_pickup';
  v_carrier := lower(coalesce(v_order.fulfillment_provider, '')) in ('ups', 'usps');
  v_local := not v_pickup and not v_carrier;
  v_code := coalesce(v_order.confirmation_code, v_order.order_number);
  v_total := '$' || trim(to_char(v_order.total, 'FM999999990.00'));
  v_track := nullif(btrim(coalesce(v_order.tracking_number, '')), '');

  select concat_ws(
    E'\n',
    nullif(btrim(origin_address_line_1), ''),
    nullif(btrim(origin_address_line_2), ''),
    nullif(btrim(concat_ws(' ', nullif(origin_city, '') || case when origin_state is not null and origin_state <> '' then ',' else '' end, origin_state, origin_postal_code)), ''),
    case
      when origin_country in ('US', 'USA') then 'United States'
      else nullif(btrim(origin_country), '')
    end
  )
  into v_pickup_block
  from public.store_settings
  where id = 'default';

  if p_event_type = 'order_confirmed' then
    v_title := 'Order accepted';
    v_message := 'We received your order and the Ivoire Shop team is getting started.'
      || E'\n' || v_code || ' · ' || v_total;
  elsif p_event_type = 'preparing' then
    v_title := 'Preparing your order';
    v_message := 'Your items are now being prepared.';
  elsif p_event_type = 'ready_for_pickup' then
    v_title := 'Ready for pickup';
    v_message := 'Your order is ready for pickup.'
      || case when v_pickup_block is not null then E'\nPickup Location\n' || v_pickup_block else '' end;
  elsif p_event_type = 'ready_for_delivery' then
    v_title := 'Ready for delivery';
    v_message := 'Your order is packed and ready for delivery.';
  elsif p_event_type = 'shipped' then
    v_title := 'Shipped';
    v_message := 'Your order has shipped.'
      || case
        when v_track is not null then
          E'\nCarrier: ' || upper(coalesce(v_order.fulfillment_provider, ''))
          || E'\nTracking number: ' || v_track
        else ''
      end;
  elsif p_event_type = 'out_for_delivery' then
    v_title := 'Out for delivery';
    v_message := 'Your order is on its way.';
  elsif p_event_type = 'tracking_added' then
    v_title := 'Tracking is available';
    v_message := format('Tracking was added for order %s.', v_code)
      || case when v_track is not null then E'\n' || v_track else '' end;
  elsif p_event_type = 'completed' then
    v_title := 'Completed';
    v_message := 'Your order is complete. Thank you for shopping with Ivoire Shop.';
  elsif p_event_type = 'cancelled' then
    v_title := 'Cancelled';
    v_message := 'Your order has been cancelled.';
  elsif p_event_type = 'payment_pending' then
    v_title := 'Payment pending';
    v_message := 'Payment for your order is still pending.';
  elsif p_event_type = 'payment_received' then
    v_title := 'Payment received';
    v_message := format('Payment received for order %s.', v_code);
  elsif p_event_type = 'payment_failed' then
    v_title := 'Payment failed';
    v_message := 'Payment couldn''t be completed. Please review your order.';
  else
    raise exception using errcode = 'P0001', message = 'Unknown notification event.';
  end if;

  insert into public.customer_notifications (
    user_id, order_id, event_type, title, message, confirmation_code, email_sent, email_attempted
  ) values (
    v_order.user_id, v_order.id, p_event_type, v_title, v_message, v_order.confirmation_code, coalesce(p_email_sent, false), true
  )
  on conflict (order_id, user_id, event_type) do update
    set email_sent = public.customer_notifications.email_sent or excluded.email_sent,
        email_attempted = true
  returning id into v_id;

  return v_id;
end;
$$;
