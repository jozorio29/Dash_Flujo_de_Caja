begin;
-- URL metadata only. Images and PDF files remain in Drive or their original host.
create table if not exists public.pl_cell_links (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references public.pl_accounts(id) on delete cascade,
  summary_id uuid references public.pl_summary_rows(id) on delete cascade,
  year integer not null check (year between 2000 and 2100),
  month integer not null check (month between 1 and 12),
  currency text not null check (currency in ('USD','BOB')),
  url text not null check (length(url)<=2048 and url like 'https://%'),
  updated_at timestamptz not null default clock_timestamp(),
  updated_by text not null,
  check ((account_id is not null)::integer+(summary_id is not null)::integer=1)
);
create unique index if not exists pl_cell_links_account_key on public.pl_cell_links(account_id,year,month,currency) where account_id is not null;
create unique index if not exists pl_cell_links_summary_key on public.pl_cell_links(summary_id,year,month,currency) where summary_id is not null;
alter table public.pl_cell_links enable row level security;
revoke all on public.pl_cell_links from anon, authenticated;
grant select,insert,update,delete on public.pl_cell_links to service_role;
create or replace function public.mutate_pl_cell_link(p_kind text,p_source uuid,p_year integer,p_month integer,p_currency text,p_url text,p_previous timestamptz,p_actor text)
returns setof public.pl_cell_links language plpgsql security invoker set search_path=public
as $$
declare current_row public.pl_cell_links; saved_id uuid;
begin
  if p_kind not in ('account','summary') or p_year not between 2000 and 2100 or p_month not between 1 and 12 or p_currency not in ('USD','BOB') then raise exception 'Invalid cell'; end if;
  perform pg_advisory_xact_lock(27102901);
  select * into current_row from public.pl_cell_links where year=p_year and month=p_month and currency=p_currency and
    ((p_kind='account' and account_id=p_source) or (p_kind='summary' and summary_id=p_source));
  if current_row.updated_at is distinct from p_previous then raise exception using errcode='23505',message='Link changed'; end if;
  if p_url is null then
    delete from public.pl_cell_links where id=current_row.id;
    return;
  end if;
  if current_row.id is null then
    insert into public.pl_cell_links(account_id,summary_id,year,month,currency,url,updated_by)
      values(case when p_kind='account' then p_source end,case when p_kind='summary' then p_source end,p_year,p_month,p_currency,p_url,p_actor)
      returning id into saved_id;
  else
    update public.pl_cell_links set url=p_url,updated_at=clock_timestamp(),updated_by=p_actor where id=current_row.id returning id into saved_id;
  end if;
  return query select * from public.pl_cell_links where id=saved_id;
end;
$$;
revoke all on function public.mutate_pl_cell_link(text,uuid,integer,integer,text,text,timestamptz,text) from public,anon,authenticated;
grant execute on function public.mutate_pl_cell_link(text,uuid,integer,integer,text,text,timestamptz,text) to service_role;
commit;
