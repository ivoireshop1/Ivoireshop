-- Weight-based selling + fractional order quantities.
-- Defaults preserve existing per-item products. Staging only until founder approves Production.

alter table public.products
  add column if not exists selling_method text not null default 'each'
    check (selling_method in ('each', 'weight', 'fixed_package')),
  add column if not exists selling_unit text not null default 'each'
    check (selling_unit in ('each', 'lb', 'kg', 'oz', 'bag', 'pack')),
  add column if not exists unit_increment numeric(12, 3) not null default 1
    check (unit_increment > 0),
  add column if not exists min_sell_qty numeric(12, 3) not null default 1
    check (min_sell_qty > 0),
  add column if not exists max_sell_qty numeric(12, 3) null
    check (max_sell_qty is null or max_sell_qty >= min_sell_qty),
  add column if not exists package_weight_lb numeric(12, 3) null
    check (package_weight_lb is null or package_weight_lb >= 0);

comment on column public.products.selling_method is
  'Admin-selected selling mode: each (count), weight (lb/kg/oz), or fixed_package.';
comment on column public.products.selling_unit is
  'Unit shown to customers and stored on order lines.';
comment on column public.products.unit_increment is
  'Allowed step size for selectable quantity/weight.';
comment on column public.products.min_sell_qty is
  'Minimum selectable quantity in selling_unit.';
comment on column public.products.max_sell_qty is
  'Optional maximum selectable quantity in selling_unit.';
comment on column public.products.package_weight_lb is
  'Optional packaging tare weight added to Shippo parcel weight.';

-- Allow fractional inventory for weight products; existing integer values cast cleanly.
alter table public.products
  alter column stock_quantity type numeric(12, 3)
  using stock_quantity::numeric(12, 3);

alter table public.order_items
  alter column quantity type numeric(12, 3)
  using quantity::numeric(12, 3);

alter table public.order_items
  add column if not exists selling_unit text null,
  add column if not exists selling_method text null;

comment on column public.order_items.selling_unit is
  'Snapshot of product selling_unit at checkout.';
comment on column public.order_items.selling_method is
  'Snapshot of product selling_method at checkout.';

create or replace function public.create_checkout_order(
  p_items jsonb,
  p_customer_name text,
  p_customer_email text,
  p_customer_phone text,
  p_shipping_address jsonb,
  p_fulfillment_method fulfillment_method,
  p_idempotency_key uuid,
  p_is_demo boolean default false
)
returns table (
  order_id uuid,
  order_number text,
  status order_status,
  total numeric,
  confirmation_code text,
  guest_access_token text,
  payment_status payment_status,
  fulfillment_method fulfillment_method,
  customer_email text,
  customer_name text,
  payment_method text,
  payment_provider text
)
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_user_id uuid := auth.uid();
  v_item jsonb;
  v_product_id uuid;
  v_quantity numeric(12, 3);
  v_product public.products%rowtype;
  v_product_name text;
  v_product_price numeric(12, 2);
  v_image_url text;
  v_selling_method text;
  v_selling_unit text;
  v_subtotal numeric(12, 2) := 0;
  v_order public.orders%rowtype;
  v_existing public.orders%rowtype;
  v_attempt integer;
  v_demo boolean := coalesce(p_is_demo, false);
  v_increment numeric(12, 3);
  v_min numeric(12, 3);
  v_max numeric(12, 3);
  v_steps numeric;
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
       or coalesce(v_item ->> 'quantity', '') !~ '^[0-9]+(\.[0-9]{1,3})?$'
       or (v_item ->> 'quantity')::numeric <= 0 then
      raise exception using errcode = 'P0001', message = 'Your cart contains an invalid item.';
    end if;

    v_product_id := (v_item ->> 'product_id')::uuid;
    v_quantity := round((v_item ->> 'quantity')::numeric, 3);

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

    v_increment := coalesce(nullif(v_product.unit_increment, 0), 1);
    v_min := coalesce(nullif(v_product.min_sell_qty, 0), v_increment);
    v_max := v_product.max_sell_qty;

    if coalesce(v_product.selling_method, 'each') = 'each' then
      if v_quantity <> trunc(v_quantity) then
        raise exception using errcode = 'P0001', message = 'Your cart contains an invalid item.';
      end if;
    end if;

    if v_quantity < v_min or (v_max is not null and v_quantity > v_max) then
      raise exception using errcode = 'P0001', message = 'Some items are outside the allowed quantity.';
    end if;

    v_steps := round((v_quantity - v_min) / v_increment, 6);
    if abs(v_steps - round(v_steps)) > 0.000001 then
      raise exception using errcode = 'P0001', message = 'Some items use an invalid quantity step.';
    end if;

    if not v_demo and coalesce(v_product.track_inventory, true) then
      if v_product.stock_quantity is null or v_product.stock_quantity < v_quantity then
        raise exception using errcode = 'P0001', message = 'Some items are no longer available in the requested quantity.';
      end if;

      update public.products
      set stock_quantity = stock_quantity - v_quantity
      where id = v_product.id;
    end if;

    v_subtotal := v_subtotal + round(v_product.price * v_quantity, 2);
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
    v_quantity := round((v_item ->> 'quantity')::numeric, 3);

    select name, price, coalesce(selling_method, 'each'), coalesce(selling_unit, 'each')
      into v_product_name, v_product_price, v_selling_method, v_selling_unit
    from public.products
    where id = v_product_id;

    select pi.image_url into v_image_url
    from public.product_images pi
    where pi.product_id = v_product_id
    order by pi.position
    limit 1;

    insert into public.order_items (
      order_id, product_id, product_name, product_price, quantity, image_url, selling_method, selling_unit
    )
    values (
      v_order.id,
      v_product_id,
      v_product_name,
      v_product_price,
      v_quantity,
      v_image_url,
      v_selling_method,
      v_selling_unit
    );
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
$function$;

grant execute on function public.create_checkout_order(
  jsonb, text, text, text, jsonb, fulfillment_method, uuid, boolean
) to anon, authenticated, service_role;
