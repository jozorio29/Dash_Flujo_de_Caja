begin;

-- Add a new section without changing existing accounts, amounts or formulas.
insert into public.pl_sections (code, name, sort_order)
values ('COSTOS_SERVICIOS', 'Costos de Servicios', 25)
on conflict (code) do nothing;

insert into public.pl_groups (section_id, code, name, sort_order)
select s.id, g.code, g.name, g.sort_order
from public.pl_sections s
cross join (values
  ('COSTOS_NOMINA', 'Salarios Personal en Nómina', 10),
  ('COSTOS_SHARED_SERVICES', 'Costo Horario - Equipo Xtendo Shared Services', 20),
  ('COSTOS_PRESTADORES_BO', 'Honorarios Prestadores de Servicio Bolivia', 30)
) as g(code, name, sort_order)
where s.code = 'COSTOS_SERVICIOS'
on conflict (code) do nothing;

commit;
