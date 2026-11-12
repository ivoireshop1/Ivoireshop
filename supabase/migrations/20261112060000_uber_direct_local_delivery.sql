-- Uber Direct local delivery records. Quotes and courier bookings stay server-side.
-- Production dispatch remains off until an administrator and the server flag both allow it.

alter table public.store_settings
  add column if not exists uber_direct_enabled boolean not null default false,
  add column if not exists uber_direct_show_at_checkout boolean not null default false,
  add column if not exists uber_direct_markup_cents integer not null default 0,
  add column if not exists uber_direct_production_dispatch boolean not null default false;

alter table public.store_settings
  drop constraint if exists store_settings_uber_markup_nonnegative;
alter table public.store_settings
  add constraint store_settings_uber_markup_nonnegative check (uber_direct_markup_cents >= 0);

create table if not exists public.uber_deliveries (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  idempotency_key text not null unique,
  environment text not null,
  quote_id text,
  delivery_id text unique,
  status text not null default 'accepted',
  tracking_url text,
  fee_cents integer,
  markup_cents integer,
  currency text,
  courier_name text,
  courier_phone text,
  courier_vehicle text,
  dropoff_eta timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.uber_webhook_events (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique,
  event_kind text,
  delivery_id text,
  received_at timestamptz not null default now()
);

alter table public.uber_deliveries enable row level security;
alter table public.uber_webhook_events enable row level security;

drop policy if exists "Admins manage Uber deliveries" on public.uber_deliveries;
create policy "Admins manage Uber deliveries"
on public.uber_deliveries for all to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

drop policy if exists "Customers read their Uber deliveries" on public.uber_deliveries;
create policy "Customers read their Uber deliveries"
on public.uber_deliveries for select to authenticated
using (exists (
  select 1 from public.orders
  where orders.id = uber_deliveries.order_id
    and orders.user_id = (select auth.uid())
));

drop policy if exists "Admins read Uber webhook events" on public.uber_webhook_events;
create policy "Admins read Uber webhook events"
on public.uber_webhook_events for select to authenticated
using ((select public.is_admin()));

revoke all on table public.uber_deliveries from public, anon;
revoke all on table public.uber_webhook_events from public, anon;
grant select on table public.uber_deliveries to authenticated;
grant select, insert, update, delete on table public.uber_deliveries to authenticated;
grant select on table public.uber_webhook_events to authenticated;

alter table public.uber_deliveries replica identity full;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      execute 'alter publication supabase_realtime add table public.uber_deliveries';
    exception when duplicate_object then null;
    end;
  end if;
end;
$$;
