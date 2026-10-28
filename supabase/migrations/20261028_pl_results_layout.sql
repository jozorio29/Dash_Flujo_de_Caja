begin;

-- Preserve all account IDs, values and formulas while separating tax expenses.
insert into public.pl_sections (code, name, sort_order)
values ('IMPUESTOS', 'Egresos en impuestos', 31),
       ('DEPRECIACION', 'Depreciación y amortización', 32)
on conflict (code) do update set sort_order = excluded.sort_order;

-- Known catalog tax group, including any nested groups. No account duplication.
with recursive tax_groups as (
  select id from public.pl_groups where code = 'PL_IMPUESTOS'
  union
  select g.id from public.pl_groups g join tax_groups t on g.parent_id = t.id
)
update public.pl_groups
set section_id = (select id from public.pl_sections where code = 'IMPUESTOS'),
    parent_id = case when code = 'PL_IMPUESTOS' then null else parent_id end
where id in (select id from tax_groups);

-- Empty groups let editors add accounts using the existing + action.
insert into public.pl_groups (section_id, code, name, sort_order)
select id, 'PL_IMPUESTOS', 'Impuestos', 10
from public.pl_sections where code = 'IMPUESTOS'
on conflict (code) do nothing;

insert into public.pl_groups (section_id, code, name, sort_order)
select id, 'PL_DEPRECIACION_AMORTIZACION', 'Depreciación y amortización', 10
from public.pl_sections where code = 'DEPRECIACION'
on conflict (code) do nothing;

commit;
