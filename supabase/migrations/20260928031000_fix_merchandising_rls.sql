-- Fix merchandising RLS recursion: products must not query product_images in the same policy cycle.

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
