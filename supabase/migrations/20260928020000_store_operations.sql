-- Store open/closed control, moderated reviews, and checkout enforcement.
-- Additive and idempotent. Does not reset catalog or historical orders.

create table if not exists public.store_settings (
  id text primary key,
  is_open boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

insert into public.store_settings (id, is_open)
values ('default', true)
on conflict (id) do nothing;

alter table public.store_settings enable row level security;

drop policy if exists "Store settings are readable" on public.store_settings;
create policy "Store settings are readable"
on public.store_settings for select to anon, authenticated
using (true);

drop policy if exists "Admins update store settings" on public.store_settings;
create policy "Admins update store settings"
on public.store_settings for all to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

revoke all on table public.store_settings from anon, authenticated;
grant select on table public.store_settings to anon, authenticated;
grant insert, update on table public.store_settings to authenticated;

do $$
begin
  if to_regclass('public.product_reviews') is null then
    return;
  end if;

  alter table public.product_reviews add column if not exists review_title text;
  alter table public.product_reviews drop constraint if exists product_reviews_review_title_check;
  alter table public.product_reviews add constraint product_reviews_review_title_check
    check (review_title is null or char_length(review_title) <= 120);

  alter table public.product_reviews drop constraint if exists product_reviews_status_check;
  alter table public.product_reviews add constraint product_reviews_status_check
    check (status in ('pending', 'published', 'hidden'));
  alter table public.product_reviews alter column status set default 'pending';
end
$$;

drop function if exists public.submit_product_review(uuid, integer, text);

create or replace function public.submit_product_review(
  p_product_id uuid,
  p_rating integer,
  p_review_text text default null,
  p_review_title text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_display_name text;
  v_verified_purchase boolean;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Sign in to submit a review.';
  end if;

  if p_rating not between 1 and 5 then
    raise exception using errcode = '22023', message = 'Rating must be between 1 and 5.';
  end if;

  if p_review_text is not null and char_length(trim(p_review_text)) > 1000 then
    raise exception using errcode = '22023', message = 'Review text must be 1,000 characters or fewer.';
  end if;

  if p_review_title is not null and char_length(trim(p_review_title)) > 120 then
    raise exception using errcode = '22023', message = 'Review title must be 120 characters or fewer.';
  end if;

  if not exists (select 1 from public.products where id = p_product_id) then
    raise exception using errcode = 'P0002', message = 'Product not found.';
  end if;

  select coalesce(nullif(left(trim(split_part(full_name, ' ', 1)), 80), ''), 'Customer')
  into v_display_name
  from public.profiles
  where id = v_user_id;

  v_display_name := coalesce(v_display_name, 'Customer');

  select exists (
    select 1
    from public.orders
    join public.order_items on order_items.order_id = orders.id
    where orders.user_id = v_user_id
      and order_items.product_id = p_product_id
      and orders.status <> 'cancelled'
  ) into v_verified_purchase;

  insert into public.product_reviews (user_id, product_id, rating, review_text, review_title, display_name, verified_purchase, status)
  values (
    v_user_id,
    p_product_id,
    p_rating,
    nullif(trim(p_review_text), ''),
    nullif(trim(p_review_title), ''),
    v_display_name,
    v_verified_purchase,
    'pending'
  )
  on conflict (user_id, product_id) do update
  set
    rating = excluded.rating,
    review_text = excluded.review_text,
    review_title = excluded.review_title,
    display_name = excluded.display_name,
    verified_purchase = excluded.verified_purchase,
    status = 'pending',
    updated_at = now();
end;
$$;

revoke all on function public.submit_product_review(uuid, integer, text, text) from public;
grant execute on function public.submit_product_review(uuid, integer, text, text) to authenticated;

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
