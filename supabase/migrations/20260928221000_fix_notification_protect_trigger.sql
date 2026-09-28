-- Allow security-definer retries to update email flags without letting
-- customers rewrite notification content.

create or replace function public.customer_notifications_protect_columns()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE'
     and current_user not in ('postgres', 'supabase_admin')
     and (
       new.id is distinct from old.id
       or new.user_id is distinct from old.user_id
       or new.order_id is distinct from old.order_id
       or new.event_type is distinct from old.event_type
       or new.title is distinct from old.title
       or new.message is distinct from old.message
       or new.confirmation_code is distinct from old.confirmation_code
       or new.email_sent is distinct from old.email_sent
       or new.email_attempted is distinct from old.email_attempted
       or new.created_at is distinct from old.created_at
     )
     and not (select public.is_admin()) then
    raise exception using errcode = '42501', message = 'Notifications can only be marked read.';
  end if;
  if tg_op = 'UPDATE' and new.read_at is not null and old.read_at is not null then
    new.read_at := old.read_at;
  end if;
  return new;
end;
$$;
