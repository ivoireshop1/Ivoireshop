-- Admin-only account timestamps from auth.users. No tokens, hashes, or secrets.

create or replace function public.admin_customer_account_status(p_user_id uuid)
returns table (
  user_id uuid,
  email text,
  email_confirmed_at timestamptz,
  last_sign_in_at timestamptz,
  banned_until timestamptz,
  account_created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, auth, pg_temp
as $$
begin
  if (select auth.uid()) is null or not (select public.is_admin()) then
    raise exception using errcode = '42501', message = 'Not authorized.';
  end if;

  return query
  select
    u.id,
    u.email::text,
    u.email_confirmed_at,
    u.last_sign_in_at,
    u.banned_until,
    u.created_at
  from auth.users u
  where u.id = p_user_id;
end;
$$;

comment on function public.admin_customer_account_status(uuid) is
  'Admin-only: email confirmation and last sign-in timestamps. Never returns tokens or secrets.';

revoke all on function public.admin_customer_account_status(uuid) from public;
revoke all on function public.admin_customer_account_status(uuid) from anon;
grant execute on function public.admin_customer_account_status(uuid) to authenticated;
