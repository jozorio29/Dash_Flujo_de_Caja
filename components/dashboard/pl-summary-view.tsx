"use client";

import { useEffect, useMemo, useState, useRef } from 'react';
import { usePLCellLinks } from './pl-cell-links';
import { convertSummaryResults } from '@/lib/pl-exchange';
import { PLFillHandle } from './pl-fill-handle';
import { shiftPLFormula } from '@/lib/pl-fill';
import { createPortal } from 'react-dom';
import { Plus, RefreshCw } from 'lucide-react';
import { FormulaDetailsCard } from './formula-details-card';
import type { PLAccount, PLData } from '@/lib/pl-model';
import { normalizeAmount } from '@/lib/pl-model';
import { evaluateFormula } from '@/lib/pl-formula';
import { compileFormula, displayFormula, referenceRows } from '@/lib/pl-references';
import { calculateSummary, evaluateSummaryInput, formatSummary, validateSummary, type SummaryRow } from '@/lib/pl-summary';

const button='rounded-lg border bg-card px-3 py-2 text-xs font-medium hover:bg-muted disabled:opacity-50';
interface Props {toolbarHost:HTMLDivElement|null;data:PLData;year:number;currency:string;locked:boolean;onEditingChange:(editing:boolean)=>void;onNavigateReference:(account:PLAccount,month:number)=>void}
export function PLSummaryView({data,year,currency,locked,onEditingChange,onNavigateReference,toolbarHost}:Props) {
  const [rows,setRows]=useState<SummaryRow[]>([]);
  const [enabled,setEnabled]=useState(false);
  const [loading,setLoading]=useState(true);
  const [revision,setRevision]=useState(0);
  const [error,setError]=useState('');
  const [saving,setSaving]=useState(false);
  const [confirmDelete,setConfirmDelete]=useState(false);
  const [edit,setEdit]=useState<{row:SummaryRow;month:number}|null>(null);
  const [draft,setDraft]=useState('');
  useEffect(()=>{
    if(!edit || saving)return;
    const cancel=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();setEdit(null);setError('');setConfirmDelete(false);}};
    window.addEventListener('keydown',cancel);
    return()=>window.removeEventListener('keydown',cancel);
  },[edit,saving]);
  const cellLinks=usePLCellLinks(year,data.conversion?'BOB':currency,'summary',data.canEdit,locked || saving || Boolean(edit));
  const accounts=useMemo(()=>[...referenceRows(data),...data.sections.map(s=>({id:s.id,name:`Total ${s.name}`,group_id:'',code:s.code,active:false,sort_order:s.sort_order}))],[data]);
  const inputRef=useRef<HTMLInputElement>(null);
  useEffect(()=>{
    if(!edit?.month || !draft.trim().startsWith('=') || saving || locked)return;
    const selectTotal=(event:MouseEvent)=>{
      const target=event.target instanceof Element?event.target.closest<HTMLElement>('[data-summary-section]'):null;
      if(!target)return;
      const index=accounts.findIndex(a=>a.id===target.dataset.summarySection);
      const month=Number(target.dataset.summaryMonth);
      if(index<0 || month<1 || month>12)return;
      event.preventDefault();event.stopPropagation();
      const input=inputRef.current;
      const start=input?.selectionStart ?? draft.length,end=input?.selectionEnd ?? start;
      const ref=`${String.fromCharCode(65+month)}${index+1}`;
      setDraft(draft.slice(0,start)+ref+draft.slice(end));setError('');
      requestAnimationFrame(()=>{inputRef.current?.focus({preventScroll:true});inputRef.current?.setSelectionRange(start+ref.length,start+ref.length);});
    };
    document.addEventListener('mousedown',selectTotal,true);
    return()=>document.removeEventListener('mousedown',selectTotal,true);
  },[edit,draft,saving,locked,accounts]);
  const calculated=useMemo(()=>{
    if(!data.conversion)return calculateSummary(data,rows,year,currency);
    const source={...data,values:data.conversion.sourceValues};
    return convertSummaryResults(calculateSummary(source,rows,year,'BOB'),rows,year,data.conversion.rates);
  },[data,rows,year,currency]);
  useEffect(()=>{onEditingChange(Boolean(edit));return()=>onEditingChange(false);},[Boolean(edit),onEditingChange]);
  useEffect(()=>{
    const controller=new AbortController();setLoading(true);setError('');
    fetch('/api/estado-resultados/resumen',{signal:controller.signal,cache:'no-store'}).then(async response=>{
      const body=await response.json();if(!response.ok)throw new Error(body.error || 'No se pudo cargar el resumen.');
      if(!controller.signal.aborted){setRows(body.rows);setEnabled(Boolean(body.enabled && body.monthlyEnabled));}
    }).catch(e=>{if(!controller.signal.aborted)setError(e.message);}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return ()=>controller.abort();
  },[revision]);
  useEffect(()=>{setEdit(null);setError('');},[year,currency]);
  useEffect(()=>{
    if(!edit)return;
    const guard=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};window.addEventListener('beforeunload',guard);return()=>window.removeEventListener('beforeunload',guard);
  },[edit]);
  function start(row:SummaryRow,month:number) {
    if(locked || saving || !enabled || !data.canEdit)return;
    const cell=row.cells?.[`${year}:${currency}:${month}`];
    setDraft(month===0?row.name:cell?cell.input.startsWith('=')?displayFormula(cell.input,accounts):cell.format==='percent'?`${evaluateFormula(`=${cell.input || "0"}*100`)}%`:cell.input:row.cells==null?(calculated.get(row.id)?.[month-1].amount ?? ''):'');
    setEdit({row,month});setConfirmDelete(false);setError('');
  }
  function add() {
    const row:SummaryRow={id:crypto.randomUUID(),name:'',format:'amount',tokens:[{kind:'number',value:'0'}],cells:{},sort_order:Math.min(100000,Math.max(0,...rows.map(r=>r.sort_order))+10),updated_at:'',monthly_only:true};
    start(row,0);
  }
  async function save() {
    if(!edit || saving || locked || !enabled)return;
    let row={...edit.row};
    try {
      if(edit.month===0)row.name=draft.trim();
      else {
        // Monthly overrides preserve legacy formulas for untouched periods.
        const key=`${year}:${currency}:${edit.month}`;
        const cells={...row.cells}; const value=draft.trim();
        if(!value) { if(row.monthly_only===false || row.cells==null)cells[key]={input:'',format:'amount'};else delete cells[key]; }
        else {
          const percent=!value.startsWith('=') && /^-?\d+(?:[.,]\d+)?%$/.test(value);
          cells[key]={input:value.startsWith('=')?compileFormula(value,accounts):percent?evaluateFormula(`=${value}`):normalizeAmount(value),format:percent?'percent':'amount'};
        }
        row={...row,cells,monthly_only:row.monthly_only ?? (row.cells!=null)};
      }
      validateSummary([...rows.filter(r=>r.id!==row.id),row],data);
    }catch(e){setError(e instanceof Error?e.message:'Revisa el valor.');return;}
    setSaving(true);setError('');
    try {
      const response=await fetch('/api/estado-resultados/resumen',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'save',row,previous:row.updated_at || null,year,currency})});
      const body=await response.json();if(!response.ok)throw new Error(body.error || 'No se pudo guardar.');
      setRows(body.rows);setEdit(null);
    }catch(e){setError(e instanceof Error?e.message:'No se pudo guardar.');}finally{setSaving(false);}
  }
  async function fillRow(row:SummaryRow,sourceMonth:number,targets:number[]) {
    if(saving || locked || edit || !enabled || !data.canEdit)return;
    const source=row.cells?.[`${year}:${currency}:${sourceMonth}`];
    if(!source?.input)return;
    const cells={...row.cells};
    for(const month of targets)cells[`${year}:${currency}:${month}`]={...source,input:source.input.startsWith('=')?shiftPLFormula(source.input,month-sourceMonth):source.input};
    const updated={...row,cells};
    const proposed=rows.map(r=>r.id===row.id?updated:r);
    validateSummary(proposed,data);
    const results=calculateSummary(data,proposed,year,currency).get(row.id);
    const invalid=targets.map(m=>results?.[m-1]).find(r=>r?.error);
    if(invalid?.error)throw new Error(invalid.error);
    setSaving(true);setError('');
    try {
      const response=await fetch('/api/estado-resultados/resumen',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'save',row:updated,previous:row.updated_at,year,currency})});
      const body=await response.json();if(!response.ok)throw new Error(body.error || 'No se pudo rellenar.');
      setRows(body.rows);
    }finally{setSaving(false);}
  }
  async function remove() {
    if(!edit?.row.updated_at || saving || locked)return;
    setSaving(true);setError('');
    try {
      const response=await fetch('/api/estado-resultados/resumen',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'delete',row:{id:edit.row.id},previous:edit.row.updated_at})});
      const body=await response.json();if(!response.ok)throw new Error(body.error || 'No se pudo eliminar.');
      setRows(body.rows);setEdit(null);setConfirmDelete(false);
    }catch(e){setError(e instanceof Error?e.message:'No se pudo eliminar.');}finally{setSaving(false);}
  }
  const input=(label:string)=><input ref={inputRef} autoFocus aria-label={label} className="w-full min-w-0 rounded border border-blue-500 bg-card px-2 py-2 text-xs text-foreground outline-none ring-1 ring-blue-500" value={draft} disabled={saving} maxLength={edit?.month===0?200:500} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{e.stopPropagation();if(e.key==='Enter'){e.preventDefault();void save();}if(e.key==='Escape'&&!saving){e.preventDefault();setEdit(null);setError('');}}}/>;
  const visibleRows=edit && !rows.some(r=>r.id===edit.row.id)?[...rows,edit.row]:rows;
  let preview='';
  let previewError='';
  if(edit && edit.month>0 && draft.trim()) {
    try {
      const value=draft.trim();
      const percent=!value.startsWith('=') && /^-?\d+(?:[.,]\d+)?%$/.test(value);
      const amount=value.startsWith('=')?evaluateSummaryInput(compileFormula(value,accounts),data):percent?evaluateFormula(`=${value}`):normalizeAmount(value);
      preview=formatSummary({amount},percent?'percent':'amount');
    }catch(e){previewError=e instanceof Error?e.message:'Revisa la fórmula.';}
  }
  return <>
    {cellLinks.overlay}
    {edit && toolbarHost && createPortal(<div className="flex flex-wrap items-center gap-3 border-b bg-blue-50 px-5 py-2 text-xs dark:bg-blue-950/40" aria-label="Edición del resumen" aria-live="polite">
      <span>{edit.row.name || 'Nueva fila'} · {edit.month>0?['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEPT','OCT','NOV','DIC'][edit.month-1]:'Título'}</span>
      <code className="break-all text-blue-900 dark:text-blue-200">{draft}</code>
      {preview && <span>Resultado: {preview}</span>}
      {(error || previewError) && <span className="text-rose-600 dark:text-rose-300">{error || previewError}</span>}
      <button className={button} disabled={saving || locked} onClick={()=>void save()}>{saving?'Guardando…':'Guardar'}</button>
      <button className={button} disabled={saving} onClick={()=>{setEdit(null);setError('');setConfirmDelete(false);}}>Cancelar</button>
    </div>,toolbarHost)}
    {edit && edit.month>0 && <FormulaDetailsCard anchor={inputRef} draft={draft} rows={accounts} data={data} currency={currency} error={error} onNavigate={onNavigateReference}/>}
    <tr className="bg-muted/40"><th colSpan={14} className="border-b px-4 py-3 text-left"><div className="flex flex-wrap items-center justify-between gap-2"><span className="text-sm font-semibold">Resumen de resultados</span><div className="flex gap-2"><button className={button} disabled={loading || saving || Boolean(edit)} onClick={()=>setRevision(r=>r+1)} aria-label="Actualizar resumen"><RefreshCw className="h-4 w-4"/></button>{data.canEdit && <button className={button} disabled={!enabled || loading || saving || locked || Boolean(edit)} onClick={add}><Plus className="mr-1 inline h-4 w-4"/>Agregar fila</button>}</div></div></th></tr>
    {loading && <tr><td colSpan={14} className="p-3 text-xs" role="status">Cargando resumen…</td></tr>}
    {!loading && !enabled && !error && <tr><td colSpan={14} className="p-3 text-xs text-muted-foreground">Para habilitar la carga mensual, ejecuta las migraciones de resumen y pl_summary_cells en Supabase y pulsa actualizar.</td></tr>}
    {error && <tr><td colSpan={14} role="alert" className="p-3 text-xs text-rose-600">{error}</td></tr>}
    {visibleRows.map(row=><tr key={row.id} className="hover:bg-muted/50">
      <th className="sticky left-0 z-10 min-w-[240px] border-b bg-card px-4 py-3 text-left text-xs font-semibold sm:min-w-[360px]">{edit?.row.id===row.id && edit.month===0?input('Título de la fila'):<button className="w-full text-left disabled:cursor-default" disabled={!data.canEdit || !enabled || locked || saving || Boolean(edit)} onClick={()=>start(row,0)}>{row.name}</button>}</th>
      {Array.from({length:12},(_,i)=>i+1).map(month=>{
        const cell=row.cells?.[`${year}:${data.conversion?'BOB':currency}:${month}`];const result=calculated.get(row.id)?.[month-1] ?? {amount:null};
        return <td key={month} onContextMenu={event=>{if(row.updated_at)cellLinks.context(event,row.id,month,row.name);}} data-fill-row={`summary-${row.id}`} data-fill-month={month} className="group/fill relative border-b border-l px-2 py-2 text-right text-xs tabular-nums">{edit?.row.id===row.id && edit.month===month?input(`${row.name}, mes ${month}`):<button className="min-h-8 w-full text-right disabled:cursor-default" title={result.error || (row.cells==null?'Fórmula compartida anterior':cell?.input.startsWith('=')?displayFormula(cell.input,accounts):'Haz clic para editar')} disabled={!data.canEdit || !enabled || locked || saving || Boolean(edit)} onClick={()=>start(row,month)}>{formatSummary(result,cell?.format ?? row.format) || <span className="text-slate-500" aria-label="Sin datos">—</span>}</button>}{cellLinks.indicator(row.id,month,row.name)}{cell?.input && data.canEdit && <PLFillHandle rowId={`summary-${row.id}`} month={month} disabled={saving || locked || Boolean(edit) || !enabled} occupied={m=>row.monthly_only===false || Boolean(row.cells?.[`${year}:${currency}:${m}`]?.input)} onFill={targets=>fillRow(row,month,targets)}/>}</td>;
      })}
      <td className="border-b border-l bg-muted/30 px-3 text-right text-xs font-semibold tabular-nums" title="Los porcentajes mensuales no se suman en el total anual">{formatSummary(calculated.get(row.id)?.[12] ?? {amount:null},row.format) || <span className="text-slate-500" aria-label="Sin datos">—</span>}</td>
    </tr>)}
    {edit && <tr><td colSpan={14} className="border-b bg-muted/30 p-2"><div className="flex items-center gap-2"><span className="mr-auto text-xs text-muted-foreground">Enter guarda · Escape cancela. {edit.month===0?'Escribe el título de la fila.':'Número sin separadores de miles, porcentaje o fórmula que empiece con =.'}</span>{edit.month===0 && edit.row.updated_at && <button className="px-2 text-xs text-rose-600" disabled={saving} onClick={()=>setConfirmDelete(true)}>Eliminar fila</button>}<button className={button} disabled={saving} onClick={()=>void save()}>{saving?'Guardando…':'Guardar'}</button><button className={button} disabled={saving} onClick={()=>{setEdit(null);setError('');}}>Cancelar</button></div></td></tr>}
    {edit && confirmDelete && <tr><td colSpan={14} className="bg-rose-500/5 p-3"><div role="alert" className="flex flex-wrap items-center gap-3 text-sm"><span>¿Eliminar «{edit.row.name}» y sus valores de todos los años y monedas? No se puede deshacer.</span><button className={button} disabled={saving} onClick={()=>setConfirmDelete(false)}>Conservar</button><button className={button} disabled={saving} onClick={()=>void remove()}>Eliminar fila</button></div></td></tr>}
  </>;
}
