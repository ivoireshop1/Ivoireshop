alter table public.store_settings
  add column if not exists easyship_enabled boolean not null default false,
  add column if not exists easyship_customer_rates_enabled boolean not null default false;

alter table public.store_settings
  drop constraint if exists store_settings_shipping_provider_check;

alter table public.store_settings
  add constraint store_settings_shipping_provider_check
  check (shipping_provider in ('shippo', 'easypost', 'easyship'));

comment on column public.store_settings.shipping_provider is
  'Active live-rate provider. Shippo and EasyPost settings remain stored when Easyship is selected.';
comment on column public.store_settings.easyship_enabled is
  'Allow Easyship UPS/USPS rating when shipping_provider is easyship. Calls POST /2024-09/rates only. Does not buy postage.';
comment on column public.store_settings.easyship_customer_rates_enabled is
  'When false, Easyship production keys are used for admin verification only — not customer checkout.';
