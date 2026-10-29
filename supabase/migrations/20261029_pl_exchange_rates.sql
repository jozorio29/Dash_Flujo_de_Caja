begin;
create table if not exists public.pl_exchange_rates (
  year integer not null check (year between 2000 and 2100),
  month integer not null check (month between 1 and 12),
  rate numeric(20,6) not null check (rate>0),
  updated_at timestamptz not null default clock_timestamp(),
  updated_by text not null,
  primary key(year,month)
);
alter table public.pl_exchange_rates enable row level security;
revoke all on public.pl_exchange_rates from anon,authenticated;
grant select,insert,update,delete on public.pl_exchange_rates to service_role;
create or replace function public.save_pl_exchange_rates(p_year integer,p_changes jsonb,p_actor text)
returns void language plpgsql security invoker set search_path=public
as $$
declare cell jsonb; current_version timestamptz;
begin
  if p_year is null or p_year not between 2000 and 2100 or jsonb_typeof(p_changes) is distinct from 'array' or jsonb_array_length(p_changes) not between 1 and 12 then raise exception 'Invalid rates'; end if;
  perform pg_advisory_xact_lock(27102902);
  if (select count(*) from jsonb_array_elements(p_changes)) <> (select count(distinct c->>'month') from jsonb_array_elements(p_changes) c) then raise exception 'Duplicate month'; end if;
  for cell in select * from jsonb_array_elements(p_changes) loop
    if (cell->>'month') is null or (cell->>'month')::integer not between 1 and 12 then raise exception 'Invalid month'; end if;
    select updated_at into current_version from public.pl_exchange_rates where year=p_year and month=(cell->>'month')::integer;
    if current_version is distinct from (cell->>'previous')::timestamptz then raise exception using errcode='23505',message='Rate changed'; end if;
    if cell->>'rate' is null then
      delete from public.pl_exchange_rates where year=p_year and month=(cell->>'month')::integer;
    else
      insert into public.pl_exchange_rates(year,month,rate,updated_by)
      values(p_year,(cell->>'month')::integer,(cell->>'rate')::numeric,p_actor)
      on conflict(year,month) do update set rate=excluded.rate,updated_by=excluded.updated_by,updated_at=clock_timestamp();
    end if;
  end loop;
end;
$$;
revoke all on function public.save_pl_exchange_rates(integer,jsonb,text) from public,anon,authenticated;
grant execute on function public.save_pl_exchange_rates(integer,jsonb,text) to service_role;
commit;
