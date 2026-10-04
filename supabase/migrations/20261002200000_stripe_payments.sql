-- Stripe-only online payments. Keep historical Square/PayPal provider values.
-- Inventory remains reserved at order create; restore on unpaid cancel only.

alter table public.orders drop constraint if exists orders_payment_provider_check;
alter table public.orders
  add constraint orders_payment_provider_check
  check (payment_provider is null or payment_provider in ('square', 'paypal', 'stripe'));

alter table public.payment_events drop constraint if exists payment_events_provider_check;
alter table public.payment_events
  add constraint payment_events_provider_check
  check (provider in ('square', 'paypal', 'stripe'));

alter table public.orders
  add column if not exists paid_at timestamptz,
  add column if not exists amount_paid numeric not null default 0,
  add column if not exists refunded_amount numeric not null default 0,
  add column if not exists payment_currency text not null default 'usd',
  add column if not exists inventory_restored boolean not null default false;

do $$
begin
  if not exists (
    select 1 from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'payment_status' and e.enumlabel = 'partially_refunded'
  ) then
    alter type public.payment_status add value 'partially_refunded';
  end if;
end $$;

create table if not exists public.payment_webhook_health (
  provider text primary key,
  last_success_at timestamptz,
  last_error_at timestamptz,
  last_error_code text,
  recent_failures integer not null default 0
);

alter table public.payment_webhook_health enable row level security;
revoke all on table public.payment_webhook_health from public, anon;
grant select on table public.payment_webhook_health to authenticated;

drop policy if exists payment_webhook_health_admin_select on public.payment_webhook_health;
create policy payment_webhook_health_admin_select
on public.payment_webhook_health for select to authenticated
using ((select public.is_admin()));

insert into public.payment_webhook_health (provider)
values ('stripe')
on conflict (provider) do nothing;

