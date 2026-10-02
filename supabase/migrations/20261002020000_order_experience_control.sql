-- Order line image snapshots, first-welcome + sound preference,
-- status history, richer progress notifications.
-- Does not rewrite historical prices, tax, shipping, or totals.

alter table public.order_items
  add column if not exists image_url text;

alter table public.profiles
  add column if not exists notification_sounds boolean not null default true,
  add column if not exists welcome_completed_at timestamptz;

update public.profiles
set welcome_completed_at = coalesce(welcome_completed_at, created_at, timezone('utc', now()))
where welcome_completed_at is null;

create table if not exists public.order_status_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  status text not null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (order_id, status)
);

create index if not exists order_status_events_order_idx
  on public.order_status_events (order_id, created_at);

alter table public.order_status_events enable row level security;

revoke all on table public.order_status_events from public, anon;
grant select on table public.order_status_events to authenticated;
grant insert on table public.order_status_events to authenticated;

drop policy if exists "Customers read own order status events" on public.order_status_events;
create policy "Customers read own order status events"
on public.order_status_events for select to authenticated
using (
  (select public.is_admin())
  or exists (
    select 1 from public.orders o
    where o.id = order_id
      and o.user_id = (select auth.uid())
  )
);

drop policy if exists "Admins insert order status events" on public.order_status_events;
create policy "Admins insert order status events"
on public.order_status_events for insert to authenticated
with check ((select public.is_admin()));

create or replace function public.record_order_status_event()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.order_status_events (order_id, status, created_at)
  values (new.id, new.status::text, timezone('utc', now()))
  on conflict (order_id, status) do nothing;
  return new;
end;
$$;

drop trigger if exists orders_record_status_event on public.orders;
create trigger orders_record_status_event
after insert or update of status on public.orders
for each row execute function public.record_order_status_event();

insert into public.order_status_events (order_id, status, created_at)
select id, 'shipped', shipped_at from public.orders
where shipped_at is not null
on conflict (order_id, status) do nothing;

alter table public.customer_notifications
  drop constraint if exists customer_notifications_event_type_check;

alter table public.customer_notifications
  add constraint customer_notifications_event_type_check check (event_type in (
    'order_confirmed',
    'preparing',
    'ready_for_pickup',
    'ready_for_delivery',
    'out_for_delivery',
    'shipped',
    'tracking_added',
    'completed',
    'cancelled',
    'payment_pending',
    'payment_received',
    'payment_failed'
  ));
