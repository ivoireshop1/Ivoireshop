-- Manual UPS/USPS tracking history for later carrier events.
-- Does not poll carriers or invent in-transit/delivered states.

create table if not exists public.order_carrier_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  carrier text not null,
  tracking_number text not null,
  event_code text not null,
  source text not null check (source in ('admin', 'carrier')),
  occurred_at timestamptz not null default timezone('utc', now()),
  raw jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists order_carrier_events_order_idx
  on public.order_carrier_events (order_id, occurred_at);

alter table public.order_carrier_events enable row level security;

revoke all on table public.order_carrier_events from public, anon;
grant select on table public.order_carrier_events to authenticated;
grant insert on table public.order_carrier_events to authenticated;

drop policy if exists "Customers read own carrier events" on public.order_carrier_events;
create policy "Customers read own carrier events"
on public.order_carrier_events for select to authenticated
using (
  (select public.is_admin())
  or exists (
    select 1 from public.orders o
    where o.id = order_id
      and o.user_id = (select auth.uid())
  )
);

drop policy if exists "Admins insert carrier events" on public.order_carrier_events;
create policy "Admins insert carrier events"
on public.order_carrier_events for insert to authenticated
with check ((select public.is_admin()));

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
    'tracking_updated',
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
  v_carrier boolean;
  v_local boolean;
  v_total text;
  v_code text;
  v_id uuid;
  v_caller uuid := auth.uid();
  v_pickup_block text;
  v_track text;
  v_last4 text;
  v_carrier_name text;
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
  v_carrier := lower(coalesce(v_order.fulfillment_provider, '')) in ('ups', 'usps');
  v_local := not v_pickup and not v_carrier;
  v_code := coalesce(v_order.confirmation_code, v_order.order_number);
  v_total := '$' || trim(to_char(v_order.total, 'FM999999990.00'));
  v_track := nullif(btrim(coalesce(v_order.tracking_number, '')), '');
  v_last4 := case when v_track is not null then right(v_track, 4) else null end;
  v_carrier_name := upper(coalesce(v_order.fulfillment_provider, ''));

  select concat_ws(
    E'\n',
    nullif(btrim(origin_address_line_1), ''),
    nullif(btrim(origin_address_line_2), ''),
    nullif(btrim(concat_ws(' ', nullif(origin_city, '') || case when origin_state is not null and origin_state <> '' then ',' else '' end, origin_state, origin_postal_code)), ''),
    case
      when origin_country in ('US', 'USA') then 'United States'
      else nullif(btrim(origin_country), '')
    end
  )
  into v_pickup_block
  from public.store_settings
  where id = 'default';

  if p_event_type = 'order_confirmed' then
    v_title := 'Order accepted';
    v_message := 'We received your order and the Ivoire Shop team is getting started.'
      || E'\n' || v_code || ' · ' || v_total;
  elsif p_event_type = 'preparing' then
    v_title := 'Preparing your order';
    v_message := 'Your items are now being prepared.';
  elsif p_event_type = 'ready_for_pickup' then
    v_title := 'Ready for pickup';
    v_message := 'Your order is ready for pickup.'
      || case when v_pickup_block is not null then E'\nPickup Location\n' || v_pickup_block else '' end;
  elsif p_event_type = 'ready_for_delivery' then
    v_title := 'Ready for delivery';
    v_message := 'Your order is packed and ready for delivery.';
  elsif p_event_type = 'shipped' then
    v_title := 'Your package has shipped!';
    v_message := 'Your Ivoire Shop order is on the way.'
      || case
        when v_carrier and v_last4 is not null then
          E'\nCarrier: ' || v_carrier_name
          || E'\nTracking ending ' || v_last4
        else ''
      end;
  elsif p_event_type = 'out_for_delivery' then
    v_title := 'Out for delivery';
    v_message := 'Your order is on its way.';
  elsif p_event_type = 'tracking_added' then
    v_title := 'Tracking is available';
    v_message := 'Tracking was added for your order.'
      || case when v_carrier_name <> '' and v_last4 is not null then E'\n' || v_carrier_name || ' · Tracking ending ' || v_last4 else '' end;
  elsif p_event_type = 'tracking_updated' then
    v_title := 'Tracking information updated';
    v_message := 'Your tracking details were updated.'
      || case when v_carrier_name <> '' and v_last4 is not null then E'\n' || v_carrier_name || ' · Tracking ending ' || v_last4 else '' end;
  elsif p_event_type = 'completed' then
    v_title := 'Completed';
    v_message := 'Your order is complete. Thank you for shopping with Ivoire Shop.';
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
        email_attempted = true,
        title = case
          when excluded.event_type = 'tracking_updated' then excluded.title
          else public.customer_notifications.title
        end,
        message = case
          when excluded.event_type = 'tracking_updated' then excluded.message
          else public.customer_notifications.message
        end
  returning id into v_id;

  return v_id;
end;
$$;
