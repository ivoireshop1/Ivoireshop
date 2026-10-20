-- Store Details profile fields for Admin → Settings.
-- Reuses store_settings (origin_name / origin_phone for name and warehouse phone).
-- Does not alter historical orders or payment currency on existing rows.

alter table public.store_settings
  add column if not exists support_email text,
  add column if not exists storefront_url text,
  add column if not exists default_currency text not null default 'USD';

alter table public.store_settings drop constraint if exists store_settings_default_currency_check;
alter table public.store_settings
  add constraint store_settings_default_currency_check
  check (default_currency ~ '^[A-Z]{3}$');

update public.store_settings
set
  storefront_url = coalesce(nullif(trim(storefront_url), ''), 'https://ivoireshop-steel.vercel.app'),
  default_currency = coalesce(nullif(upper(trim(default_currency)), ''), 'USD'),
  origin_name = coalesce(nullif(trim(origin_name), ''), 'Ivoire Shop')
where id = 'default';
