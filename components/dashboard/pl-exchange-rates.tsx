"use client";
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus, X } from 'lucide-react';
import { normalizeExchangeRate, type PLExchangeRate } from '@/lib/pl-exchange';
const months=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
export function PLExchangeRates({year,disabled,onSaved}:{year:number;disabled:boolean;onSaved:()=>void}){
  const [open,setOpen]=useState(false),[loading,setLoading]=useState(false),[saving,setSaving]=useState(false),[enabled,setEnabled]=useState(false),[canEdit,setCanEdit]=useState(false);
  const [rates,setRates]=useState<PLExchangeRate[]>([]),[draft,setDraft]=useState<string[]>(Array(12).fill('')),[error,setError]=useState('');
  const trigger=useRef<HTMLButtonElement>(null);
  const close=()=>{if(!saving){setOpen(false);trigger.current?.focus();}};
  useEffect(()=>{
    if(!open)return;const controller=new AbortController();setLoading(true);setError('');setEnabled(false);
    fetch(`/api/estado-resultados/tipo-cambio?year=${year}`,{signal:controller.signal,cache:'no-store'}).then(async response=>{const body=await response.json();if(!response.ok)throw new Error(body.error || 'No se pudo cargar.');if(!controller.signal.aborted){setRates(body.rates);setDraft(months.map((_,i)=>body.rates.find((r:PLExchangeRate)=>r.month===i+1)?.rate??''));setCanEdit(body.canEdit);setEnabled(body.enabled);}}).catch(e=>{if(!controller.signal.aborted)setError(e.message);}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return()=>controller.abort();
  },[open,year]);
  async function save(){
    if(!enabled||!canEdit||saving||loading)return;
    const changes=[];try{for(let i=0;i<12;i++){const old=rates.find(r=>r.month===i+1);const rate=draft[i].trim()?normalizeExchangeRate(draft[i]):null;if(rate!==(old?normalizeExchangeRate(old.rate):null))changes.push({month:i+1,rate,previous:old?.updated_at??null});}}catch(e){setError((e as Error).message);return;}
    if(!changes.length){close();return;}
    setSaving(true);setError('');
    try{const response=await fetch('/api/estado-resultados/tipo-cambio',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({year,changes})});const body=await response.json();if(!response.ok)throw new Error(body.error||'No se pudo guardar.');setOpen(false);trigger.current?.focus();onSaved();}catch(e){setError((e as Error).message);}finally{setSaving(false);}
  }
  return <><button ref={trigger} type="button" title="Agregar tipo de cambio" aria-label="Agregar tipo de cambio" disabled={disabled} onClick={()=>setOpen(true)} className="rounded-lg border bg-card p-2 text-blue-600 hover:bg-blue-500/10 disabled:opacity-50"><Plus className="h-4 w-4"/></button>
    {open&&createPortal(<div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm" onMouseDown={e=>{if(e.target===e.currentTarget)close();}}><form role="dialog" aria-modal="true" aria-labelledby="exchange-title" className="max-h-[90vh] w-full max-w-xl space-y-5 overflow-auto rounded-2xl border bg-card p-6 text-foreground shadow-2xl" onSubmit={e=>{e.preventDefault();void save();}} onKeyDown={e=>{e.stopPropagation();if(e.key==='Escape'){e.preventDefault();close();}if(e.key==='Tab'){const nodes=e.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled)');const first=nodes[0],last=nodes[nodes.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}}}>
      <div className="flex items-start justify-between gap-3"><div><h2 id="exchange-title" className="text-lg font-semibold">Tipo de cambio mensual · {year}</h2><p className="mt-1 text-sm text-muted-foreground">Bolivianos por 1 dólar estadounidense</p></div><button autoFocus type="button" aria-label="Cerrar" disabled={saving} onClick={close} className="rounded-lg p-1 hover:bg-muted"><X className="h-5 w-5"/></button></div>
      {loading?<p role="status">Cargando cotizaciones…</p>:<>
        {!enabled&&<p className="rounded-lg bg-amber-500/10 p-3 text-sm">Ejecuta 20261029_pl_exchange_rates.sql en Supabase para habilitar el guardado.</p>}
        <fieldset disabled={saving||!canEdit||!enabled} className="grid grid-cols-2 gap-3 sm:grid-cols-3">{months.map((month,i)=><label key={month} className="text-xs text-muted-foreground">{month}<div className="mt-1 flex items-center rounded-lg border bg-background px-3 focus-within:border-blue-500"><input inputMode="decimal" aria-label={`Tipo de cambio de ${month}`} placeholder="Sin cotización" maxLength={21} value={draft[i]} onChange={e=>setDraft(old=>old.map((v,j)=>i===j?e.target.value:v))} className="w-full min-w-0 bg-transparent py-2.5 text-sm text-foreground outline-none"/><span className="ml-1 text-[10px]">BOB</span></div></label>)}</fieldset>
        <p className="text-xs leading-relaxed text-muted-foreground">USD = importe en BOB ÷ tipo de cambio del mes. Los importes originales se conservan. Un mes sin cotización queda pendiente de conversión. Vaciar una cotización la elimina al guardar.</p>
      </>}
      {error&&<p role="alert" className="text-sm text-rose-600">{error}</p>}
      <div className="flex justify-end gap-2"><button type="button" disabled={saving} onClick={close} className="rounded-lg border px-4 py-2 text-sm">Cancelar</button>{canEdit&&<button type="submit" disabled={saving||loading||!enabled} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{saving?'Guardando…':'Guardar tipos de cambio'}</button>}</div>
    </form></div>,document.body)}
  </>;
}
