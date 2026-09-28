-- Admin catalog reset / repricing controls.
-- DDL and RPCs only. Does not update, unlist, or reprice existing catalog rows.

create table if not exists public.catalog_state_snapshots (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  reason text not null default 'fresh_reset',
  item_count integer not null check (item_count >= 0),
  payload jsonb not null
);

comment on table public.catalog_state_snapshots is
  'Lightweight catalog-state snapshots for accidental Fresh Catalog Reset recovery. Not a product duplicate import.';

create index if not exists catalog_state_snapshots_created_at_idx
  on public.catalog_state_snapshots (created_at desc);

alter table public.catalog_state_snapshots enable row level security;

drop policy if exists "Admins manage catalog snapshots" on public.catalog_state_snapshots;
create policy "Admins manage catalog snapshots"
on public.catalog_state_snapshots
for all
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

revoke all on table public.catalog_state_snapshots from public, anon;
grant select, insert, delete on table public.catalog_state_snapshots to authenticated;

create or replace function public.admin_catalog_impact()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_impact jsonb;
begin
  if not (select public.is_admin()) then
    raise exception using errcode = '42501', message = 'Only store administrators can view catalog controls.';
  end if;

  select jsonb_build_object(
    'total', count(*)::integer,
    'active', count(*) filter (where p.is_active)::integer,
    'foods', count(*) filter (where c.slug = 'foods')::integer,
    'cosmetics', count(*) filter (where c.slug = 'cosmetics')::integer,
    'ivoire_market', count(*) filter (where c.slug = 'ivoire-market')::integer,
    'with_prices', count(*) filter (where p.price is not null)::integer,
    'inventory_tracked', count(*) filter (where coalesce(p.track_inventory, true))::integer
  )
  into v_impact
  from public.products p
  left join public.categories c on c.id = p.category_id;

  return coalesce(v_impact, jsonb_build_object(
    'total', 0,
    'active', 0,
    'foods', 0,
    'cosmetics', 0,
    'ivoire_market', 0,
    'with_prices', 0,
    'inventory_tracked', 0
  ));
end;
$$;

create or replace function public.admin_latest_catalog_snapshot_meta()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.catalog_state_snapshots%rowtype;
begin
  if not (select public.is_admin()) then
    raise exception using errcode = '42501', message = 'Only store administrators can view catalog snapshots.';
  end if;

  select * into v_row
  from public.catalog_state_snapshots
  order by created_at desc
  limit 1;

  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'id', v_row.id,
    'created_at', v_row.created_at,
    'item_count', v_row.item_count,
    'reason', v_row.reason
  );
end;
$$;

create or replace function public._catalog_capture_payload(p_ids uuid[] default null)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'product_id', p.id,
        'category_id', p.category_id,
        'price', p.price,
        'compare_at_price', p.compare_at_price,
        'is_active', p.is_active,
        'track_inventory', p.track_inventory,
        'stock_quantity', p.stock_quantity,
        'needs_pricing', p.needs_pricing,
        'is_featured', p.is_featured,
        'is_new_arrival', p.is_new_arrival,
        'is_coming_soon', p.is_coming_soon
      )
      order by p.id
    ),
    '[]'::jsonb
  )
  from public.products p
  where p_ids is null or p.id = any(p_ids);
$$;

create or replace function public._catalog_prune_snapshots(p_keep integer default 3)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_keep is null or p_keep < 1 then
    p_keep := 3;
  end if;

  delete from public.catalog_state_snapshots
  where id in (
    select id
    from public.catalog_state_snapshots
    order by created_at desc
    offset p_keep
  );
end;
$$;

create or replace function public._catalog_reset_apply(p_action text, p_ids uuid[] default null)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_updated integer := 0;
begin
  if p_action is null or p_action not in ('unlist', 'clear_prices', 'fresh') then
    raise exception using errcode = 'P0001', message = 'Unknown catalog reset action.';
  end if;

  if p_ids is not null and coalesce(array_length(p_ids, 1), 0) = 0 then
    raise exception using errcode = 'P0001', message = 'Select at least one product.';
  end if;

  if p_action = 'unlist' then
    update public.products
    set
      is_active = false,
      is_featured = false,
      is_new_arrival = false,
      is_coming_soon = false
    where p_ids is null or id = any(p_ids);
  elsif p_action = 'clear_prices' then
    update public.products
    set
      price = null,
      needs_pricing = true,
      is_active = false
    where p_ids is null or id = any(p_ids);
  else
    update public.products
    set
      is_active = false,
      price = null,
      compare_at_price = null,
      needs_pricing = true,
      track_inventory = false,
      stock_quantity = null,
      is_featured = false,
      is_new_arrival = false,
      is_coming_soon = false
    where p_ids is null or id = any(p_ids);
  end if;

  get diagnostics v_updated = row_count;
  return v_updated;
