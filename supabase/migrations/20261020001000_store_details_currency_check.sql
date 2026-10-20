-- Enforce ISO-like currency codes on store_settings.default_currency.
alter table public.store_settings drop constraint if exists store_settings_default_currency_check;
alter table public.store_settings
  add constraint store_settings_default_currency_check
  check (default_currency ~ '^[A-Z]{3}$');
