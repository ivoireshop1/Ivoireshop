-- Manual UPS/USPS charges, tax snapshot, and carrier tracking.
-- Does not rewrite create_checkout_order item pricing. Historical totals stay as stored.
-- Existing order/customer RLS is unchanged. Guest confirmation remains token-only.

alter table public.store_settings
  add column if not exists ups_domestic_enabled boolean not null default false,
  add column if not exists ups_international_enabled boolean not null default false,
  add column if not exists ups_domestic_charge numeric(12, 2),
  add column if not exists ups_international_charge numeric(12, 2),
  add column if not exists usps_domestic_enabled boolean not null default false,
  add column if not exists usps_international_enabled boolean not null default false,
  add column if not exists usps_domestic_charge numeric(12, 2),
  add column if not exists usps_international_charge numeric(12, 2),
  add column if not exists tax_mode text not null default 'not_configured',
  add column if not exists tax_rate_percent numeric(7, 4),
  add column if not exists tax_applies_to_shipping boolean not null default false,
  add column if not exists tax_name text not null default 'Tax';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'store_settings_tax_mode_check'
  ) then
    alter table public.store_settings
      add constraint store_settings_tax_mode_check
      check (tax_mode in ('not_configured', 'no_tax', 'manual_rate'));
  end if;
end $$;

alter table public.orders
  add column if not exists tax_amount numeric(12, 2) not null default 0,
  add column if not exists tax_snapshot jsonb,
  add column if not exists shipping_mode text,
  add column if not exists tracking_number text,
  add column if not exists shipped_at timestamptz;

alter table public.orders drop constraint if exists orders_tax_amount_nonnegative;
alter table public.orders add constraint orders_tax_amount_nonnegative check (tax_amount >= 0);

drop function if exists public.get_checkout_confirmation(text);

create function public.get_checkout_confirmation(p_access_token text)
returns table (
  order_id uuid,
  order_number text,
  confirmation_code text,
  status public.order_status,
  payment_status public.payment_status,
  payment_method text,
  payment_provider text,
  fulfillment_method public.fulfillment_method,
  fulfillment_provider text,
  fulfillment_service text,
  shipping_mode text,
  tracking_number text,
  shipped_at timestamptz,
  customer_email text,
  customer_name text,
  total numeric(12, 2),
  subtotal numeric(12, 2),
  shipping_cost numeric(12, 2),
  discount_amount numeric(12, 2),
  tax_amount numeric(12, 2),
  shipping_address jsonb,
  created_at timestamptz,
  items jsonb
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if p_access_token is null
     or length(p_access_token) <> 64
     or p_access_token !~ '^[0-9a-f]+$' then
    return;
  end if;

  return query
  select
    o.id,
    o.order_number,
    o.confirmation_code,
    o.status,
    o.payment_status,
    o.payment_method,
    o.payment_provider,
    o.fulfillment_method,
    o.fulfillment_provider,
    o.fulfillment_service,
    o.shipping_mode,
    o.tracking_number,
    o.shipped_at,
    o.customer_email,
    o.customer_name,
    o.total,
    o.subtotal,
    o.shipping_cost,
    o.discount_amount,
    o.tax_amount,
    o.shipping_address,
    o.created_at,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'product_name', i.product_name,
        'product_price', i.product_price,
        'quantity', i.quantity
      ) order by i.created_at)
      from public.order_items i
      where i.order_id = o.id
    ), '[]'::jsonb)
  from public.orders o
  where o.guest_access_token = p_access_token;
end;
$$;

revoke all on function public.get_checkout_confirmation(text) from public;
grant execute on function public.get_checkout_confirmation(text) to anon, authenticated;
