begin;

alter table public.pl_monthly_values
  add column if not exists formula text
  check (formula is null or (left(formula, 1) = '=' and length(formula) <= 500));

comment on column public.pl_monthly_values.formula is
  'Expresión aritmética original; amount guarda el resultado calculado en el servidor.';

notify pgrst, 'reload schema';
commit;
