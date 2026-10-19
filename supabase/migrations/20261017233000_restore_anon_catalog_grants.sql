-- Staging grant repair: table privileges were left as REFERENCES/TRIGGER/TRUNCATE
-- without SELECT/DML, so RLS policies could never allow catalog reads.
-- Privileges only; RLS policies are unchanged.

grant usage on schema public to anon, authenticated, service_role;

grant select on table
  public.categories,
  public.products,
  public.product_images,
  public.storefront_announcements
to anon, authenticated;

grant insert, update, delete on table
  public.categories,
  public.products,
  public.product_images,
  public.storefront_announcements
to authenticated;

grant select, insert, update, delete on table
  public.profiles,
  public.addresses,
  public.wishlist_items
to authenticated;

grant select on table
  public.orders,
  public.order_items
to authenticated;

grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant all on all functions in schema public to service_role;
