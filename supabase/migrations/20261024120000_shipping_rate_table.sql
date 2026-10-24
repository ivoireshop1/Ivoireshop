-- Founder-approved domestic store-calculated rate table. Sending/offering stays OFF until Admin enables it.

alter table public.store_settings
  add column if not exists rate_table_enabled boolean not null default false,
  add column if not exists rate_table_buffer numeric(6, 3) not null default 0.10,
  add column if not exists rate_table jsonb;

comment on column public.store_settings.rate_table_enabled is
  'When true, checkout may offer labeled STORE-CALCULATED domestic rates only if live UPS/USPS rates are not already shown.';
comment on column public.store_settings.rate_table_buffer is
  'Fractional buffer applied to founder-entered table amounts. Starts at 0.10 (10%).';
comment on column public.store_settings.rate_table is
  'Domestic US Ground/Priority/Express amounts by weight bracket. Never treated as a live carrier rate.';
