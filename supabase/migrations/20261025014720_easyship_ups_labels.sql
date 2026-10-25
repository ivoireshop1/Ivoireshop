-- Admin UPS label purchases through Easyship. Additive only.
-- Does not change customer shipping charges, payment totals, or existing order rows.
-- Purchases stay off until EASYSHIP_LABEL_PURCHASES=founder-approved on the server.

create table if not exists public.easyship_label_purchases (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  idempotency_key text not null unique,
  status text not null check (status in ('purchasing', 'purchased', 'failed')),
  carrier text not null default 'ups' check (carrier = 'ups'),
  service_name text,
  courier_service_id text,
  customer_shipping_cost numeric(12, 2),
  label_cost numeric(12, 2),
  currency text not null default 'USD',
  easyship_shipment_id text,
  label_document_id text,
  label_state text,
  tracking_number text,
  tracking_url text,
  label_url text,
  label_format text,
  label_pdf_base64 text,
  label_ready boolean not null default false,
  error_message text,
  confirmed_by uuid,
  created_at timestamptz not null default timezone('utc', now()),
  purchased_at timestamptz,
  updated_at timestamptz not null default timezone('utc', now()),
  constraint easyship_label_cost_nonnegative check (label_cost is null or label_cost >= 0)
);

create unique index if not exists easyship_label_one_active_per_order
  on public.easyship_label_purchases (order_id)
  where status in ('purchasing', 'purchased');

create index if not exists easyship_label_purchases_order_idx
  on public.easyship_label_purchases (order_id, created_at desc);

comment on table public.easyship_label_purchases is
  'UPS labels bought by an Admin through Easyship. One purchasing or purchased row per order. Failed attempts stay as history.';

alter table public.easyship_label_purchases enable row level security;

revoke all on table public.easyship_label_purchases from public, anon, authenticated;
grant select, insert, update on table public.easyship_label_purchases to authenticated;

drop policy if exists easyship_label_purchases_admin_select on public.easyship_label_purchases;
create policy easyship_label_purchases_admin_select
  on public.easyship_label_purchases
  for select to authenticated
  using ((select public.is_admin()));

drop policy if exists easyship_label_purchases_admin_insert on public.easyship_label_purchases;
create policy easyship_label_purchases_admin_insert
  on public.easyship_label_purchases
  for insert to authenticated
  with check ((select public.is_admin()));

drop policy if exists easyship_label_purchases_admin_update on public.easyship_label_purchases;
create policy easyship_label_purchases_admin_update
  on public.easyship_label_purchases
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
