-- Storage bucket and policies for product images
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

create policy "Product images are publicly accessible"
on storage.objects for select to public
using (bucket_id = 'product-images');

create policy "Admins can upload product images"
on storage.objects for insert to authenticated
with check (bucket_id = 'product-images' and (select public.is_admin()));

create policy "Admins can update product images"
on storage.objects for update to authenticated
using (bucket_id = 'product-images' and (select public.is_admin()));

create policy "Admins can delete product images"
on storage.objects for delete to authenticated
using (bucket_id = 'product-images' and (select public.is_admin()));

