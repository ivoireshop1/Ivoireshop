-- Keep moderated reviews submitting without crashing the storefront.
-- Recreate the 4-arg RPC if an older 3-arg overload is still present.
-- Does not weaken RLS.

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
