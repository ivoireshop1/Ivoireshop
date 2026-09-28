-- New Arrival / Coming Soon merchandising flags and public Coming Soon visibility.
-- Additive. Does not reset catalog or weaken admin-only product writes.

alter table public.products add column if not exists is_new_arrival boolean not null default false;
alter table public.products add column if not exists is_coming_soon boolean not null default false;

drop policy if exists "Active products are public" on public.products;
create policy "Active products are public"
on public.products for select to anon, authenticated
using (
  (
    is_active
    and exists (
      select 1 from public.categories
      where categories.id = products.category_id and categories.is_active
    )
  )
  or (
    is_coming_soon
    and not is_active
    and exists (
      select 1 from public.categories
      where categories.id = products.category_id and categories.is_active
    )
    and exists (
      select 1 from public.product_images
      where product_images.product_id = products.id
        and product_images.image_url is not null
        and length(trim(product_images.image_url)) > 0
    )
  )
  or (select public.is_admin())
);

drop policy if exists "Images for active products are public" on public.product_images;
create policy "Images for active products are public"
on public.product_images for select to anon, authenticated
using (
  exists (
    select 1
    from public.products
    join public.categories on categories.id = products.category_id
    where products.id = product_images.product_id
      and categories.is_active
      and (
        products.is_active
        or (products.is_coming_soon and not products.is_active)
      )
  )
  or (select public.is_admin())
);
