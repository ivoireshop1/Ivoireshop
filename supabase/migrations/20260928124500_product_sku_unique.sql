-- Unique SKUs for generated FOOD-/COS-/IVM- codes. Multiple null SKUs remain allowed.
create unique index if not exists products_sku_unique
  on public.products (sku)
  where sku is not null;
