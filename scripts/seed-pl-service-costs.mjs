import nextEnv from '@next/env';
nextEnv.loadEnvConfig(process.cwd());
const apply = process.argv.includes('--apply');
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) throw new Error('Falta configurar Supabase en el entorno local.');
const base = new URL(url);
if (base.protocol !== 'https:' || !base.hostname.endsWith('.supabase.co')) throw new Error('URL de Supabase inválida.');
async function request(table, query, row) {
  const response = await fetch(new URL(`/rest/v1/${table}?${query}`,base), {
    method:row?'POST':'GET',headers:{apikey:key,'Content-Type':'application/json',Prefer:'resolution=ignore-duplicates,return=representation'},
    ...(row?{body:JSON.stringify(row)}:{}),signal:AbortSignal.timeout(15000)
  });
  if(!response.ok) throw new Error(`Supabase: HTTP ${response.status} (${table}).`);
  return response.json();
}
const sections = await request('pl_sections','select=id,code,sort_order&order=sort_order');
if(!apply) { console.log(JSON.stringify(sections.map(({code,sort_order})=>({code,sort_order})))); process.exit(0); }
const income=sections.find(s=>s.code==='INGRESOS'), expense=sections.find(s=>s.code==='EGRESOS');
if(!income || !expense || expense.sort_order-income.sort_order<2) throw new Error('Revisar el orden de las secciones antes de insertar.');
await request('pl_sections','on_conflict=code',{code:'COSTOS_SERVICIOS',name:'Costos de Servicios',sort_order:Math.floor((income.sort_order+expense.sort_order)/2)});
const [section]=await request('pl_sections','select=id&code=eq.COSTOS_SERVICIOS');
const groups=[['COSTOS_NOMINA','Salarios Personal en Nómina'],['COSTOS_SHARED_SERVICES','Costo Horario - Equipo Xtendo Shared Services'],['COSTOS_PRESTADORES_BO','Honorarios Prestadores de Servicio Bolivia']];
await request('pl_groups','on_conflict=code',groups.map(([code,name],i)=>({section_id:section.id,code,name,sort_order:(i+1)*10})));
const verified=await request('pl_groups',`select=code&section_id=eq.${section.id}`);
if(!groups.every(([code])=>verified.some(g=>g.code===code))) throw new Error('No se pudieron verificar todos los grupos.');
console.log('Costos de Servicios: sección y tres grupos verificados. Sin modificar importes ni cuentas existentes.');
