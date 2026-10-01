-- Guest confirmation can show the fulfillment snapshot stored on the order.
-- Does not change RLS, guest token matching, or historical totals.

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
  customer_email text,
  customer_name text,
  total numeric(12, 2),
  subtotal numeric(12, 2),
  shipping_cost numeric(12, 2),
  discount_amount numeric(12, 2),
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
    o.customer_email,
    o.customer_name,
    o.total,
    o.subtotal,
    o.shipping_cost,
    o.discount_amount,
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
