-- Shipping Rate Manager extras + actual postage, separate from customer shipping_cost.
-- Does not change historical order totals. Live carrier API remains unavailable until credentials exist.

alter table public.store_settings
  add column if not exists ups_show_at_checkout boolean not null default true,
  add column if not exists usps_show_at_checkout boolean not null default true,
  add column if not exists ups_rate_mode text not null default 'store_rate',
  add column if not exists usps_rate_mode text not null default 'store_rate',
  add column if not exists ups_handling_fee numeric(12, 2),
  add column if not exists usps_handling_fee numeric(12, 2),
  add column if not exists ups_free_shipping_threshold numeric(12, 2),
  add column if not exists usps_free_shipping_threshold numeric(12, 2);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'store_settings_ups_rate_mode_check') then
    alter table public.store_settings
      add constraint store_settings_ups_rate_mode_check
      check (ups_rate_mode in ('store_rate', 'manual_quote', 'live_api'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'store_settings_usps_rate_mode_check') then
    alter table public.store_settings
      add constraint store_settings_usps_rate_mode_check
      check (usps_rate_mode in ('store_rate', 'manual_quote', 'live_api'));
  end if;
end $$;

alter table public.orders
  add column if not exists postage_cost numeric(12, 2);

alter table public.orders drop constraint if exists orders_postage_cost_nonnegative;
alter table public.orders add constraint orders_postage_cost_nonnegative check (postage_cost is null or postage_cost >= 0);
