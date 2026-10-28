"use client";
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { fillMonths } from '@/lib/pl-fill';

interface Props {rowId:string;month:number;occupied:(month:number)=>boolean;onFill:(months:number[])=>Promise<void>;disabled?:boolean}
export function PLFillHandle({rowId,month,occupied,onFill,disabled}:Props) {
  const [target,setTarget]=useState<number|null>(null);
  const [pending,setPending]=useState<number[]|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const cleanup=useRef<()=>void>(()=>{});
  useEffect(()=>()=>cleanup.current(),[]);
  async function apply(months:number[]) {
    if(!months.length)return;
    setBusy(true);setError('');
    try {await onFill(months);setPending(null);}catch(e){setError(e instanceof Error?e.message:'No se pudo rellenar.');}finally{setBusy(false);}
  }
  function start(event:React.PointerEvent<HTMLButtonElement>) {
    if(disabled||busy)return;
    event.preventDefault();event.stopPropagation();setError('');
    let last=month;setTarget(month);
    const region=event.currentTarget.closest<HTMLElement>('[role="region"]');
    let pointerX=event.clientX,pointerY=event.clientY,frame=0;
    const cells=Array.from(document.querySelectorAll<HTMLElement>('[data-fill-row]')).filter(c=>c.dataset.fillRow===rowId);
    const mark=()=>cells.forEach(c=>{const m=Number(c.dataset.fillMonth);c.toggleAttribute('data-fill-preview',m>=Math.min(month,last)&&m<=Math.max(month,last));});
    mark();
    const locate=()=>{
      const cell=document.elementFromPoint(pointerX,pointerY)?.closest<HTMLElement>('[data-fill-row]');
      if(cell?.dataset.fillRow===rowId){last=Number(cell.dataset.fillMonth);setTarget(last);mark();}
    };
    const move=(e:PointerEvent)=>{pointerX=e.clientX;pointerY=e.clientY;locate();};
    const scroll=()=>{
      if(region){const box=region.getBoundingClientRect();if(pointerY>=box.top && pointerY<=box.bottom){const delta=pointerX>box.right-40?12:pointerX<box.left+40?-12:0;if(delta){region.scrollLeft+=delta;locate();}}}
      frame=requestAnimationFrame(scroll);
    };
    frame=requestAnimationFrame(scroll);
    const clear=()=>{cancelAnimationFrame(frame);cells.forEach(c=>c.removeAttribute('data-fill-preview'));window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);window.removeEventListener('pointercancel',cancel);window.removeEventListener('keydown',key);window.removeEventListener('blur',cancel);setTarget(null);};
    const cancel=()=>clear();
    const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();clear();}};
    const up=()=>{clear();const months=fillMonths(month,last);if(!months.length)return;if(months.some(occupied))setPending(months);else void apply(months);};
    cleanup.current=clear;
    window.addEventListener('pointermove',move);window.addEventListener('pointerup',up);window.addEventListener('pointercancel',cancel);window.addEventListener('keydown',key);window.addEventListener('blur',cancel);
  }
  return <>
    <button type="button" aria-label={`Arrastrar para rellenar desde el mes ${month}`} title="Arrastra para copiar a otros meses" disabled={disabled||busy} onPointerDown={start} onClick={e=>e.stopPropagation()} className="absolute bottom-0 right-0 z-20 h-2.5 w-2.5 touch-none cursor-crosshair border border-white bg-blue-600 opacity-0 group-hover/fill:opacity-100 focus:opacity-100 disabled:hidden"/>
    {target!==null && <span className="sr-only" role="status">Rellenar del mes {month} al {target}</span>}
    {(pending || error || busy) && createPortal(<div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4"><div role="alertdialog" aria-modal="true" aria-label="Rellenar meses" className="w-full max-w-md space-y-4 rounded-xl border bg-card p-5 shadow-xl" onKeyDown={e=>{if(e.key==='Tab'){const buttons=e.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)');const first=buttons[0],last=buttons[buttons.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}if(e.key==='Escape'&&!busy){setPending(null);setError('');}}}>
      <h3 className="font-semibold">{busy?'Guardando meses…':error?'No se completó el relleno':'¿Reemplazar las celdas con datos?'}</h3>
      {error?<p role="alert" className="text-sm text-rose-600">{error}</p>:pending && <p className="text-sm">Se rellenarán {pending.length} meses de esta fila. Los valores o fórmulas existentes se reemplazarán.</p>}
      <div className="flex justify-end gap-2"><button autoFocus disabled={busy} className="rounded-lg border px-3 py-2 text-sm" onClick={()=>{setPending(null);setError('');}}>Cancelar</button>{pending&&!error&&<button disabled={busy} className="rounded-lg bg-blue-600 px-3 py-2 text-sm text-white" onClick={()=>void apply(pending)}>Reemplazar</button>}</div>
    </div></div>,document.body)}
  </>;
}
