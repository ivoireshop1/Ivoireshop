-- Local delivery charge and checkout visibility for pickup / Ivoire Shop delivery.
-- Does not change historical order totals. UPS/USPS remain on the existing rate-manager columns.

alter table public.store_settings
  add column if not exists store_delivery_charge numeric(12, 2) not null default 0,
  add column if not exists store_delivery_show_at_checkout boolean not null default true,
  add column if not exists pickup_show_at_checkout boolean not null default true;

alter table public.store_settings drop constraint if exists store_settings_store_delivery_charge_nonnegative;
alter table public.store_settings
  add constraint store_settings_store_delivery_charge_nonnegative
  check (store_delivery_charge >= 0);

notify pgrst, 'reload schema';
