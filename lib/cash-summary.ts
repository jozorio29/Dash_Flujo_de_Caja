import type { Movement, ProjectedMovement } from './types';
const normalized = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
export function cashMonth(date: Date) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`; }
export function buildCashSummary(real: Movement[], planned: ProjectedMovement[], month: string, currency: string, now = new Date(), lineField: 'descPL' | 'conceptoPL' | 'oficina' = 'descPL') {
  const [y,m] = month.split('-').map(Number), days = new Date(y,m,0).getDate();
  const cut = month < cashMonth(now) ? days : month === cashMonth(now) ? now.getDate() : 0;
  const actual = real.filter(r=>r.fecha && cashMonth(r.fecha)===month && r.fecha.getDate()<=cut);
  const forecast = planned.filter(r=>r.fecha && cashMonth(r.fecha)===month);
  const hasForecast = forecast.length > 0;
  let missingRates = 0;
  const rows = actual.map(r=>{
    const rate = currency==='USD' ? (r.saldo && r.saldoUsd ? r.saldoUsd/r.saldo : 0) : 1;
    if(rate<=0 && (r.creditos || r.debitos)) missingRates++;
    return { day:r.fecha!.getDate(), income:r.creditos*Math.max(0,rate), expense:r.debitos*Math.max(0,rate), category:r.conceptoPL || r.categoria || 'Sin categoría', line:r[lineField] || 'Sin clasificar' };
  });
  const plans = forecast.map(r=>({day:r.fecha!.getDate(),income:currency==='USD'?r.creditoUsd:r.ingresos,expense:currency==='USD'?r.debitoUsd:r.egresos,category:r.conceptoPL || r.concepto || 'Sin categoría'}));
  const income = rows.reduce((s,r)=>s+r.income,0), expense = rows.reduce((s,r)=>s+r.expense,0);
  const categories = new Map<string,{name:string;actual:number;forecast:number}>();
  for(const r of rows) if(r.expense) { const key=normalized(r.category); const item=categories.get(key) || {name:r.category,actual:0,forecast:0}; item.actual+=r.expense; categories.set(key,item); }
  for(const r of plans.filter(r=>r.day<=cut)) if(r.expense) { const key=normalized(r.category); const item=categories.get(key) || {name:r.category,actual:0,forecast:0}; item.forecast+=r.expense; categories.set(key,item); }
  const variations=[{name:'Ingresos',actual:income,forecast:plans.filter(r=>r.day<=cut).reduce((s,r)=>s+r.income,0),income:true},...Array.from(categories.values()).map(r=>({...r,income:false}))].map(r=>({...r,delta:r.actual-r.forecast,percent:r.forecast ? (r.actual-r.forecast)/Math.abs(r.forecast)*100 : null}));
  const lines=new Map<string,number>(); rows.forEach(r=>{if(r.income) lines.set(r.line,(lines.get(r.line)||0)+r.income);});
  let actualSum=0,planSum=0;
  const daily=Array.from({length:days},(_,i)=>{ actualSum+=rows.filter(r=>r.day===i+1).reduce((s,r)=>s+r.income,0); planSum+=plans.filter(r=>r.day===i+1).reduce((s,r)=>s+r.income,0); return {day:i+1,actual:i<cut?actualSum:null,forecast:hasForecast?planSum:null}; });
  // Explicit categories only; unmatched cash outflows remain visible separately.
  const operating = /salari|nomina|honorari|gastos generales|alquiler|energia|gastos del personal|cargas sociales|gastos de infraestructura|comercializa|reclutamiento|viaje/;
  const expenses=Array.from(categories.values()).filter(r=>r.actual>0).map(r=>({name:r.name,value:r.actual,operating:operating.test(normalized(r.name))}));
  const closing = [{name:'Ingresos',actual:income,field:'income' as const},{name:'Egresos',actual:expense,field:'expense' as const}].map(r=>({...r,estimate:cut===days?r.actual:hasForecast?r.actual+plans.filter(p=>p.day>cut).reduce((s,p)=>s+p[r.field],0):null,forecast:hasForecast?plans.reduce((s,p)=>s+p[r.field],0):null}));
  return {days,cut,hasForecast,missingRates,income,expense,daily,variations,lines:Array.from(lines,([name,value])=>({name,value})).sort((a,b)=>b.value-a.value),expenses,closing,top:hasForecast?variations.filter(r=>r.delta!==0).sort((a,b)=>Math.abs(b.delta)-Math.abs(a.delta)).slice(0,5):[]};
}
