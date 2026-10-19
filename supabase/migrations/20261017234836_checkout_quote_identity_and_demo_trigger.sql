-- COALESCE(enum, '') type-checks '' as payment_status and aborts every order insert
-- with 22P02 before the row commits. Compare enum values as text instead.
-- Staging also lacked order_status 'ready_for_delivery'; the trigger compared the
-- missing label and crashed INSERT even when status was pending.

alter type public.order_status add value if not exists 'ready_for_delivery';

create or replace function public.orders_emit_admin_notification()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_fulfillment text;
  v_demo boolean;
begin
  v_fulfillment := case
    when new.fulfillment_method = 'local_pickup' then 'Pickup'
    when lower(coalesce(new.fulfillment_provider, '')) = 'ups' then 'UPS'
    when lower(coalesce(new.fulfillment_provider, '')) = 'usps' then 'USPS'
    else 'Local'
  end;
  v_demo := coalesce(new.is_demo, false)
    or coalesce(new.payment_provider, '') = 'demo'
    or coalesce(new.payment_status::text, '') = 'demo';

  if tg_op = 'INSERT' then
    perform public.emit_admin_notification(
      'new_order',
      case when v_demo then 'DEMO order received' else 'New order received' end,
      coalesce(new.order_number, 'Order')
        || E'\n' || coalesce(new.customer_name, 'Customer')
        || E'\n$' || trim(to_char(coalesce(new.total, 0), 'FM999999990.00'))
        || E'\nFulfillment: ' || v_fulfillment
        || case when v_demo then E'\nDemonstration. No real payment was collected.' else '' end,
      new.id::text,
      new.id,
      new.user_id,
      '/admin/orders/' || new.id::text
    );
  end if;

  if tg_op = 'UPDATE'
    and new.payment_status is distinct from old.payment_status
    and new.payment_status = 'paid'
    and not v_demo then
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
    and new.payment_status in ('refunded', 'partially_refunded')
    and not v_demo then
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
    and new.status::text = 'ready_for_delivery'
    and lower(coalesce(new.fulfillment_provider, '')) in ('ups', 'usps')
    and not v_demo then
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

create or replace function public.customer_notifications_label_demo()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_demo boolean;
begin
  if new.order_id is null then
    return new;
  end if;

  select coalesce(is_demo, false)
      or coalesce(payment_provider, '') = 'demo'
      or coalesce(payment_status::text, '') = 'demo'
    into v_demo
  from public.orders
  where id = new.order_id;

  if coalesce(v_demo, false) then
    if new.title not ilike 'DEMO%' then
      new.title := 'DEMO · ' || new.title;
    end if;
    if position('demonstration' in lower(coalesce(new.message, ''))) = 0 then
      new.message := trim(both from coalesce(new.message, ''))
        || E'\nThis is a demonstration. No real payment was collected.';
    end if;
  end if;
  return new;
end;
$$;
