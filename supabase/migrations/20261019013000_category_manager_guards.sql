-- Category manager safety: keep nesting to two levels and block cycles.
-- Additive only. Does not change existing category IDs, slugs, or product FKs.

create or replace function public.categories_forbid_nested_parent()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.parent_id is not null then
    if new.id is not null and new.id = new.parent_id then
      raise exception 'Category cannot be its own parent';
    end if;

    if exists (
      select 1
      from public.categories c
      where c.id = new.parent_id
        and c.parent_id is not null
    ) then
      raise exception 'Subcategories cannot have children';
    end if;

    -- A category that already has children cannot become a subcategory.
    if new.id is not null and exists (
      select 1
      from public.categories c
      where c.parent_id = new.id
    ) then
      raise exception 'Categories with subcategories must stay top-level';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists categories_forbid_nested_parent on public.categories;
create trigger categories_forbid_nested_parent
before insert or update on public.categories
for each row execute function public.categories_forbid_nested_parent();
