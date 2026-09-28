-- Canonical storefront categories. Idempotent. Preserves historical category rows.
-- Does not reactivate inactive products.

insert into public.categories (name, slug, description, is_active)
values
  ('Cosmetics', 'cosmetics', 'Beauty and personal-care merchandise.', true),
  ('Foods', 'foods', 'Food and grocery products.', true),
  ('Ivoire Market', 'ivoire-market', 'General market merchandise.', true)
on conflict (slug) do update
set
  name = excluded.name,
  is_active = true,
  description = coalesce(public.categories.description, excluded.description);

update public.products
set category_id = (select id from public.categories where slug = 'foods')
where category_id in (
  select id from public.categories
  where slug in (
    'rice-grains',
    'african-foods',
    'fresh-produce',
    'oils-cooking',
    'spices-seasoning',
    'drinks',
    'snacks'
  )
  or name ~* 'rice|grain|food|produce|oil|spice|season|drink|snack|grocery|fufu|couscous'
);

update public.products
set category_id = (select id from public.categories where slug = 'cosmetics')
where category_id in (
  select id from public.categories
  where slug in ('beauty-personal-care', 'cosmetics')
     or name ~* 'beauty|cosmetic|personal care'
)
and category_id is distinct from (select id from public.categories where slug = 'cosmetics');

update public.products
set category_id = (select id from public.categories where slug = 'ivoire-market')
where category_id is not null
  and category_id not in (select id from public.categories where slug in ('cosmetics', 'foods', 'ivoire-market'));

update public.categories
set is_active = false
where slug not in ('cosmetics', 'foods', 'ivoire-market');

update public.categories
set is_active = true, name = 'Cosmetics'
where slug = 'cosmetics';

update public.categories
set is_active = true, name = 'Foods'
where slug = 'foods';

update public.categories
set is_active = true, name = 'Ivoire Market'
where slug = 'ivoire-market';
