begin;
-- Run after 20261028_pl_summary_rows.sql. NULL preserves legacy shared formulas.
alter table public.pl_summary_rows add column if not exists cells jsonb
  check (cells is null or jsonb_typeof(cells) = 'object');

alter table public.pl_summary_rows add column if not exists monthly_only boolean not null default false;

create or replace function public.mutate_pl_summary_cells(p_action text, p_row jsonb, p_previous timestamptz, p_actor text)
returns setof public.pl_summary_rows
language plpgsql security invoker set search_path = public
as $$
begin
  perform pg_advisory_xact_lock(27102801);
  if p_action <> 'save' or jsonb_typeof(p_row->'cells') is distinct from 'object' then
    raise exception 'Invalid monthly row';
  end if;
  if exists (
    select 1 from jsonb_each(p_row->'cells') c,
      lateral regexp_matches(c.value->>'input', '@\[([0-9a-f-]{36}):([1-9]|1[0-2])\]', 'gi') ref
    where not exists(select 1 from public.pl_accounts a where a.id::text=lower(ref[1]))
      and not exists(select 1 from public.pl_sections s where s.id::text=lower(ref[1]))
  ) then raise exception using errcode='23503', message='Missing source account'; end if;
  -- Reuse version checks and existing row/dependency protections atomically.
  perform public.mutate_pl_summary(p_action,p_row,p_previous,p_actor);
  update public.pl_summary_rows set cells=p_row->'cells', monthly_only=coalesce((p_row->>'monthly_only')::boolean,false) where id=(p_row->>'id')::uuid;
  return query select * from public.pl_summary_rows order by sort_order,id;
end;
$$;
revoke all on function public.mutate_pl_summary_cells(text,jsonb,timestamptz,text) from public, anon, authenticated;
grant execute on function public.mutate_pl_summary_cells(text,jsonb,timestamptz,text) to service_role;

create or replace function public.protect_pl_summary_cell_source()
returns trigger language plpgsql security invoker set search_path = public
as $$
begin
  perform pg_advisory_xact_lock(27102801);
  if exists(select 1 from public.pl_summary_rows r, jsonb_each(coalesce(r.cells,'{}'::jsonb)) c
    where strpos(lower(c.value->>'input'),'@[' || old.id::text || ':') > 0) then
    raise exception using errcode='23503', message='Account is referenced by a monthly summary cell';
  end if;
  return old;
end;
$$;
drop trigger if exists pl_summary_cell_account_guard on public.pl_accounts;
create trigger pl_summary_cell_account_guard before delete on public.pl_accounts
  for each row execute function public.protect_pl_summary_cell_source();
revoke all on function public.protect_pl_summary_cell_source() from public, anon, authenticated;
grant execute on function public.protect_pl_summary_cell_source() to service_role;
drop trigger if exists pl_summary_cell_section_guard on public.pl_sections;
create trigger pl_summary_cell_section_guard before delete on public.pl_sections
  for each row execute function public.protect_pl_summary_cell_source();
commit;
