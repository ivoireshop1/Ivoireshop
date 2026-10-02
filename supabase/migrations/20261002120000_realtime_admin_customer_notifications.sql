-- Live admin inbox + contact messages + realtime publication.
-- Does not poll carriers or duplicate customer inbox rows.

alter table public.profiles
  add column if not exists admin_notification_sounds boolean not null default true;

create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  email text not null check (char_length(btrim(email)) between 3 and 254),
  message text not null check (char_length(btrim(message)) between 1 and 2000),
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists contact_messages_created_idx
  on public.contact_messages (created_at desc);

alter table public.contact_messages enable row level security;
revoke all on table public.contact_messages from public, anon, authenticated;
grant select on table public.contact_messages to authenticated;

drop policy if exists "Admins read contact messages" on public.contact_messages;
create policy "Admins read contact messages"
on public.contact_messages for select to authenticated
using ((select public.is_admin()));

create table if not exists public.admin_notifications (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  title text not null,
  message text not null,
  order_id uuid references public.orders(id) on delete set null,
  customer_id uuid,
  target_path text,
  source_key text not null,
  created_at timestamptz not null default timezone('utc', now()),
  read_at timestamptz,
  unique (event_type, source_key)
);

create index if not exists admin_notifications_created_idx
  on public.admin_notifications (created_at desc);

create index if not exists admin_notifications_unread_idx
  on public.admin_notifications (created_at desc)
  where read_at is null;

alter table public.admin_notifications enable row level security;
revoke all on table public.admin_notifications from public, anon;
grant select, update on table public.admin_notifications to authenticated;

drop policy if exists "Admins read admin notifications" on public.admin_notifications;
create policy "Admins read admin notifications"
on public.admin_notifications for select to authenticated
using ((select public.is_admin()));

drop policy if exists "Admins update admin notifications" on public.admin_notifications;
create policy "Admins update admin notifications"
on public.admin_notifications for update to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create or replace function public.emit_admin_notification(
  p_event_type text,
  p_title text,
  p_message text,
  p_source_key text,
  p_order_id uuid default null,
  p_customer_id uuid default null,
  p_target_path text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  if p_event_type is null or p_source_key is null then
    return null;
  end if;
  insert into public.admin_notifications (
    event_type, title, message, source_key, order_id, customer_id, target_path
  ) values (
    p_event_type, p_title, p_message, p_source_key, p_order_id, p_customer_id, p_target_path
  )
  on conflict (event_type, source_key) do nothing
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.orders_emit_admin_notification()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_fulfillment text;
begin
  if tg_op = 'INSERT' then
    v_fulfillment := case
      when new.fulfillment_method = 'local_pickup' then 'Pickup'
      when lower(coalesce(new.fulfillment_provider, '')) = 'ups' then 'UPS'
      when lower(coalesce(new.fulfillment_provider, '')) = 'usps' then 'USPS'
      else 'Local'
    end;
    perform public.emit_admin_notification(
      'new_order',
      'New order received',
      coalesce(new.order_number, 'Order')
        || E'\n' || coalesce(new.customer_name, 'Customer')
        || E'\n$' || trim(to_char(coalesce(new.total, 0), 'FM999999990.00'))
        || E'\nFulfillment: ' || v_fulfillment,
      new.id::text,
      new.id,
      new.user_id,
      '/admin/orders/' || new.id::text
    );
  elsif tg_op = 'UPDATE'
    and new.status is distinct from old.status
    and new.status = 'ready_for_delivery'
    and lower(coalesce(new.fulfillment_provider, '')) in ('ups', 'usps') then
    perform public.emit_admin_notification(
      'shipping_attention',
      'Order ready for carrier',
      coalesce(new.order_number, 'Order') || ' is packed and waiting for tracking.',
      new.id::text || ':carrier',
      new.id,
      new.user_id,
      '/admin/orders/' || new.id::text
    );
  end if;
  return new;
end;
$$;

drop trigger if exists orders_emit_admin_notification on public.orders;
create trigger orders_emit_admin_notification
after insert or update of status on public.orders
for each row execute function public.orders_emit_admin_notification();

create or replace function public.reviews_emit_admin_notification()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_product text;
  v_customer text;
begin
  select name into v_product from public.products where id = new.product_id;
  select coalesce(nullif(btrim(full_name), ''), 'Customer') into v_customer from public.profiles where id = new.user_id;
  perform public.emit_admin_notification(
    'new_review',
    'New customer review',
    coalesce(v_product, 'Product')
      || E'\n' || coalesce(v_customer, 'Customer')
      || E'\nRating ' || new.rating::text,
    new.id::text,
    null,
    new.user_id,
    '/admin/reviews'
  );
  return new;
end;
$$;

drop trigger if exists reviews_emit_admin_notification on public.product_reviews;
create trigger reviews_emit_admin_notification
after insert on public.product_reviews
for each row execute function public.reviews_emit_admin_notification();

create or replace function public.contact_emit_admin_notification()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.emit_admin_notification(
    'customer_message',
    'New customer message',
    new.name || E'\n' || left(new.message, 140),
    new.id::text,
    null,
    new.user_id,
    '/admin/messages'
  );
  return new;
end;
$$;

drop trigger if exists contact_emit_admin_notification on public.contact_messages;
create trigger contact_emit_admin_notification
after insert on public.contact_messages
for each row execute function public.contact_emit_admin_notification();

create or replace function public.submit_contact_message(
  p_name text,
  p_email text,
  p_message text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_name text := btrim(coalesce(p_name, ''));
  v_email text := btrim(coalesce(p_email, ''));
  v_message text := btrim(coalesce(p_message, ''));
begin
  if char_length(v_name) < 1 or char_length(v_name) > 120 then
    raise exception using errcode = '22023', message = 'Enter your name.';
  end if;
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' or char_length(v_email) > 254 then
    raise exception using errcode = '22023', message = 'Enter a valid email.';
  end if;
  if char_length(v_message) < 1 or char_length(v_message) > 2000 then
    raise exception using errcode = '22023', message = 'Enter a message.';
  end if;
  insert into public.contact_messages (name, email, message, user_id)
  values (v_name, v_email, v_message, auth.uid())
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.submit_contact_message(text, text, text) from public;
grant execute on function public.submit_contact_message(text, text, text) to anon, authenticated;

alter table public.admin_notifications replica identity full;
alter table public.contact_messages replica identity full;
alter table public.customer_announcements replica identity full;
alter table public.customer_notifications replica identity full;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      execute 'alter publication supabase_realtime add table public.admin_notifications';
    exception when duplicate_object then null;
    end;
    begin
      execute 'alter publication supabase_realtime add table public.customer_announcements';
    exception when duplicate_object then null;
    end;
  end if;
end;
$$;