create or replace function public.restore_order_inventory(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_item record;
begin
  update public.orders
  set inventory_restored = true, updated_at = now()
  where id = p_order_id
    and inventory_restored = false
    and payment_status is distinct from 'paid'
    and payment_status is distinct from 'partially_refunded';
  if not found then
    return;
  end if;

  for v_item in
    select oi.product_id, oi.quantity, p.track_inventory
    from public.order_items oi
    join public.products p on p.id = oi.product_id
    where oi.order_id = p_order_id
  loop
    if coalesce(v_item.track_inventory, true) then
      update public.products
      set stock_quantity = coalesce(stock_quantity, 0) + v_item.quantity
      where id = v_item.product_id;
    end if;
  end loop;
end;
$$;

revoke all on function public.restore_order_inventory(uuid) from public, anon, authenticated;
grant execute on function public.restore_order_inventory(uuid) to service_role;

create or replace function public.orders_emit_admin_notification()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_fulfillment text;
begin
  v_fulfillment := case
    when new.fulfillment_method = 'local_pickup' then 'Pickup'
    when lower(coalesce(new.fulfillment_provider, '')) = 'ups' then 'UPS'
    when lower(coalesce(new.fulfillment_provider, '')) = 'usps' then 'USPS'
    else 'Local'
  end;

  if tg_op = 'INSERT' then
    perform public.emit_admin_notification(
      'new_order',
      'New order received',
      coalesce(new.order_number, 'Order')
        || E'\n' || coalesce(new.customer_name, 'Customer')
        || E'\n$' || trim(to_char(coalesce(new.total, 0), 'FM999999990.00'))
        || E'\nFulfillment: ' || v_fulfillment,
      new.id::text,
      new.id,
      new.user_id,
      '/admin/orders/' || new.id::text
    );
  end if;

  if tg_op = 'UPDATE'
    and new.payment_status is distinct from old.payment_status
    and new.payment_status = 'paid' then
    perform public.emit_admin_notification(
      'paid_order',
      'Paid order received 💳',
      coalesce(new.order_number, 'Order')
        || E'\n' || coalesce(new.customer_name, 'Customer')
        || E'\n$' || trim(to_char(coalesce(new.total, 0), 'FM999999990.00'))
        || E'\nFulfillment: ' || v_fulfillment,
      new.id::text || ':paid',
      new.id,
      new.user_id,
      '/admin/orders/' || new.id::text
    );
  end if;

  if tg_op = 'UPDATE'
    and new.payment_status is distinct from old.payment_status
    and new.payment_status in ('refunded', 'partially_refunded') then
    perform public.emit_admin_notification(
      'refund_processed',
      'Refund successful ✓',
      coalesce(new.order_number, 'Order')
        || E'\nRefunded $' || trim(to_char(coalesce(new.refunded_amount, 0), 'FM999999990.00')),
      new.id::text || ':refund:' || coalesce(new.refunded_amount, 0)::text,
      new.id,
      new.user_id,
      '/admin/orders/' || new.id::text
    );
  end if;

  if tg_op = 'UPDATE'
    and new.status is distinct from old.status
    and new.status = 'ready_for_delivery'
    and lower(coalesce(new.fulfillment_provider, '')) in ('ups', 'usps') then
    perform public.emit_admin_notification(
      'shipping_attention',
      'Order ready for carrier',
      coalesce(new.order_number, 'Order') || ' is packed and waiting for tracking.',
      new.id::text || ':carrier',
      new.id,
      new.user_id,
      '/admin/orders/' || new.id::text
    );
  end if;
  return new;
end;
$$;

drop trigger if exists orders_emit_admin_notification on public.orders;
create trigger orders_emit_admin_notification
after insert or update of status, payment_status, refunded_amount on public.orders
for each row execute function public.orders_emit_admin_notification();

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
  v_total text;
  v_code text;
  v_id uuid;
  v_caller uuid := auth.uid();
  v_pickup_block text;
  v_track text;
  v_last4 text;
  v_carrier_name text;
  v_refund text;
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
  if p_event_type = 'payment_refunded' and v_order.payment_status not in ('refunded', 'partially_refunded') then
    return null;
  end if;

  v_pickup := v_order.fulfillment_method = 'local_pickup';
  v_carrier := lower(coalesce(v_order.fulfillment_provider, '')) in ('ups', 'usps');
  v_code := coalesce(v_order.confirmation_code, v_order.order_number);
  v_total := '$' || trim(to_char(v_order.total, 'FM999999990.00'));
  v_refund := '$' || trim(to_char(coalesce(v_order.refunded_amount, 0), 'FM999999990.00'));
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
    v_title := 'Order accepted 🎉';
    v_message := 'We''ve received your order and the Ivoire Shop team is getting started.';
  elsif p_event_type = 'preparing' then
    v_title := 'We''re preparing your order';
    v_message := 'Your items are being prepared.';
  elsif p_event_type = 'ready_for_pickup' then
    v_title := 'Your order is ready for pickup';
    v_message := 'Your order is ready for pickup.'
      || case when v_pickup_block is not null then E'\nPickup Location\n' || v_pickup_block else '' end;
  elsif p_event_type = 'ready_for_delivery' then
    if v_carrier then
      v_title := 'Your order is packed and ready to ship';
      v_message := 'Your Ivoire Shop order is packed and waiting for carrier drop-off.';
    else
      v_title := 'Your order is ready for delivery';
      v_message := 'Your order is packed and ready for delivery.';
    end if;
  elsif p_event_type = 'shipped' then
    v_title := 'Your package has shipped 📦';
    v_message := 'Your Ivoire Shop order is on the way.'
      || case
        when v_carrier and v_last4 is not null then
          E'\nCarrier: ' || v_carrier_name
          || E'\nTracking ending ' || v_last4
        else ''
      end;
  elsif p_event_type = 'out_for_delivery' then
    v_title := 'Your order is on the way';
    v_message := 'Your order is out for local delivery.';
  elsif p_event_type = 'tracking_added' then
    v_title := 'Tracking is available';
    v_message := 'Tracking was added for your order.'
      || case when v_carrier_name <> '' and v_last4 is not null then E'\n' || v_carrier_name || ' · Tracking ending ' || v_last4 else '' end;
  elsif p_event_type = 'tracking_updated' then
    v_title := 'Tracking information updated';
    v_message := 'Your tracking details were updated.'
      || case when v_carrier_name <> '' and v_last4 is not null then E'\n' || v_carrier_name || ' · Tracking ending ' || v_last4 else '' end;
  elsif p_event_type = 'completed' then
    v_title := 'Order complete ✓';
    v_message := 'Thank you for shopping with Ivoire Shop.';
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
  elsif p_event_type = 'payment_refunded' then
    v_title := 'Refund processed';
    v_message := format('A refund of %s was processed for your order.', v_refund);
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
          when excluded.event_type in ('tracking_updated', 'payment_refunded') then excluded.title
          else public.customer_notifications.title
        end,
        message = case
          when excluded.event_type in ('tracking_updated', 'payment_refunded') then excluded.message
          else public.customer_notifications.message
        end
  returning id into v_id;

  return v_id;
end;
$$;