end;
$$;

create or replace function public._catalog_restore_payload(p_payload jsonb)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_updated integer := 0;
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'array' then
    raise exception using errcode = 'P0001', message = 'Catalog snapshot payload is missing.';
  end if;

  update public.products p
  set
    category_id = coalesce((item.elem ->> 'category_id')::uuid, p.category_id),
    price = nullif(item.elem ->> 'price', '')::numeric,
    compare_at_price = nullif(item.elem ->> 'compare_at_price', '')::numeric,
    is_active = coalesce((item.elem ->> 'is_active')::boolean, false),
    track_inventory = coalesce((item.elem ->> 'track_inventory')::boolean, false),
    stock_quantity = nullif(item.elem ->> 'stock_quantity', '')::integer,
    needs_pricing = coalesce((item.elem ->> 'needs_pricing')::boolean, nullif(item.elem ->> 'price', '') is null),
    is_featured = coalesce((item.elem ->> 'is_featured')::boolean, false),
    is_new_arrival = coalesce((item.elem ->> 'is_new_arrival')::boolean, false),
    is_coming_soon = coalesce((item.elem ->> 'is_coming_soon')::boolean, false)
  from jsonb_array_elements(p_payload) as item(elem)
  where p.id = (item.elem ->> 'product_id')::uuid;

  get diagnostics v_updated = row_count;
  return v_updated;
end;
$$;

create or replace function public.admin_unlist_all_products(p_confirmed boolean)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_updated integer;
begin
  if not (select public.is_admin()) then
    raise exception using errcode = '42501', message = 'Only store administrators can unlist products.';
  end if;
  if p_confirmed is not true then
    raise exception using errcode = 'P0001', message = 'Confirmation is required to unlist every product.';
  end if;

  v_updated := public._catalog_reset_apply('unlist', null);
  return jsonb_build_object('updated', v_updated, 'impact', public.admin_catalog_impact());
end;
$$;

