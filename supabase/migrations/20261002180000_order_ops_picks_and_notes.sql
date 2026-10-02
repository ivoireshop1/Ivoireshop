-- Admin operational picking and internal notes.
-- Separate from order_items so customers and guests cannot read fulfillment ops data.

create table if not exists public.order_item_picks (
  order_item_id uuid primary key references public.order_items(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  picked_at timestamptz not null default now(),
  picked_by uuid references auth.users(id) on delete set null
);

create index if not exists order_item_picks_order_id_idx on public.order_item_picks(order_id);

create table if not exists public.order_internal_notes (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create index if not exists order_internal_notes_order_id_idx on public.order_internal_notes(order_id, created_at desc);

drop trigger if exists order_internal_notes_set_updated_at on public.order_internal_notes;
create trigger order_internal_notes_set_updated_at
before update on public.order_internal_notes
for each row execute function public.set_updated_at();

alter table public.order_item_picks enable row level security;
alter table public.order_internal_notes enable row level security;

revoke all on table public.order_item_picks from public, anon;
revoke all on table public.order_internal_notes from public, anon;
grant select, insert, delete on table public.order_item_picks to authenticated;
grant select, insert, update on table public.order_internal_notes to authenticated;

drop policy if exists order_item_picks_admin_select on public.order_item_picks;
drop policy if exists order_item_picks_admin_insert on public.order_item_picks;
drop policy if exists order_item_picks_admin_delete on public.order_item_picks;
create policy order_item_picks_admin_select
on public.order_item_picks for select to authenticated
using ((select public.is_admin()));
create policy order_item_picks_admin_insert
on public.order_item_picks for insert to authenticated
with check ((select public.is_admin()));
create policy order_item_picks_admin_delete
on public.order_item_picks for delete to authenticated
using ((select public.is_admin()));

drop policy if exists order_internal_notes_admin_select on public.order_internal_notes;
drop policy if exists order_internal_notes_admin_insert on public.order_internal_notes;
drop policy if exists order_internal_notes_admin_update on public.order_internal_notes;
create policy order_internal_notes_admin_select
on public.order_internal_notes for select to authenticated
using ((select public.is_admin()));
create policy order_internal_notes_admin_insert
on public.order_internal_notes for insert to authenticated
with check ((select public.is_admin()));
create policy order_internal_notes_admin_update
on public.order_internal_notes for update to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

alter table public.order_item_picks replica identity full;
alter table public.order_internal_notes replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'order_item_picks'
  ) then
    execute 'alter publication supabase_realtime add table public.order_item_picks';
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'order_internal_notes'
  ) then
    execute 'alter publication supabase_realtime add table public.order_internal_notes';
  end if;
end $$;
