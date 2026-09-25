"use client";

import { useEffect, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { displayAmount, type PLAccount, type PLData } from '@/lib/pl-model';

interface Props {
  anchor: RefObject<HTMLInputElement>;
  draft: string;
  rows: PLAccount[];
  data: PLData;
  currency: string;
  error: string;
  onNavigate: (account: PLAccount, month: number) => void;
}

export function FormulaDetailsCard({ anchor, draft, rows, data, currency, error, onNavigate }: Props) {
  const [position, setPosition] = useState<{left:number;top:number;width:number;height:number} | null>(null);
  useEffect(() => {
    const update = () => {
      const input = anchor.current;
      if (!input) { setPosition(null); return; }
      const box = input.getBoundingClientRect();
      const viewport = input.closest('[role="region"]')?.getBoundingClientRect();
      const visibleTop = Math.max(0, viewport?.top ?? 0);
      const visibleBottom = Math.min(window.innerHeight, viewport?.bottom ?? window.innerHeight);
      if (box.bottom <= visibleTop || box.top >= visibleBottom || box.right <= 0 || box.left >= window.innerWidth) { setPosition(null); return; }
      const width = Math.min(310, window.innerWidth - 24);
      const below = window.innerHeight - box.bottom - 20;
      const above = box.top - 20;
      const height = Math.min(220, Math.max(below, above));
      const top = below >= Math.min(220, above) ? box.bottom + 8 : Math.max(12, box.top - height - 8);
      setPosition({left:Math.max(12, Math.min(box.left, window.innerWidth - width - 12)),top,width,height});
    };
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => { window.removeEventListener('scroll', update, true); window.removeEventListener('resize', update); };
  }, [anchor, draft]);

  if (!position) return null;
  const addresses = draft.trim().startsWith('=') ? [...new Set((draft.match(/\b[A-Za-z]+[1-9]\d*\b/g) || []).map(r=>r.toUpperCase()))] : [];
  if (addresses.length === 0) return null;
  const details = addresses.map(address => {
    const match = /^([B-M])([1-9]\d*)$/.exec(address);
    const account = match ? rows[Number(match[2])-1] : undefined;
    const month = match ? match[1].charCodeAt(0)-65 : 0;
    const value = account ? data.values.find(v=>v.account_id===account.id && v.month===month) : undefined;
    return {address,account,month,value};
  });
  return createPortal(<aside aria-label="Detalle de la celda en edición" className="formula-glass-card fixed z-40 overflow-auto rounded-2xl border p-3 text-xs shadow-xl backdrop-blur-xl" style={{left:position.left,top:position.top,width:position.width,maxHeight:position.height}} onMouseDown={e=>e.preventDefault()}>
    <h3 className="mb-2 border-b border-slate-400/25 px-1 pb-2 text-xs font-semibold">Detalle</h3>
    <ul className="space-y-1">{details.map(({address,account,month,value})=><li key={address}>
      <button type="button" disabled={!account} onClick={() => { if (account) onNavigate(account, month); }} title="Ir al importe de esta cuenta" className="group flex w-full items-center justify-between gap-2 rounded-lg px-1.5 py-1.5 text-left transition-colors hover:bg-blue-500/10 focus-visible:bg-blue-500/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400" aria-label={`${account?.name || 'Referencia no válida'}, ${address}: ${value?.formulaError ? 'Error de fórmula' : displayAmount(value?.amount ?? '0')} ${currency}`}>
        <span className="min-w-0 flex-1 break-words font-medium">{account?.name || 'Referencia no válida'}</span>
        <span className="shrink-0 text-right text-xs tabular-nums opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 [@media(hover:none)]:opacity-100">{!account ? '#REF!' : value?.formulaError ? '#ERROR' : displayAmount(value?.amount ?? '0')}<span className="block text-[10px] opacity-60">{!value && account ? 'Vacía · equivale a 0' : currency}</span></span>
      </button>
    </li>)}</ul>
    {error && <p role="status" className="mt-2 text-xs text-rose-500">{error}</p>}
  </aside>, document.body);
}
