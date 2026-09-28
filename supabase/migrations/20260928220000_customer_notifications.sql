-- In-app customer order notifications.
-- Guests never receive rows. Customers can only read/mark their own.
-- Inserts go through create_customer_order_notification so user_id always
-- comes from the stored order, not from the client.

create table public.customer_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  event_type text not null,
  title text not null,
  message text not null,
  confirmation_code text,
  email_sent boolean not null default false,
  email_attempted boolean not null default false,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint customer_notifications_event_type_check check (event_type in (
    'order_confirmed',
    'preparing',
    'ready_for_pickup',
    'out_for_delivery',
    'completed',
    'cancelled',
    'payment_pending',
    'payment_received',
    'payment_failed'
  )),
  constraint customer_notifications_unique_event unique (order_id, user_id, event_type)
);

create index customer_notifications_user_created_idx
  on public.customer_notifications (user_id, created_at desc);
create index customer_notifications_user_unread_idx
  on public.customer_notifications (user_id)
  where read_at is null;
create index customer_notifications_order_idx
  on public.customer_notifications (order_id, created_at);

alter table public.customer_notifications enable row level security;

grant select, update on table public.customer_notifications to authenticated;
revoke all on table public.customer_notifications from anon, public;
revoke insert, delete on table public.customer_notifications from authenticated;

create policy "Customers read their own notifications"
on public.customer_notifications for select to authenticated
using ((select auth.uid()) = user_id or (select public.is_admin()));

create policy "Customers mark their own notifications read"
on public.customer_notifications for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Admins inspect notifications"
on public.customer_notifications for all to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create or replace function public.customer_notifications_protect_columns()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE'
     and current_user not in ('postgres', 'supabase_admin')
     and (
       new.id is distinct from old.id
       or new.user_id is distinct from old.user_id
       or new.order_id is distinct from old.order_id
       or new.event_type is distinct from old.event_type
       or new.title is distinct from old.title
       or new.message is distinct from old.message
       or new.confirmation_code is distinct from old.confirmation_code
       or new.email_sent is distinct from old.email_sent
       or new.email_attempted is distinct from old.email_attempted
       or new.created_at is distinct from old.created_at
     )
     and not (select public.is_admin()) then
    raise exception using errcode = '42501', message = 'Notifications can only be marked read.';
  end if;
  if tg_op = 'UPDATE' and new.read_at is not null and old.read_at is not null then
    new.read_at := old.read_at;
  end if;
  return new;
end;
$$;

create trigger customer_notifications_protect_columns
before update on public.customer_notifications
for each row execute function public.customer_notifications_protect_columns();

create or replace function public.create_customer_order_notification(
  p_order_id uuid,
  p_event_type text,
  p_email_sent boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders%rowtype;
  v_title text;
  v_message text;
  v_pickup boolean;
  v_total text;
  v_code text;
  v_id uuid;
  v_caller uuid := auth.uid();
begin
  if p_order_id is null or p_event_type is null then
    return null;
  end if;

  select * into v_order from public.orders where id = p_order_id;
  if not found or v_order.user_id is null then
    return null;
  end if;

  if v_caller is not null
     and v_caller is distinct from v_order.user_id
     and not (select public.is_admin()) then
    raise exception using errcode = '42501', message = 'You cannot create notifications for another customer.';
  end if;

  if p_event_type = 'payment_received' and v_order.payment_status is distinct from 'paid' then
    return null;
  end if;
  if p_event_type = 'payment_failed' and v_order.payment_status is distinct from 'failed' then
    return null;
  end if;
  if p_event_type = 'payment_pending' and v_order.payment_status is distinct from 'pending' then
    return null;
  end if;

  v_pickup := v_order.fulfillment_method = 'local_pickup';
  v_code := coalesce(v_order.confirmation_code, v_order.order_number);
  v_total := '$' || trim(to_char(v_order.total, 'FM999999990.00'));

  if p_event_type = 'order_confirmed' then
    v_title := 'Order confirmed';
    v_message := format('Your order %s has been received.', v_code)
      || E'\n' || case when v_pickup then 'Pickup' else 'Delivery' end
      || ' • ' || v_total;
  elsif p_event_type = 'preparing' then
    v_title := 'Preparing';
    v_message := 'Your Ivoire Shop order is being prepared.';
  elsif p_event_type = 'ready_for_pickup' then
    v_title := 'Ready for pickup';
    v_message := format('Good news! Your order is ready for pickup.%sBring your confirmation code: %s', E'\n', v_code);
  elsif p_event_type = 'out_for_delivery' then
    v_title := 'Out for delivery';
    v_message := 'Your order is on the way.';
  elsif p_event_type = 'completed' then
    v_title := 'Completed';
    v_message := 'Your order has been completed. Thank you for shopping with Ivoire Shop.';
  elsif p_event_type = 'cancelled' then
    v_title := 'Cancelled';
    v_message := 'Your order has been cancelled.';
  elsif p_event_type = 'payment_pending' then
    v_title := 'Payment pending';
    v_message := 'Payment for your order is still pending.';
  elsif p_event_type = 'payment_received' then
    v_title := 'Payment received';
    v_message := format('Payment received for order %s.', v_code);
  elsif p_event_type = 'payment_failed' then
    v_title := 'Payment failed';
    v_message := 'Payment couldn''t be completed. Please review your order.';
  else
    raise exception using errcode = 'P0001', message = 'Unknown notification event.';
  end if;

  insert into public.customer_notifications (
    user_id, order_id, event_type, title, message, confirmation_code, email_sent, email_attempted
  ) values (
    v_order.user_id, v_order.id, p_event_type, v_title, v_message, v_order.confirmation_code, coalesce(p_email_sent, false), true
  )
  on conflict (order_id, user_id, event_type) do update
    set email_sent = public.customer_notifications.email_sent or excluded.email_sent,
        email_attempted = true
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.create_customer_order_notification(uuid, text, boolean) from public, anon;
grant execute on function public.create_customer_order_notification(uuid, text, boolean) to authenticated;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.create_customer_order_notification(uuid, text, boolean) to service_role;
  end if;
end;
$$;

create or replace function public.mark_customer_notifications_read(p_order_id uuid default null)
returns integer
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_count integer;
begin
  if auth.uid() is null then
    return 0;
  end if;
  update public.customer_notifications
     set read_at = now()
   where user_id = auth.uid()
     and read_at is null
     and (p_order_id is null or order_id = p_order_id);
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.mark_customer_notifications_read(uuid) from public, anon;
grant execute on function public.mark_customer_notifications_read(uuid) to authenticated;

alter table public.customer_notifications replica identity full;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    execute 'alter publication supabase_realtime add table public.customer_notifications';
  end if;
exception
  when duplicate_object then null;
end;
$$;
