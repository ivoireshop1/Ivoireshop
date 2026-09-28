-- Guests must not call admin category-move or internal trigger helpers.
revoke all on function public.admin_bulk_move_canonical_category(uuid[], text) from public, anon;
grant execute on function public.admin_bulk_move_canonical_category(uuid[], text) to authenticated;

revoke all on function public.rls_auto_enable() from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
