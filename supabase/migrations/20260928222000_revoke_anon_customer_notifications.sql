-- Guests must not be able to query customer notifications at all.
revoke all on table public.customer_notifications from anon, public;
revoke insert, delete on table public.customer_notifications from authenticated;
grant select, update on table public.customer_notifications to authenticated;
