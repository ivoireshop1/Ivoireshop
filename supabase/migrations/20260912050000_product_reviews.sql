create table public.product_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  review_text text,
  display_name text not null default 'Customer',
  verified_purchase boolean not null default false,
  status text not null default 'published' check (status in ('published', 'hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, product_id),
  check (review_text is null or char_length(review_text) <= 1000)
);

create index product_reviews_product_status_created_idx
  on public.product_reviews (product_id, status, created_at desc);

create index product_reviews_user_id_idx on public.product_reviews (user_id);

create trigger product_reviews_set_updated_at
before update on public.product_reviews
for each row execute function public.set_updated_at();

alter table public.product_reviews enable row level security;

create policy "Published product reviews are public"
on public.product_reviews for select to anon, authenticated
using (status = 'published' or (select auth.uid()) = user_id or (select public.is_admin()));

create policy "Users delete their own product reviews"
on public.product_reviews for delete to authenticated
using ((select auth.uid()) = user_id);

create policy "Admins manage product reviews"
on public.product_reviews for all to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

revoke all on table public.product_reviews from anon, authenticated;
grant select on table public.product_reviews to anon, authenticated;
grant delete on table public.product_reviews to authenticated;

create or replace function public.submit_product_review(
  p_product_id uuid,
  p_rating integer,
  p_review_text text default null
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
      and orders.payment_status = 'paid'
      and orders.status <> 'cancelled'
  ) into v_verified_purchase;

  insert into public.product_reviews (user_id, product_id, rating, review_text, display_name, verified_purchase)
  values (v_user_id, p_product_id, p_rating, nullif(trim(p_review_text), ''), v_display_name, v_verified_purchase)
  on conflict (user_id, product_id) do update
  set
    rating = excluded.rating,
    review_text = excluded.review_text,
    display_name = excluded.display_name,
    verified_purchase = excluded.verified_purchase,
    updated_at = now();
end;
$$;

revoke all on function public.submit_product_review(uuid, integer, text) from public;
grant execute on function public.submit_product_review(uuid, integer, text) to authenticated;

create or replace view public.product_review_summaries
with (security_invoker = true)
as
select
  product_id,
  round(avg(rating)::numeric, 1) as average_rating,
  count(*)::integer as review_count
from public.product_reviews
where status = 'published'
group by product_id;

grant select on public.product_review_summaries to anon, authenticated;