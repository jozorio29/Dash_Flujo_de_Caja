import { evaluateFormula } from './pl-formula';
import type { PLAccount, PLData, PLValue } from './pl-model';

type Sheet = Pick<PLData, 'sections' | 'groups' | 'accounts' | 'values'>;
const reference = /@\[([0-9a-f-]{36}):([1-9]|1[0-2])\]/gi;
const ordered = <T extends {sort_order:number;id:string}>(rows:T[]) => [...rows].sort((a,b)=>a.sort_order-b.sort_order || a.id.localeCompare(b.id));

// Number detail accounts independently of collapsed groups and presentation totals.
export function referenceRows(data: Sheet): PLAccount[] {
  const result: PLAccount[] = [], visited = new Set<string>();
  const visit = (id:string) => {
    if(visited.has(id)) return;
    visited.add(id);
    result.push(...ordered(data.accounts.filter(a=>a.group_id===id)));
    ordered(data.groups.filter(g=>g.parent_id===id)).forEach(g=>visit(g.id));
  };
  ordered(data.sections).forEach(section=>ordered(data.groups.filter(g=>g.section_id===section.id && !g.parent_id)).forEach(g=>visit(g.id)));
  return result;
}
export function cellAddress(rows: PLAccount[], id:string, month:number): string {
  const index = rows.findIndex(row=>row.id===id);
  return index < 0 ? '#REF!' : `${String.fromCharCode(65+month)}${index+1}`;
}
export function displayFormula(formula:string, rows:PLAccount[]):string {
  return formula.replace(reference, (_,id,month)=>cellAddress(rows,id,Number(month)));
}
export function compileFormula(formula:string, rows:PLAccount[]):string {
  if(formula.includes('@')) throw new Error('Escribe una referencia visible, por ejemplo D2.');
  const compiled = formula.trim().replace(/\b([A-Za-z]+)([1-9]\d*)\b/g, (match,column,row) => {
    const month = column.toUpperCase().charCodeAt(0)-65;
    const account = rows[Number(row)-1];
    if(column.length!==1 || month<1 || month>12 || !account) throw new Error(`La celda ${match} no existe. Usa columnas B a M y una fila de cuenta.`);
    return `@[${account.id}:${month}]`;
  });
  if(compiled.length>500) throw new Error('La fórmula tiene demasiadas referencias. Divide el cálculo en varias celdas.');
  return compiled;
}

/** Recalculate on every read. Persisted amount is only a snapshot for formulas. */
export function recalculateValues(data:Sheet):PLValue[] {
  const values = new Map(data.values.map(value=>[`${value.account_id}:${value.month}`,value]));
  const accounts = new Set(data.accounts.map(a=>a.id));
  const cache = new Map<string,string>();
  const visiting = new Set<string>();
  function resolve(key:string):string {
    if(cache.has(key)) return cache.get(key)!;
    if(visiting.has(key)) throw new Error('Referencia circular: una celda depende de sí misma.');
    if(visiting.size>=128) throw new Error('La cadena de referencias es demasiado larga.');
    const [id] = key.split(':');
    if(!accounts.has(id)) throw new Error('La cuenta referenciada ya no existe.');
    const value = values.get(key);
    if(!value) return '0';
    if(!value.formula) return value.amount;
    visiting.add(key);
    try {
      const result = evaluateFormula(value.formula, token=>{
        const match = /^@\[([0-9a-f-]{36}):([1-9]|1[0-2])\]$/i.exec(token);
        if(!match) throw new Error('Referencia no reconocida. Vuelve a editar la fórmula.');
        return resolve(`${match[1]}:${Number(match[2])}`);
      });
      cache.set(key,result); return result;
    } finally { visiting.delete(key); }
  }
  return data.values.map(value=>{
    try { return {...value,amount:resolve(`${value.account_id}:${value.month}`),formulaError:undefined}; }
    catch(e) { return {...value,formulaError:(e as Error).message}; }
  });
}

export function previewCell(data:Sheet, accountId:string, month:number, formula:string):PLValue {
  const existing=data.values.find(v=>v.account_id===accountId && v.month===month);
  const candidate:PLValue={id:existing?.id || '',account_id:accountId,year:existing?.year || 2026,month,currency:existing?.currency || 'USD',amount:'0',updated_at:existing?.updated_at || '',formula};
  const values=recalculateValues({...data,values:[...data.values.filter(v=>!(v.account_id===accountId && v.month===month)),candidate]});
  return values.find(v=>v.account_id===accountId && v.month===month)!;
}
