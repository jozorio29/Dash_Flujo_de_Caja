begin;
-- Delete the account and its monthly amounts atomically. Existing summary guards
-- can reject the account deletion; PostgreSQL then rolls back the amounts too.
create or replace function public.delete_pl_account(p_id uuid)
returns setof public.pl_accounts
language plpgsql security invoker set search_path=public
as $$
declare target public.pl_accounts;
begin
  perform pg_advisory_xact_lock(27102801);
  lock table public.pl_monthly_values in share row exclusive mode;
  select * into target from public.pl_accounts where id=p_id for update;
  if not found then return; end if;
  if exists(select 1 from public.pl_monthly_values
    where account_id <> p_id and strpos(lower(coalesce(formula,'')), '@[' || p_id::text || ':') > 0) then
    raise exception using errcode='23503',message='Account is referenced by a formula';
  end if;
  delete from public.pl_monthly_values where account_id=p_id;
  delete from public.pl_accounts where id=p_id;
  return next target;
end;
$$;
revoke all on function public.delete_pl_account(uuid) from public,anon,authenticated;
grant execute on function public.delete_pl_account(uuid) to service_role;
commit;
