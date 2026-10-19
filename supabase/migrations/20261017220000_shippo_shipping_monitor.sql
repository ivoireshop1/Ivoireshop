alter table public.store_settings
  add column if not exists shippo_enabled boolean not null default false,
  add column if not exists shippo_margin_percent numeric(7, 4) not null default 0,
  add column if not exists shippo_international_countries text not null default '',
  add column if not exists shippo_allowed_services text not null default '',
  add column if not exists shippo_allow_manual_fallback boolean not null default false,
  add column if not exists postage_purchases_enabled boolean not null default false,
  add column if not exists packing_slip_watermark_text text not null default 'IVOIRE SHOP',
  add column if not exists packing_slip_logo_url text;

create table if not exists public.shipping_monitor_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (event_type in (
    'quote_failure',
    'missing_parcel',
    'shipping_exception',
    'checkout_quote',
    'label_blocked'
  )),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists shipping_monitor_events_created_idx
  on public.shipping_monitor_events (created_at desc);

alter table public.shipping_monitor_events enable row level security;

drop policy if exists shipping_monitor_events_admin_read on public.shipping_monitor_events;
create policy shipping_monitor_events_admin_read
  on public.shipping_monitor_events for select
  to authenticated
  using (public.is_admin());

drop policy if exists shipping_monitor_events_insert on public.shipping_monitor_events;
create policy shipping_monitor_events_insert
  on public.shipping_monitor_events for insert
  to anon, authenticated
  with check (true);

revoke update, delete on public.shipping_monitor_events from anon, authenticated;
grant select, insert on public.shipping_monitor_events to authenticated;
grant insert on public.shipping_monitor_events to anon;
