-- Columns the checkout product query already selects.
-- Nullable, with no backfill, so existing product rows are left unchanged.
-- Safe to rerun: new columns use IF NOT EXISTS, and checks are added only when absent.

alter table public.products
  add column if not exists item_weight_lb numeric(12, 3),
  add column if not exists shipping_package_id uuid,
  add column if not exists weight_oz numeric(12, 3),
  add column if not exists packaging_weight_oz numeric(12, 3),
  add column if not exists weight_source text,
  add column if not exists weight_confidence text,
  add column if not exists dims jsonb;

comment on column public.products.item_weight_lb is
  'Item weight in pounds. Null until a weight is saved. Checkout does not invent one.';
comment on column public.products.shipping_package_id is
  'Optional shipping package preset id. Null when no preset is assigned.';
comment on column public.products.weight_oz is
  'Item weight in ounces. Null until a weight is saved.';
comment on column public.products.packaging_weight_oz is
  'Packaging allowance in ounces. Null until an allowance is saved.';
comment on column public.products.weight_source is
  'verified, ai_text, ai_image, or ai_estimate. Null until a source is saved.';
comment on column public.products.weight_confidence is
  'high, medium, or low. Null until a confidence is saved.';
comment on column public.products.dims is
  'Optional JSON object with length_in, width_in, and height_in. Null until dimensions are saved.';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'products_item_weight_lb_check'
  ) then
    alter table public.products
      add constraint products_item_weight_lb_check
      check (item_weight_lb is null or item_weight_lb > 0);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'products_weight_oz_check'
  ) then
    alter table public.products
      add constraint products_weight_oz_check
      check (weight_oz is null or weight_oz > 0);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'products_packaging_weight_oz_check'
  ) then
    alter table public.products
      add constraint products_packaging_weight_oz_check
      check (packaging_weight_oz is null or packaging_weight_oz >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'products_weight_source_check'
  ) then
    alter table public.products
      add constraint products_weight_source_check
      check (weight_source is null or weight_source in ('verified', 'ai_text', 'ai_image', 'ai_estimate'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'products_weight_confidence_check'
  ) then
    alter table public.products
      add constraint products_weight_confidence_check
      check (weight_confidence is null or weight_confidence in ('high', 'medium', 'low'));
  end if;
end;
$$;
