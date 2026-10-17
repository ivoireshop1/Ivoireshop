-- Demo checkout for presentations. Additive and reversible.
-- Does not mark demo orders as Stripe-paid. Default is OFF.

alter table public.store_settings
  add column if not exists demo_payment_enabled boolean not null default false;

alter table public.orders
  add column if not exists is_demo boolean not null default false;

create index if not exists orders_is_demo_idx on public.orders (created_at desc) where is_demo;

alter table public.orders drop constraint if exists orders_payment_provider_check;
alter table public.orders
  add constraint orders_payment_provider_check
  check (payment_provider is null or payment_provider in ('square', 'paypal', 'stripe', 'demo'));

alter table public.payment_events drop constraint if exists payment_events_provider_check;
alter table public.payment_events
  add constraint payment_events_provider_check
  check (provider in ('square', 'paypal', 'stripe', 'demo'));

do $$
begin
  if not exists (
    select 1 from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'payment_status' and e.enumlabel = 'demo'
  ) then
    alter type public.payment_status add value 'demo';
  end if;
end $$;
