-- Phase 2: nested categories, dual taxes, Ivoire store shipping estimates.
-- Local file only until a recoverable production backup is verified.

alter table public.categories
  add column if not exists parent_id uuid references public.categories(id) on delete restrict,
  add column if not exists sort_order integer not null default 0;

create index if not exists categories_parent_id_idx on public.categories(parent_id);

alter table public.products
  add column if not exists subcategory_id uuid references public.categories(id) on delete set null;

create index if not exists products_subcategory_id_idx on public.products(subcategory_id);

alter table public.store_settings
  add column if not exists tax_1_enabled boolean not null default false,
  add column if not exists tax_1_name text not null default 'Tax 1',
  add column if not exists tax_1_rate_percent numeric(7, 4),
  add column if not exists tax_1_applies_to_shipping boolean not null default false,
  add column if not exists tax_2_enabled boolean not null default false,
  add column if not exists tax_2_name text not null default 'Tax 2',
  add column if not exists tax_2_rate_percent numeric(7, 4),
  add column if not exists tax_2_applies_to_shipping boolean not null default false,
  add column if not exists ivoire_shipping_enabled boolean not null default true,
  add column if not exists ivoire_shipping_markup_percent numeric(7, 4) not null default 0,
  add column if not exists ivoire_shipping_fallback_amount numeric(12, 2),
  add column if not exists ivoire_shipping_max_weight_lb numeric(10, 2),
  add column if not exists ivoire_shipping_config jsonb not null default '{}'::jsonb;

update public.store_settings
set
  tax_1_enabled = true,
  tax_1_name = coalesce(nullif(tax_name, ''), 'Tax 1'),
  tax_1_rate_percent = tax_rate_percent,
  tax_1_applies_to_shipping = tax_applies_to_shipping
where tax_mode = 'manual_rate'
  and tax_1_enabled = false
  and tax_rate_percent is not null;

create table if not exists public.shipping_estimates (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  cart_fingerprint text,
  origin jsonb,
  destination jsonb,
  amount numeric(12, 2) not null check (amount >= 0),
  breakdown jsonb not null default '{}'::jsonb,
  source text not null default 'ivoire_engine',
  order_id uuid references public.orders(id) on delete set null
);

alter table public.shipping_estimates enable row level security;

drop policy if exists "Admins read shipping estimates" on public.shipping_estimates;
create policy "Admins read shipping estimates"
on public.shipping_estimates for select to authenticated
using (public.is_admin());

drop policy if exists "Admins write shipping estimates" on public.shipping_estimates;
create policy "Admins write shipping estimates"
on public.shipping_estimates for all to authenticated
using (public.is_admin())
with check (public.is_admin());

revoke all on table public.shipping_estimates from anon, authenticated;
grant select, insert on table public.shipping_estimates to authenticated;

create or replace function public.categories_forbid_nested_parent()
returns trigger
language plpgsql
as $$
begin
  if new.parent_id is not null then
    if exists (select 1 from public.categories c where c.id = new.parent_id and c.parent_id is not null) then
      raise exception 'Subcategories cannot have children';
    end if;
    if new.id = new.parent_id then
      raise exception 'Category cannot be its own parent';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists categories_forbid_nested_parent on public.categories;
create trigger categories_forbid_nested_parent
before insert or update on public.categories
for each row execute function public.categories_forbid_nested_parent();
