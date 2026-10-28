import { evaluateFormula } from './pl-formula';
import { displayAmount, normalizeAmount, sumAmounts, type PLData } from './pl-model';

export type SummaryReference = 'account' | 'group' | 'section' | 'summary';
export type SummaryToken = { kind: 'reference'; type: SummaryReference; id: string } | {kind:'number'; value:string} | {kind:'operator'; value:string};
export interface SummaryRow { id:string; name:string; format:'amount'|'percent'; tokens:SummaryToken[]; sort_order:number; updated_at:string; updated_by?:string; monthly_only?:boolean; cells?:Record<string, {input:string; format: 'amount'|'percent'}> | null }
export interface SummaryResult { amount:string|null; error?:string }
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function summaryExpression(tokens:SummaryToken[]) {
  return '=' + tokens.map((token,index)=>token.kind==='reference'?`R${index+1}`:token.kind==='number'?`(${token.value})`:token.value).join(' ');
}
export function validateSummary(rows:SummaryRow[], data:Pick<PLData,'accounts'|'groups'|'sections'>) {
  if(rows.length>100) throw new Error('Se admiten hasta 100 filas de resumen.');
  for(const row of rows) {
    if(!uuid.test(row.id) || typeof row.name!=='string' || !row.name.trim() || row.name.length>200 || !['amount','percent'].includes(row.format) || !Number.isInteger(row.sort_order) || row.sort_order<0 || row.sort_order>100000) throw new Error('Nombre, formato u orden inválidos.');
    if(row.monthly_only!==undefined && typeof row.monthly_only!=='boolean')throw new Error('Modo de fila inválido.');
    if(row.cells != null) {
      if(typeof row.cells!=='object' || Array.isArray(row.cells) || Object.keys(row.cells).length>2424) throw new Error('Celdas inválidas.');
      for(const [key,cell] of Object.entries(row.cells)) {
        if(!/^(20[0-9]{2}|2100):(USD|BOB):([1-9]|1[0-2])$/.test(key) || !cell || !['amount','percent'].includes(cell.format) || typeof cell.input!=='string' || cell.input.length>500) throw new Error('Celda o período inválido.');
        if(cell.input!=='')validateSummaryInput(cell.input,data);
      }
    }
    if(!Array.isArray(row.tokens) || !row.tokens.length || row.tokens.length>80) throw new Error('Agrega una fórmula de hasta 80 elementos.');
    for(const token of row.tokens) {
      if(!token || typeof token!=='object') throw new Error('Elemento de fórmula inválido.');
      if(token.kind==='number') { if(typeof token.value!=='string') throw new Error('Número inválido.'); normalizeAmount(token.value); }
      else if(token.kind==='operator') { if(!['+','-','*','/','(',')','%'].includes(token.value)) throw new Error('Operador inválido.'); }
      else if(token.kind==='reference') {
        if(!uuid.test(token.id)) throw new Error('Referencia inválida.');
        const source = token.type==='account'?data.accounts:token.type==='group'?data.groups:token.type==='section'?data.sections:token.type==='summary'?rows:null;
        if(!source?.some(r=>r.id===token.id)) throw new Error('Una referencia ya no existe. Edita la fórmula.');
      } else throw new Error('Elemento de fórmula inválido.');
    }
    // Division and multiplication share the same grammar. Replace division only
    // for syntax validation so missing/zero inputs cannot short-circuit parsing.
    try { evaluateFormula(summaryExpression(row.tokens).replaceAll('/', '*'),()=> '0'); }
    catch(e) { if(!(e instanceof Error) || !/^Usa un número sin separadores/.test(e.message)) throw e; }
  }
  const visiting=new Set<string>(), done=new Set<string>();
  function visit(id:string) {
    if(visiting.has(id)) throw new Error('Referencia circular entre filas de resumen.');
    if(done.has(id)) return;
    visiting.add(id);
    rows.find(r=>r.id===id)?.tokens.forEach(t=>{if(t.kind==='reference' && t.type==='summary')visit(t.id);});
    visiting.delete(id);done.add(id);
  }
  rows.forEach(r=>visit(r.id));
}
class Pending extends Error {}
export function calculateSummary(data:PLData, rows:SummaryRow[], year=2026, currency='USD'):Map<string,SummaryResult[]> {
  const cache=new Map<string,SummaryResult>(), visiting=new Set<string>();
  function aggregate(type:SummaryReference,id:string,month:number):string {
    if(type==='summary') {
      const result=resolve(id,month);
      if(result.error) throw new Error(result.error);
      if(result.amount===null) throw new Pending();
      return result.amount;
    }
    let ids:string[]=[];
    if(type==='account') {
      if(!data.accounts.some(a=>a.id===id))throw new Error('La cuenta referenciada ya no existe.');
      ids=[id];
    } else {
      const groups=new Set<string>();
      if(type==='section') {
        if(!data.sections.some(s=>s.id===id))throw new Error('La sección referenciada ya no existe.');
        data.groups.filter(g=>g.section_id===id).forEach(g=>groups.add(g.id));
      } else {
        if(!data.groups.some(g=>g.id===id))throw new Error('El grupo referenciado ya no existe.');
        const visit=(groupId:string)=>{if(groups.has(groupId))return;groups.add(groupId);data.groups.filter(g=>g.parent_id===groupId).forEach(g=>visit(g.id));};visit(id);
      }
      ids=data.accounts.filter(a=>groups.has(a.group_id)).map(a=>a.id);
    }
    const selected=data.values.filter(v=>ids.includes(v.account_id) && (month===0 || v.month===month));
    if(selected.some(v=>v.formulaError))throw new Error('Una cuenta de origen tiene un error de fórmula.');
    const sum=sumAmounts(selected.map(v=>v.amount));
    if(sum===null)throw new Pending();
    return sum;
  }
  function resolve(id:string,month:number):SummaryResult {
    const key=`${id}:${month}`;
    if(cache.has(key))return cache.get(key)!;
    if(visiting.has(key))return {amount:null,error:'Referencia circular.'};
    const row=rows.find(r=>r.id===id);
    if(!row)return {amount:null,error:'La fila de resumen ya no existe.'};
    visiting.add(key);
    let result:SummaryResult;
    try {
      if(row.cells != null && (row.monthly_only !== false || Object.prototype.hasOwnProperty.call(row.cells,`${year}:${currency}:${month}`) || month===0 && Object.keys(row.cells).some(k=>k.startsWith(`${year}:${currency}:`)))) {
        if(month===0) {
          const parts=Array.from({length:12},(_,i)=>resolve(id,i+1));
          const hasPercent=row.format==='percent' || Array.from({length:12},(_,i)=>row.cells?.[`${year}:${currency}:${i+1}`]).some(c=>c?.format==='percent');
          const error=parts.find(p=>p.error)?.error;
          result=error?{amount:null,error}:{amount:hasPercent?null:sumAmounts(parts.flatMap(p=>p.amount===null?[]:[p.amount]))};
        } else {
          const cell=row.cells[`${year}:${currency}:${month}`];
          result={amount:!cell || !cell.input?null:evaluateSummaryInput(cell.input,data)};
        }
      } else if(month===0 && row.format==='amount') {
        const months=Array.from({length:12},(_,i)=>resolve(id,i+1));
        const error=months.find(m=>m.error)?.error;
        result=error?{amount:null,error}:{amount:sumAmounts(months.flatMap(m=>m.amount===null?[]:[m.amount]))};
      } else {
        const amount=evaluateFormula(summaryExpression(row.tokens),ref=>{
          const token=row.tokens[Number(ref.slice(1))-1];
          if(token?.kind!=='reference')throw new Error('Referencia inválida.');
          return aggregate(token.type,token.id,month);
        });
        result={amount};
      }
    } catch(e) { result=e instanceof Pending?{amount:null}:{amount:null,error:e instanceof Error?e.message:'Fórmula inválida.'}; }
    visiting.delete(key);cache.set(key,result);return result;
  }
  return new Map(rows.map(row=>[row.id,[...Array.from({length:12},(_,i)=>resolve(row.id,i+1)),resolve(row.id,0)]]));
}
export function formatSummary(result:SummaryResult, format:SummaryRow['format']) {
  if(result.error)return '#ERROR';
  if(result.amount===null)return '';
  if(format==='percent')return new Intl.NumberFormat('es-BO',{style:'percent',maximumFractionDigits:2}).format(Number(result.amount));
  return result.amount==='0'?'—':displayAmount(result.amount);
}

