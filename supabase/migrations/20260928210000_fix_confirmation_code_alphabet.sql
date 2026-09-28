-- Confirmation codes must always be IVO- plus 5 alphabet characters.
-- The previous generator used modulo 32 against a 31-character alphabet,
-- which could omit a character when the remainder was 31.

create or replace function public.generate_order_confirmation_code()
returns text
language plpgsql
volatile
set search_path = public, pg_temp
as $$
declare
  alphabet constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  raw bytea;
  candidate text;
  i integer;
  attempt integer := 0;
begin
  loop
    attempt := attempt + 1;
    if attempt > 32 then
      raise exception using errcode = 'P0001', message = 'Unable to allocate a confirmation code.';
    end if;
    raw := decode(replace(gen_random_uuid()::text, '-', ''), 'hex');
    candidate := 'IVO-';
    for i in 0..4 loop
      candidate := candidate || substr(alphabet, (get_byte(raw, i) % char_length(alphabet)) + 1, 1);
    end loop;
    exit when char_length(candidate) = 9
      and not exists (select 1 from public.orders where confirmation_code = candidate);
  end loop;
  return candidate;
end;
$$;

revoke all on function public.generate_order_confirmation_code() from public, anon, authenticated;
