"use client";
import { useEffect, useState, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { Link2, ExternalLink } from 'lucide-react';
import { normalizeInvoiceURL, type PLCellLink } from '@/lib/pl-cell-links';

const months=['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEPT','OCT','NOV','DIC'];
const button='rounded-lg border px-3 py-2 text-sm disabled:opacity-50';
export function usePLCellLinks(year:number,currency:string,kind:'account'|'summary',canEdit:boolean,locked:boolean) {
  const [links,setLinks]=useState<PLCellLink[]>([]);
  const [enabled,setEnabled]=useState(false);
  const [loading,setLoading]=useState(true);
  const [revision,setRevision]=useState(0);
  const [loadError,setLoadError]=useState('');
  const [error,setError]=useState('');
  const [saving,setSaving]=useState(false);
  const [selection,setSelection]=useState<{id:string;month:number;name:string;x:number;y:number;link?:PLCellLink}|null>(null);
  const [editing,setEditing]=useState(false);
  const [url,setURL]=useState('');
  useEffect(()=>{
    const controller=new AbortController();setLoading(true);setLinks([]);setSelection(null);setEditing(false);setLoadError('');setEnabled(false);
    fetch(`/api/estado-resultados/enlaces?year=${year}&currency=${currency}&kind=${kind}`,{signal:controller.signal,cache:'no-store'}).then(async response=>{
      const body=await response.json();if(!response.ok)throw new Error(body.error || 'No se pudieron cargar los enlaces.');
      if(!controller.signal.aborted){setLinks(body.links);setEnabled(body.enabled);}
    }).catch(e=>{if(!controller.signal.aborted)setLoadError(e.message);}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return()=>controller.abort();
  },[year,currency,kind,revision]);
  const find=(id:string,month:number)=>links.find(l=>(kind==='account'?l.account_id:l.summary_id)===id && l.month===month);
  function context(event:MouseEvent<HTMLElement>,id:string,month:number,name:string) {
    if(locked || saving)return;
    event.preventDefault();event.stopPropagation();const rect=event.currentTarget.getBoundingClientRect();
    setSelection({id,month,name,link:find(id,month),x:Math.max(8,Math.min(event.clientX || rect.left,window.innerWidth-280)),y:Math.max(8,Math.min(event.clientY || rect.bottom,window.innerHeight-290))});setEditing(false);setError('');
  }
  async function save(remove=false) {
    if(!selection || saving || !canEdit || !enabled)return;
    let value:string|null;try{value=remove?null:normalizeInvoiceURL(url);}catch(e){setError((e as Error).message);return;}
    setSaving(true);setError('');
    try {
      const response=await fetch('/api/estado-resultados/enlaces',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind,sourceId:selection.id,month:selection.month,year,currency,url:value,previous:selection.link?.updated_at ?? null})});
      const body=await response.json();if(!response.ok)throw new Error(body.error || 'No se pudo guardar.');
      setLinks(old=>[...old.filter(l=>!((kind==='account'?l.account_id:l.summary_id)===selection.id && l.month===selection.month)),...(body.link?[body.link]:[])]);setSelection(null);setEditing(false);
    }catch(e){setError((e as Error).message);}finally{setSaving(false);}
  }
  function safeURL(value?:string) {try{return normalizeInvoiceURL(value);}catch{return undefined;}}
  function indicator(id:string,month:number,name:string) {
    const link=find(id,month);const href=safeURL(link?.url);if(!href)return null;
    return <a href={href} target="_blank" rel="noopener noreferrer" aria-label={`Abrir factura de ${name}, ${months[month-1]} ${year}`} title="Abrir factura en una pestaña nueva" className="absolute left-0.5 top-0.5 z-10 rounded bg-card/90 p-0.5 text-blue-600 hover:bg-blue-100 focus-visible:outline focus-visible:outline-2" onMouseDown={e=>e.stopPropagation()} onClick={e=>e.stopPropagation()}><Link2 className="h-3 w-3"/></a>;
  }
  const close=()=>{if(!saving){setSelection(null);setEditing(false);setError('');}};
  const overlay=selection?createPortal(<div className={`fixed inset-0 z-[80] ${editing?'flex items-center justify-center bg-black/40 p-4':''}`} onMouseDown={e=>{if(e.target===e.currentTarget)close();}} onKeyDown={e=>{
    e.stopPropagation();if(e.key==='Escape'){e.preventDefault();close();}
    if(e.key==='Tab'){const nodes=e.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),a[href]');const first=nodes[0],last=nodes[nodes.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}
  }}>
    {editing?<form role="dialog" aria-modal="true" aria-label="Enlace de la factura" className="w-full max-w-lg space-y-4 rounded-xl border bg-card p-5 text-foreground shadow-xl" onSubmit={e=>{e.preventDefault();void save();}}>
      <h3 className="font-semibold">{selection.link?'Editar enlace':'Insertar enlace'}</h3><p className="text-sm text-muted-foreground">{selection.name} · {months[selection.month-1]} {year} · {currency}</p>
      <label className="block text-sm">Enlace de la factura<input autoFocus type="url" required maxLength={2048} placeholder="https://drive.google.com/file/d/…/view" value={url} disabled={saving} onChange={e=>setURL(e.target.value)} className="mt-2 w-full rounded-lg border bg-background px-3 py-2"/></label>
      <p className="text-xs text-muted-foreground">El archivo permanece en Drive. Solo se guarda el enlace. Quien lo abra necesita permiso para ver el archivo.</p>
      {error&&<p role="alert" className="text-sm text-rose-600">{error}</p>}
      <div className="flex justify-end gap-2"><button type="button" className={button} disabled={saving} onClick={close}>Cancelar</button><button className={`${button} bg-blue-600 text-white`} disabled={saving}>{saving?'Guardando…':'Guardar enlace'}</button></div>
    </form>:<div role="dialog" aria-label="Opciones de la factura" className="absolute w-[270px] space-y-1 rounded-xl border bg-card p-2 text-sm text-foreground shadow-xl" style={{left:selection.x,top:selection.y}}>
      <p className="border-b px-2 py-2 text-xs text-muted-foreground">{selection.name} · {months[selection.month-1]}</p>
      {selection.link&&safeURL(selection.link.url)&&<a className="flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-muted" href={safeURL(selection.link.url)} target="_blank" rel="noopener noreferrer" onClick={close}><ExternalLink className="h-4 w-4"/>Abrir factura</a>}
      {canEdit&&<button autoFocus className="w-full rounded-lg px-3 py-2 text-left hover:bg-muted disabled:opacity-50" disabled={!enabled||loading||saving||Boolean(loadError)} onClick={()=>{setURL(selection.link?.url??'');setEditing(true);}}> {selection.link?'Editar enlace':'Insertar enlace'}</button>}
      {canEdit&&selection.link&&<button className="w-full rounded-lg px-3 py-2 text-left text-rose-600 hover:bg-muted" disabled={saving} onClick={()=>void save(true)}>Quitar enlace</button>}
      {loading?<p className="p-2 text-xs">Cargando enlaces…</p>:loadError?<p className="p-2 text-xs text-rose-600">{loadError}</p>:!enabled?<p className="p-2 text-xs">Ejecuta 20261029_pl_cell_links.sql en Supabase para habilitar esta opción.</p>:!selection.link&&!canEdit?<p className="p-2 text-xs">Esta celda no tiene enlace.</p>:null}
      {error&&<p role="alert" className="p-2 text-xs text-rose-600">{error}</p>}
      <div className="flex justify-end gap-1 border-t pt-1"><button className="rounded px-2 py-1 text-xs hover:bg-muted" disabled={saving} onClick={()=>setRevision(v=>v+1)}>Actualizar enlaces</button><button autoFocus={!canEdit} className="rounded px-2 py-1 text-xs hover:bg-muted" disabled={saving} onClick={close}>Cerrar</button></div>
    </div>}
  </div>,document.body):null;
  return {context,indicator,overlay};
}