// Monthly formulas use stable account IDs, the same references as the main P&L.
export function validateSummaryInput(input:string, data:Pick<PLData,'accounts'|'sections'>) {
  if(!input.startsWith('=')) { normalizeAmount(input); return; }
  evaluateFormula(input.replaceAll('/', '*'),ref=>{
    const match=/^@\[([0-9a-f-]{36}):([1-9]|1[0-2])\]$/i.exec(ref);
    if(!match || !data.accounts.some(a=>a.id===match[1]) && !data.sections.some(s=>s.id===match[1]))throw new Error('La cuenta referenciada no existe.');
    return '1';
  });
}
export function evaluateSummaryInput(input:string,data:PLData):string {
  if(!input.startsWith('='))return normalizeAmount(input);
  return evaluateFormula(input,ref=>{
    const match=/^@\[([0-9a-f-]{36}):([1-9]|1[0-2])\]$/i.exec(ref);
    if(!match || !data.accounts.some(a=>a.id===match[1]) && !data.sections.some(s=>s.id===match[1]))throw new Error('La cuenta referenciada no existe.');
    if(data.sections.some(s=>s.id===match[1])) {
      const groups=new Set(data.groups.filter(g=>g.section_id===match[1]).map(g=>g.id));
      const accounts=new Set(data.accounts.filter(a=>groups.has(a.group_id)).map(a=>a.id));
      const values=data.values.filter(v=>accounts.has(v.account_id) && v.month===Number(match[2]));
      if(values.some(v=>v.formulaError))throw new Error('Una cuenta del total contiene un error de fórmula.');
      const total=sumAmounts(values.map(v=>v.amount));
      // Spreadsheet references treat empty source cells as zero without writing
      // a zero into the source or hiding genuine formula errors.
      return total ?? '0';
    }
    const value=data.values.find(v=>v.account_id===match[1] && v.month===Number(match[2]));
    if(value?.formulaError)throw new Error(value.formulaError);
    return value?.amount ?? '0';
  });
}
