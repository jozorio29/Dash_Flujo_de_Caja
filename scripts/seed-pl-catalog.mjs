import fs from 'node:fs';
import ts from 'typescript';
import nextEnv from '@next/env';
nextEnv.loadEnvConfig(process.cwd());
const source = fs.readFileSync(new URL('../lib/income-statement.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const module = { exports: {} };
new Function('exports', 'module', compiled)(module.exports, module);
const sections = module.exports.statementSections;
const tigo = ['TIGO_ESIM','TIGO_CALL_CENTER','TIGO_TELEVENTAS_BO','TIGO_TELEVENTAS_UY','TIGO_OTROS','TIGO_CAP_CALL_CENTER','TIGO_CAP_TELEVENTAS','TIGO_CAP_PORTABILIDAD'];
const apply = process.argv.includes('--apply');
if (!apply && !process.argv.includes('--verify')) {
  console.log('Catálogo: ' + sections.flatMap(s => s.groups.flatMap(g => g.accounts)).length + ' cuentas. Usa --apply para agregar los registros faltantes sin cambiar importes ni nombres existentes.');
  process.exit(0);
}
const base = new URL(process.env.SUPABASE_URL);
if (base.protocol !== 'https:' || !base.hostname.endsWith('.supabase.co') || !process.env.SUPABASE_SECRET_KEY) throw new Error('Configuración de Supabase inválida.');
async function request(table, query, body) {
  const response = await fetch(new URL('/rest/v1/' + table + '?' + query, base), {
    method: body ? 'POST' : 'GET',
    headers: { apikey: process.env.SUPABASE_SECRET_KEY, 'Content-Type': 'application/json', Prefer: 'resolution=ignore-duplicates,return=representation' },
    ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`Error HTTP ${response.status} en ${table}.`);
  return response.json();
}
async function ensure(table, row) {
  await request(table, 'on_conflict=code', row);
  const found = await request(table, 'select=id&code=eq.' + encodeURIComponent(row.code));
  if (!found[0]) throw new Error('No se encontró el registro.');
  return found[0].id;
}
if (process.argv.includes('--verify')) {
  for (const table of ['pl_sections', 'pl_groups', 'pl_accounts']) {
    const rows = await request(table, 'select=id');
    console.log(table + ': ' + rows.length + ' registros');
  }
  const rows = await request('pl_monthly_values', 'select=id,amount::text&year=eq.2026&currency=eq.USD');
  console.log('Lectura de importes decimales: OK (' + rows.length + ' registros)');
  console.log('Editores configurados: ' + ((process.env.PL_EDITOR_EMAILS || '').split(',').filter(x => x.trim()).length));
  process.exit(0);
}
for (const [si, section] of sections.entries()) {
  const sectionId = await ensure('pl_sections', { code: section.id.toUpperCase(), name: section.label, sort_order: (si + 1) * 10 });
  for (const [gi, group] of section.groups.entries()) {
    let parent_id = null;
    if (group.id === 'alquiler') parent_id = await ensure('pl_groups', { code: 'GASTOS_ADMIN', name: 'Gastos administrativos', section_id: sectionId, sort_order: 50 });
    const code = group.id === 'tigo' ? 'INGRESO_TIGO' : group.id === 'alquiler' ? 'ALQUILERES_OFICINA' : 'PL_' + group.id.toUpperCase().replaceAll('-', '_');
    const groupId = await ensure('pl_groups', { code, name: group.id === 'alquiler' ? 'Alquileres de oficina' : group.label, section_id: sectionId, parent_id, sort_order: (gi + 1) * 10 });
    if (group.accounts.length) await request('pl_accounts', 'on_conflict=code', group.accounts.map((name, i) => ({ code: group.id === 'tigo' ? tigo[i] : `${code}_${String(i + 1).padStart(3, '0')}`, name, group_id: groupId, sort_order: (i + 1) * 10 })));
  }
  console.log('Catálogo preparado: ' + section.label);
}
console.log('Carga terminada. No se modificaron importes existentes.');
