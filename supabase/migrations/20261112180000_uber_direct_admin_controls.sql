-- Uber Direct admin controls: distance guidance, quote/connection history.
-- Does not weaken RLS. Secrets stay in hosting env, never in these tables.

alter table public.store_settings
  add column if not exists uber_direct_min_miles numeric(8, 2),
  add column if not exists uber_direct_max_miles numeric(8, 2);

alter table public.store_settings
  drop constraint if exists store_settings_uber_min_miles_range;
alter table public.store_settings
  add constraint store_settings_uber_min_miles_range
  check (uber_direct_min_miles is null or (uber_direct_min_miles >= 0 and uber_direct_min_miles <= 500));

alter table public.store_settings
  drop constraint if exists store_settings_uber_max_miles_range;
alter table public.store_settings
  add constraint store_settings_uber_max_miles_range
  check (uber_direct_max_miles is null or (uber_direct_max_miles >= 0 and uber_direct_max_miles <= 500));

alter table public.store_settings
  drop constraint if exists store_settings_uber_miles_order;
alter table public.store_settings
  add constraint store_settings_uber_miles_order
  check (
    uber_direct_min_miles is null
    or uber_direct_max_miles is null
    or uber_direct_min_miles <= uber_direct_max_miles
  );

create table if not exists public.uber_quote_events (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  message text,
  fee_cents integer,
  markup_cents integer,
  environment text,
  source text not null default 'system',
  created_at timestamptz not null default now(),
  constraint uber_quote_events_kind_check check (kind in ('quote_success', 'quote_failure', 'connection_check', 'admin_quote')),
  constraint uber_quote_events_source_check check (source in ('checkout', 'admin', 'system'))
);

create index if not exists uber_quote_events_created_at_idx
  on public.uber_quote_events (created_at desc);

alter table public.uber_quote_events enable row level security;

drop policy if exists "Admins read Uber quote events" on public.uber_quote_events;
create policy "Admins read Uber quote events"
on public.uber_quote_events for select to authenticated
using ((select public.is_admin()));

drop policy if exists "Admins insert Uber quote events" on public.uber_quote_events;
create policy "Admins insert Uber quote events"
on public.uber_quote_events for insert to authenticated
with check ((select public.is_admin()));

revoke all on table public.uber_quote_events from public, anon;
grant select, insert on table public.uber_quote_events to authenticated;
