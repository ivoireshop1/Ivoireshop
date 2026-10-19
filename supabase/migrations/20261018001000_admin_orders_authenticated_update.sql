-- Authenticated previously had SELECT only on orders. Admin RLS already allows
-- is_admin() ALL, but Postgres still denied UPDATE, so Accept/Preparing returned 0 rows.
grant update on table public.orders to authenticated;
revoke update on table public.orders from anon, public;
