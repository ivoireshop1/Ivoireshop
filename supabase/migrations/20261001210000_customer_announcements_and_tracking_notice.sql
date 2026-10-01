-- Signed-in customer announcements (in-app only) plus tracking notification event.
-- Does not fan out email. Order notification history is preserved.
-- Customers may only insert/update their own announcement read/dismiss rows.

alter table public.customer_notifications
  drop constraint if exists customer_notifications_event_type_check;

alter table public.customer_notifications
  add constraint customer_notifications_event_type_check check (event_type in (
    'order_confirmed',
    'preparing',
    'ready_for_pickup',
    'out_for_delivery',
    'tracking_added',
    'completed',
    'cancelled',
    'payment_pending',
    'payment_received',
    'payment_failed'
  ));

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
    v_title := 'Your order is being prepared';
    v_message := format('Order %s is being prepared.', v_code);
  elsif p_event_type = 'ready_for_pickup' then
    v_title := 'Ready for pickup';
    v_message := format('Good news! Your order is ready for pickup.%sBring your confirmation code: %s', E'\n', v_code);
  elsif p_event_type = 'out_for_delivery' then
    v_title := 'Your order has shipped 🎉';
    v_message := format('Order %s is on the way.', v_code);
  elsif p_event_type = 'tracking_added' then
    v_title := 'Tracking is available';
    v_message := format('Tracking was added for order %s.', v_code);
  elsif p_event_type = 'completed' then
    v_title := 'Your order was delivered';
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

create table if not exists public.customer_announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  message text not null,
  action_label text,
  action_href text,
  audience text not null default 'all_customers',
  status text not null default 'draft',
  starts_at timestamptz,
  ends_at timestamptz,
  published_at timestamptz,
  archived_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_announcements_audience_check check (audience in ('all_customers')),
  constraint customer_announcements_status_check check (status in ('draft', 'scheduled', 'published', 'expired', 'archived')),
  constraint customer_announcements_title_len check (char_length(title) between 1 and 160),
  constraint customer_announcements_message_len check (char_length(message) between 1 and 4000)
);

create index if not exists customer_announcements_status_idx
  on public.customer_announcements (status, starts_at, ends_at, published_at desc);

create table if not exists public.customer_announcement_reads (
  announcement_id uuid not null references public.customer_announcements(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  read_at timestamptz,
  dismissed_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (announcement_id, user_id)
);

create index if not exists customer_announcement_reads_user_idx
  on public.customer_announcement_reads (user_id, dismissed_at, read_at);

alter table public.customer_announcements enable row level security;
alter table public.customer_announcement_reads enable row level security;

revoke all on table public.customer_announcements from public, anon;
revoke all on table public.customer_announcement_reads from public, anon;
grant select on table public.customer_announcements to authenticated;
grant insert, update, delete on table public.customer_announcements to authenticated;
grant select, insert, update on table public.customer_announcement_reads to authenticated;
revoke delete on table public.customer_announcement_reads from authenticated;

drop policy if exists "Customers read live announcements" on public.customer_announcements;
create policy "Customers read live announcements"
on public.customer_announcements for select to authenticated
using (
  (select public.is_admin())
  or exists (
    select 1
    from public.customer_announcement_reads r
    where r.announcement_id = customer_announcements.id
      and r.user_id = (select auth.uid())
  )
  or (
    status = 'published'
    and published_at is not null
    and (starts_at is null or starts_at <= timezone('utc', now()))
    and (ends_at is null or ends_at > timezone('utc', now()))
    and archived_at is null
  )
);

drop policy if exists "Admins manage customer announcements" on public.customer_announcements;
create policy "Admins manage customer announcements"
on public.customer_announcements for all to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

drop policy if exists "Customers read own announcement receipts" on public.customer_announcement_reads;
create policy "Customers read own announcement receipts"
on public.customer_announcement_reads for select to authenticated
using ((select auth.uid()) = user_id or (select public.is_admin()));

drop policy if exists "Customers insert own announcement receipts" on public.customer_announcement_reads;
create policy "Customers insert own announcement receipts"
on public.customer_announcement_reads for insert to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1
    from public.customer_announcements a
    where a.id = announcement_id
      and (
        (select public.is_admin())
        or (
          a.status = 'published'
          and a.published_at is not null
          and a.archived_at is null
          and (a.starts_at is null or a.starts_at <= timezone('utc', now()))
          and (a.ends_at is null or a.ends_at > timezone('utc', now()))
        )
      )
  )
);

drop policy if exists "Customers update own announcement receipts" on public.customer_announcement_reads;
create policy "Customers update own announcement receipts"
on public.customer_announcement_reads for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create or replace function public.customer_announcement_reads_protect()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE'
     and current_user not in ('postgres', 'supabase_admin')
     and not (select public.is_admin()) then
    if new.announcement_id is distinct from old.announcement_id
       or new.user_id is distinct from old.user_id
       or new.created_at is distinct from old.created_at then
      raise exception using errcode = '42501', message = 'Announcement receipts can only be marked read or dismissed.';
    end if;
    if new.read_at is not null and old.read_at is not null then
      new.read_at := old.read_at;
    end if;
    if new.dismissed_at is not null and old.dismissed_at is not null then
      new.dismissed_at := old.dismissed_at;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists customer_announcement_reads_protect on public.customer_announcement_reads;
create trigger customer_announcement_reads_protect
before update on public.customer_announcement_reads
for each row execute function public.customer_announcement_reads_protect();
