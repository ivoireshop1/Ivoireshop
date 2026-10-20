alter table public.store_settings
  add column if not exists shipping_provider text not null default 'shippo',
  add column if not exists easypost_enabled boolean not null default false,
  add column if not exists easypost_customer_rates_enabled boolean not null default false;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'store_settings_shipping_provider_check'
  ) then
    alter table public.store_settings
      add constraint store_settings_shipping_provider_check
      check (shipping_provider in ('shippo', 'easypost'));
  end if;
end
$$;

comment on column public.store_settings.shipping_provider is
  'Active live-rate provider. Shippo settings remain stored when EasyPost is selected.';
comment on column public.store_settings.easypost_enabled is
  'Allow EasyPost UPS/USPS rating when shipping_provider is easypost. Does not buy postage.';
comment on column public.store_settings.easypost_customer_rates_enabled is
  'When false, EasyPost production keys are used for admin verification only — not customer checkout.';
