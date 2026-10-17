-- Demo checkout records orders through security-definer RPCs so Place Demo Order
-- does not require a Vercel service-role key. RLS stays enabled.

create or replace function public.apply_demo_order_charges(
  p_order_id uuid,
  p_shipping numeric,
  p_tax numeric,
  p_fulfillment_provider text default null,
  p_fulfillment_service text default null,
  p_delivery_snapshot jsonb default null,
  p_tax_snapshot jsonb default null
)
returns table(total numeric)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders%rowtype;
  v_shipping numeric(12, 2) := round(greatest(coalesce(p_shipping, 0), 0), 2);
  v_tax numeric(12, 2) := round(greatest(coalesce(p_tax, 0), 0), 2);
  v_total numeric(12, 2);
begin
  if not exists (
    select 1 from public.store_settings
    where id = 'default' and demo_payment_enabled = true
  ) then
    raise exception using errcode = 'P0001', message = 'Demo payment is turned off.';
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found
     or v_order.is_demo is not true
     or v_order.payment_provider is distinct from 'demo'
     or v_order.payment_status::text is distinct from 'demo' then
    raise exception using errcode = 'P0001', message = 'This order is not a demonstration record.';
  end if;

  v_total := round(coalesce(v_order.subtotal, 0) + v_shipping + v_tax, 2);

  update public.orders
  set
    shipping_cost = v_shipping,
    tax_amount = v_tax,
    total = v_total,
    fulfillment_provider = coalesce(p_fulfillment_provider, fulfillment_provider),
    fulfillment_service = coalesce(p_fulfillment_service, fulfillment_service),
    delivery_snapshot = coalesce(p_delivery_snapshot, delivery_snapshot),
    tax_snapshot = coalesce(p_tax_snapshot, tax_snapshot)
  where id = v_order.id;

  update public.admin_notifications
  set
    title = 'DEMO order received',
    message = 'Demonstration order. No real payment was collected.'
  where order_id = v_order.id
    and event_type = 'new_order';

  return query select v_total;
end;
$$;

revoke all on function public.apply_demo_order_charges(uuid, numeric, numeric, text, text, jsonb, jsonb) from public;
grant execute on function public.apply_demo_order_charges(uuid, numeric, numeric, text, text, jsonb, jsonb) to anon, authenticated;
