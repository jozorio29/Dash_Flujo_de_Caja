begin;
create table if not exists public.pl_summary_rows (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 200),
  format text not null check (format in ('amount','percent')),
  tokens jsonb not null check (jsonb_typeof(tokens) = 'array' and jsonb_array_length(tokens) between 1 and 80),
  sort_order integer not null default 10 check (sort_order between 0 and 100000),
  updated_at timestamptz not null default clock_timestamp(),
  updated_by text not null
);
alter table public.pl_summary_rows enable row level security;
revoke all on public.pl_summary_rows from anon, authenticated;
grant select, insert, update, delete on public.pl_summary_rows to service_role;

-- Serialize changes so simultaneous edits cannot introduce a reference cycle
-- or delete a summary row another editor has just referenced.
create or replace function public.mutate_pl_summary(p_action text, p_row jsonb, p_previous timestamptz, p_actor text)
returns setof public.pl_summary_rows
language plpgsql security invoker set search_path = public
as $$
declare target uuid := (p_row->>'id')::uuid; current_version timestamptz;
begin
  perform pg_advisory_xact_lock(27102801);
  select updated_at into current_version from public.pl_summary_rows where id=target;
  if p_action not in ('save','delete') then raise exception 'Invalid action'; end if;
  if current_version is distinct from p_previous then raise exception using errcode='23505', message='Summary changed'; end if;
  if p_action='delete' then
    if current_version is null then raise exception 'Summary missing'; end if;
    if exists(select 1 from public.pl_summary_rows r, jsonb_array_elements(r.tokens) t where r.id<>target and t->>'kind'='reference' and t->>'type'='summary' and t->>'id'=target::text) then
      raise exception using errcode='23503', message='Summary is referenced';
    end if;
    delete from public.pl_summary_rows where id=target;
  else
    insert into public.pl_summary_rows(id,name,format,tokens,sort_order,updated_by)
    values(target,p_row->>'name',p_row->>'format',p_row->'tokens',(p_row->>'sort_order')::integer,p_actor)
    on conflict(id) do update set name=excluded.name,format=excluded.format,tokens=excluded.tokens,sort_order=excluded.sort_order,updated_at=clock_timestamp(),updated_by=excluded.updated_by;
  end if;
  if (select count(*) from public.pl_summary_rows)>100 then raise exception 'Too many summary rows'; end if;
  if exists(select 1 from public.pl_summary_rows r, jsonb_array_elements(r.tokens) t where t->>'kind'='reference' and t->>'type'='summary' and not exists(select 1 from public.pl_summary_rows dest where dest.id::text=t->>'id')) then
    raise exception using errcode='23503', message='Missing summary reference';
  end if;
  if exists(
    select 1 from public.pl_summary_rows r, jsonb_array_elements(r.tokens) t
    where t->>'kind'='reference' and (
      (t->>'type'='account' and not exists(select 1 from public.pl_accounts a where a.id::text=t->>'id')) or
      (t->>'type'='group' and not exists(select 1 from public.pl_groups g where g.id::text=t->>'id')) or
      (t->>'type'='section' and not exists(select 1 from public.pl_sections s where s.id::text=t->>'id'))
    )
  ) then raise exception using errcode='23503', message='Missing source reference'; end if;
  if exists (
    with recursive edges as (
      select r.id source,(t->>'id')::uuid dest from public.pl_summary_rows r, jsonb_array_elements(r.tokens) t where t->>'kind'='reference' and t->>'type'='summary'
    ), walk as (
      select source,dest from edges
      union
      select w.source,e.dest from walk w join edges e on e.source=w.dest
    ) select 1 from walk where source=dest
  ) then raise exception using errcode='23514', message='Circular summary reference'; end if;
  return query select * from public.pl_summary_rows order by sort_order,id;
end;
$$;
revoke all on function public.mutate_pl_summary(text,jsonb,timestamptz,text) from public, anon, authenticated;
grant execute on function public.mutate_pl_summary(text,jsonb,timestamptz,text) to service_role;
-- Referenced source rows cannot be deleted; archiving an account remains safe.
create or replace function public.protect_pl_summary_source()
returns trigger language plpgsql security invoker set search_path = public
as $$
declare ref_type text;
begin
  ref_type := case tg_table_name when 'pl_accounts' then 'account' when 'pl_groups' then 'group' else 'section' end;
  perform pg_advisory_xact_lock(27102801);
  if exists(select 1 from public.pl_summary_rows r, jsonb_array_elements(r.tokens) t where t->>'kind'='reference' and t->>'type'=ref_type and t->>'id'=old.id::text) then
    raise exception using errcode='23503', message='Source is referenced by summary';
  end if;
  return old;
end;
$$;
drop trigger if exists pl_summary_account_guard on public.pl_accounts;
create trigger pl_summary_account_guard before delete on public.pl_accounts for each row execute function public.protect_pl_summary_source();
drop trigger if exists pl_summary_group_guard on public.pl_groups;
create trigger pl_summary_group_guard before delete on public.pl_groups for each row execute function public.protect_pl_summary_source();
drop trigger if exists pl_summary_section_guard on public.pl_sections;
create trigger pl_summary_section_guard before delete on public.pl_sections for each row execute function public.protect_pl_summary_source();
revoke all on function public.protect_pl_summary_source() from public, anon, authenticated;
grant execute on function public.protect_pl_summary_source() to service_role;
commit;
