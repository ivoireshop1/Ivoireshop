-- Store origin, delivery toggles, package dimensions, and order fulfillment snapshots.
-- Does not change checkout pricing rules or historical totals except by adding nullable columns.

alter table public.store_settings
  add column if not exists origin_name text,
  add column if not exists origin_address_line_1 text,
  add column if not exists origin_address_line_2 text,
  add column if not exists origin_city text,
  add column if not exists origin_state text,
  add column if not exists origin_postal_code text,
  add column if not exists origin_country text,
  add column if not exists origin_phone text,
  add column if not exists pickup_enabled boolean not null default true,
  add column if not exists store_delivery_enabled boolean not null default true,
  add column if not exists doordash_enabled boolean not null default false,
  add column if not exists ups_enabled boolean not null default false,
  add column if not exists usps_enabled boolean not null default false,
  add column if not exists doordash_max_radius_miles numeric(8, 2);

alter table public.products
  add column if not exists ship_weight_lb numeric(10, 3),
  add column if not exists ship_length_in numeric(10, 2),
  add column if not exists ship_width_in numeric(10, 2),
  add column if not exists ship_height_in numeric(10, 2);

alter table public.orders
  add column if not exists fulfillment_provider text,
  add column if not exists fulfillment_service text,
  add column if not exists delivery_snapshot jsonb;

create table if not exists public.delivery_provider_health (
  provider text primary key,
  status text not null default 'unknown',
  last_check_at timestamptz,
  last_error text,
  updated_at timestamptz not null default now()
);

alter table public.delivery_provider_health enable row level security;

drop policy if exists "Admins manage delivery health" on public.delivery_provider_health;
create policy "Admins manage delivery health"
on public.delivery_provider_health for all to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

revoke all on table public.delivery_provider_health from public, anon;
grant select, insert, update, delete on table public.delivery_provider_health to authenticated;

create table if not exists public.delivery_operation_logs (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  operation text not null,
  success boolean not null,
  message text,
  created_at timestamptz not null default now()
);

alter table public.delivery_operation_logs enable row level security;

drop policy if exists "Admins read delivery logs" on public.delivery_operation_logs;
create policy "Admins read delivery logs"
on public.delivery_operation_logs for select to authenticated
using ((select public.is_admin()));

drop policy if exists "Admins insert delivery logs" on public.delivery_operation_logs;
create policy "Admins insert delivery logs"
on public.delivery_operation_logs for insert to authenticated
with check ((select public.is_admin()));

revoke all on table public.delivery_operation_logs from public, anon;
grant select, insert on table public.delivery_operation_logs to authenticated;
