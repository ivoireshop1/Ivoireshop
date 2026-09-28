-- Confirmation codes, guest access tokens, and payment provider identifiers.
-- Does not rewrite create_checkout_order pricing/inventory rules or historical totals.

create or replace function public.generate_order_confirmation_code()
returns text
language plpgsql
volatile
set search_path = public, pg_temp
as $$
declare
  alphabet constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  raw bytea;
  candidate text;
  i integer;
  attempt integer := 0;
begin
  loop
    attempt := attempt + 1;
    if attempt > 32 then
      raise exception using errcode = 'P0001', message = 'Unable to allocate a confirmation code.';
    end if;
    raw := decode(replace(gen_random_uuid()::text, '-', ''), 'hex');
    candidate := 'IVO-';
    for i in 0..4 loop
      candidate := candidate || substr(alphabet, (get_byte(raw, i) % char_length(alphabet)) + 1, 1);
    end loop;
    exit when char_length(candidate) = 9
      and not exists (select 1 from public.orders where confirmation_code = candidate);
  end loop;
  return candidate;
end;
$$;

revoke all on function public.generate_order_confirmation_code() from public, anon, authenticated;

alter table public.orders
  add column if not exists confirmation_code text,
  add column if not exists guest_access_token text,
  add column if not exists payment_provider text,
  add column if not exists provider_order_id text,
  add column if not exists provider_payment_id text,
  add column if not exists email_sent_at timestamptz,
  add column if not exists email_attempted_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'orders_payment_provider_check'
  ) then
    alter table public.orders
      add constraint orders_payment_provider_check
      check (payment_provider is null or payment_provider in ('square', 'paypal'));
  end if;
end $$;

do $$
declare
  rec record;
begin
  for rec in
    select id from public.orders
    where confirmation_code is null or guest_access_token is null
  loop
    update public.orders
    set
      confirmation_code = coalesce(confirmation_code, public.generate_order_confirmation_code()),
      guest_access_token = coalesce(guest_access_token, replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''))
    where id = rec.id;
  end loop;
end $$;

alter table public.orders
  alter column confirmation_code set not null,
  alter column guest_access_token set not null;

create unique index if not exists orders_confirmation_code_key
  on public.orders (confirmation_code);

create unique index if not exists orders_guest_access_token_key
  on public.orders (guest_access_token);

create table if not exists public.payment_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('square', 'paypal')),
  provider_event_id text not null,
  order_id uuid references public.orders(id) on delete set null,
  processed_at timestamptz not null default now(),
  unique (provider, provider_event_id)
);

alter table public.payment_events enable row level security;

revoke all on table public.payment_events from public, anon, authenticated;

drop function if exists public.create_checkout_order(jsonb, text, text, text, jsonb, public.fulfillment_method, uuid);

create function public.create_checkout_order(
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

    insert into public.order_items (order_id, product_id, product_name, product_price, quantity)
    values (v_order.id, v_product_id, v_product_name, v_product_price, v_quantity);
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

revoke all on function public.create_checkout_order(jsonb, text, text, text, jsonb, public.fulfillment_method, uuid) from public;
grant execute on function public.create_checkout_order(jsonb, text, text, text, jsonb, public.fulfillment_method, uuid) to anon, authenticated;

create or replace function public.get_session_checkout_order(p_idempotency_key uuid)
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
  payment_provider text,
  provider_order_id text,
  provider_payment_id text
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_order public.orders%rowtype;
begin
  if p_idempotency_key is null then
    return;
  end if;

  select * into v_order
  from public.orders
  where checkout_idempotency_key = p_idempotency_key;

  if not found or v_order.user_id is distinct from v_user_id then
    return;
  end if;

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
    v_order.payment_provider,
    v_order.provider_order_id,
    v_order.provider_payment_id;
end;
$$;

revoke all on function public.get_session_checkout_order(uuid) from public;
grant execute on function public.get_session_checkout_order(uuid) to anon, authenticated;

create or replace function public.set_session_checkout_provider(p_idempotency_key uuid, p_provider text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_order public.orders%rowtype;
begin
  if p_provider not in ('square', 'paypal') then
    raise exception using errcode = 'P0001', message = 'Choose Square or PayPal.';
  end if;
  if p_idempotency_key is null then
    raise exception using errcode = 'P0001', message = 'A checkout key is required.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_idempotency_key::text, 0));

  select * into v_order
  from public.orders
  where checkout_idempotency_key = p_idempotency_key;

  if not found then
    raise exception using errcode = 'P0001', message = 'We could not find that checkout.';
  end if;
  if v_order.user_id is distinct from v_user_id then
    raise exception using errcode = 'P0001', message = 'This checkout belongs to a different session.';
  end if;
  if v_order.payment_status = 'paid' then
    return;
  end if;

  update public.orders
  set
    payment_provider = p_provider,
    payment_method = p_provider,
    updated_at = now()
  where id = v_order.id
    and payment_status in ('pending', 'failed', 'cancelled');
end;
$$;

revoke all on function public.set_session_checkout_provider(uuid, text) from public;
grant execute on function public.set_session_checkout_provider(uuid, text) to anon, authenticated;

create or replace function public.get_checkout_confirmation(p_access_token text)
returns table (
  order_id uuid,
  order_number text,
  confirmation_code text,
  status public.order_status,
  payment_status public.payment_status,
  payment_method text,
  payment_provider text,
  fulfillment_method public.fulfillment_method,
  customer_email text,
  customer_name text,
  total numeric(12, 2),
  subtotal numeric(12, 2),
  shipping_cost numeric(12, 2),
  discount_amount numeric(12, 2),
  shipping_address jsonb,
  created_at timestamptz,
  items jsonb
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if p_access_token is null
     or length(p_access_token) <> 64
     or p_access_token !~ '^[0-9a-f]+$' then
    return;
  end if;

  return query
  select
    o.id,
    o.order_number,
    o.confirmation_code,
    o.status,
    o.payment_status,
    o.payment_method,
    o.payment_provider,
    o.fulfillment_method,
    o.customer_email,
    o.customer_name,
    o.total,
    o.subtotal,
    o.shipping_cost,
    o.discount_amount,
    o.shipping_address,
    o.created_at,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'product_name', i.product_name,
        'product_price', i.product_price,
        'quantity', i.quantity
      ) order by i.created_at)
      from public.order_items i
      where i.order_id = o.id
    ), '[]'::jsonb)
  from public.orders o
  where o.guest_access_token = p_access_token;
end;
$$;

revoke all on function public.get_checkout_confirmation(text) from public;
grant execute on function public.get_checkout_confirmation(text) to anon, authenticated;

-- Confirmation code alone must never be a public lookup key.
create or replace function public.lookup_order_by_confirmation_code(p_code text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  raise exception using errcode = '42501', message = 'Confirmation codes cannot be used as a public order lookup.';
end;
$$;

revoke all on function public.lookup_order_by_confirmation_code(text) from public, anon, authenticated;
