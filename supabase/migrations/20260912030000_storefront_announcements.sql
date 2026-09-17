create table public.storefront_announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  badge text not null default 'Featured',
  cta_label text not null default 'Learn more',
  cta_destination text,
  product_id uuid references public.products(id) on delete set null,
  image_url text,
  is_published boolean not null default false,
  starts_at timestamptz,
  ends_at timestamptz,
  priority integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index storefront_announcements_published_idx
  on public.storefront_announcements (is_published, priority desc, starts_at, ends_at);

create trigger storefront_announcements_set_updated_at
before update on public.storefront_announcements
for each row execute function public.set_updated_at();

alter table public.storefront_announcements enable row level security;

create policy "Published announcements are public"
on public.storefront_announcements for select to anon, authenticated
using (
  is_published
  and (starts_at is null or starts_at <= now())
  and (ends_at is null or ends_at >= now())
  or (select public.is_admin())
);

create policy "Admins manage storefront announcements"
on public.storefront_announcements for all to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));