create or replace function public.admin_clear_all_prices(p_confirmation text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_updated integer;
begin
  if not (select public.is_admin()) then
    raise exception using errcode = '42501', message = 'Only store administrators can clear prices.';
  end if;
  if p_confirmation is distinct from 'CLEAR PRICES' then
    raise exception using errcode = 'P0001', message = 'Type CLEAR PRICES to confirm.';
  end if;

  v_updated := public._catalog_reset_apply('clear_prices', null);
  return jsonb_build_object('updated', v_updated, 'impact', public.admin_catalog_impact());
end;
$$;

create or replace function public.admin_fresh_catalog_reset(p_confirmation text, p_confirmed boolean)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_payload jsonb;
  v_updated integer;
  v_count integer;
begin
  if not (select public.is_admin()) then
    raise exception using errcode = '42501', message = 'Only store administrators can reset the catalog.';
  end if;
  if p_confirmation is distinct from 'FRESH START' then
    raise exception using errcode = 'P0001', message = 'Type FRESH START to confirm.';
  end if;
  if p_confirmed is not true then
    raise exception using errcode = 'P0001', message = 'The Reset Catalog confirmation is required.';
  end if;

  v_payload := public._catalog_capture_payload(null);
  v_count := coalesce(jsonb_array_length(v_payload), 0);

  insert into public.catalog_state_snapshots (created_by, reason, item_count, payload)
  values (auth.uid(), 'fresh_reset', v_count, v_payload);

  perform public._catalog_prune_snapshots(3);

  v_updated := public._catalog_reset_apply('fresh', null);
  if v_updated <> v_count then
    raise exception using errcode = 'P0001', message = 'Catalog reset could not finish. Nothing was changed.';
  end if;

  return jsonb_build_object('updated', v_updated, 'snapshot_items', v_count, 'impact', public.admin_catalog_impact());
end;
$$;

create or replace function public.admin_restore_last_catalog_snapshot(p_confirmation text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.catalog_state_snapshots%rowtype;
  v_updated integer;
begin
  if not (select public.is_admin()) then
    raise exception using errcode = '42501', message = 'Only store administrators can restore a catalog snapshot.';
  end if;
  if p_confirmation is distinct from 'RESTORE' then
    raise exception using errcode = 'P0001', message = 'Type RESTORE to confirm.';
  end if;

  select * into v_row
  from public.catalog_state_snapshots
  order by created_at desc
  limit 1
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'No catalog snapshot is available to restore.';
  end if;

  v_updated := public._catalog_restore_payload(v_row.payload);
  return jsonb_build_object(
    'updated', v_updated,
    'snapshot_id', v_row.id,
    'item_count', v_row.item_count,
    'impact', public.admin_catalog_impact()
  );
end;
$$;

create or replace function public.admin_bulk_set_price(p_product_ids uuid[], p_price numeric)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_expected integer;
  v_found integer;
  v_updated integer;
begin
  if not (select public.is_admin()) then
    raise exception using errcode = '42501', message = 'Only store administrators can set prices.';
  end if;
  if p_product_ids is null or coalesce(array_length(p_product_ids, 1), 0) = 0 then
    raise exception using errcode = 'P0001', message = 'Select at least one product.';
  end if;
  if p_price is null or p_price <= 0 then
    raise exception using errcode = 'P0001', message = 'Enter a valid price greater than zero.';
  end if;

  select count(distinct id) into v_expected from unnest(p_product_ids) as id;
  if v_expected <> coalesce(array_length(p_product_ids, 1), 0) then
    raise exception using errcode = 'P0001', message = 'Duplicate product selections are not allowed.';
  end if;

  select count(*) into v_found
  from public.products
  where id = any(p_product_ids);
  if v_found <> v_expected then
    raise exception using errcode = 'P0001', message = 'One or more selected products could not be found. Nothing was saved.';
  end if;

  update public.products
  set
    price = p_price,
    needs_pricing = false
  where id = any(p_product_ids);

  get diagnostics v_updated = row_count;
  if v_updated <> v_expected then
    raise exception using errcode = 'P0001', message = 'The price update could not be completed. Nothing was saved.';
  end if;

  return v_updated;
end;
$$;

create or replace function public.admin_bulk_activate_eligible(p_product_ids uuid[])
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_updated integer := 0;
begin
  if not (select public.is_admin()) then
    raise exception using errcode = '42501', message = 'Only store administrators can activate products.';
  end if;
  if p_product_ids is null or coalesce(array_length(p_product_ids, 1), 0) = 0 then
    raise exception using errcode = 'P0001', message = 'Select at least one product.';
  end if;

  update public.products p
  set is_active = true
  where p.id = any(p_product_ids)
    and nullif(btrim(p.name), '') is not null
    and p.category_id is not null
    and p.price is not null
    and p.price > 0
    and (
      not coalesce(p.track_inventory, true)
      or (p.stock_quantity is not null and p.stock_quantity >= 0)
    )
    and exists (
      select 1
      from public.product_images i
      where i.product_id = p.id
        and i.image_url is not null
        and btrim(i.image_url) <> ''
        and i.image_url not like 'blob:%'
    );

  get diagnostics v_updated = row_count;
  return jsonb_build_object(
    'activated', v_updated,
    'selected', coalesce(array_length(p_product_ids, 1), 0)
  );
end;
$$;

revoke all on function public.admin_catalog_impact() from public, anon;
grant execute on function public.admin_catalog_impact() to authenticated;

revoke all on function public.admin_latest_catalog_snapshot_meta() from public, anon;
grant execute on function public.admin_latest_catalog_snapshot_meta() to authenticated;

revoke all on function public._catalog_capture_payload(uuid[]) from public, anon, authenticated;
revoke all on function public._catalog_prune_snapshots(integer) from public, anon, authenticated;
revoke all on function public._catalog_reset_apply(text, uuid[]) from public, anon, authenticated;
revoke all on function public._catalog_restore_payload(jsonb) from public, anon, authenticated;

revoke all on function public.admin_unlist_all_products(boolean) from public, anon;
grant execute on function public.admin_unlist_all_products(boolean) to authenticated;

revoke all on function public.admin_clear_all_prices(text) from public, anon;
grant execute on function public.admin_clear_all_prices(text) to authenticated;

revoke all on function public.admin_fresh_catalog_reset(text, boolean) from public, anon;
grant execute on function public.admin_fresh_catalog_reset(text, boolean) to authenticated;

revoke all on function public.admin_restore_last_catalog_snapshot(text) from public, anon;
grant execute on function public.admin_restore_last_catalog_snapshot(text) to authenticated;

revoke all on function public.admin_bulk_set_price(uuid[], numeric) from public, anon;
grant execute on function public.admin_bulk_set_price(uuid[], numeric) to authenticated;

revoke all on function public.admin_bulk_activate_eligible(uuid[]) from public, anon;
grant execute on function public.admin_bulk_activate_eligible(uuid[]) to authenticated;

-- QA helper: only products whose slug starts with qa-catalog-reset-.
-- Not granted to API roles. Never used by the Admin buttons.
create or replace function public._catalog_qa_scoped_apply(p_action text)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ids uuid[];
begin
  select coalesce(array_agg(id), '{}'::uuid[])
  into v_ids
  from public.products
  where slug like 'qa-catalog-reset-%';

  if coalesce(array_length(v_ids, 1), 0) = 0 then
    return 0;
  end if;

  return public._catalog_reset_apply(p_action, v_ids);
end;
$$;

revoke all on function public._catalog_qa_scoped_apply(text) from public, anon, authenticated;

comment on function public.admin_fresh_catalog_reset(text, boolean) is
  'Admin-only transactional catalog reset. This migration does not invoke it.';
