"use client";

import { Fragment, useEffect, useRef, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronRight, FileSpreadsheet, FolderPlus, GripVertical, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { displayAmount, sumAmounts, type PLAccount, type PLData, type PLGroup, type PLSection } from '@/lib/pl-model';
import { parseCellInput } from '@/lib/pl-formula';
import { cellAddress, compileFormula, displayFormula, previewCell, recalculateValues, referenceRows } from '@/lib/pl-references';
import { cn } from '@/lib/utils';

const months = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEPT', 'OCT', 'NOV', 'DIC'];
const tones: Record<string, string> = { SOCIOS: 'bg-blue-50 text-blue-900', INGRESOS: 'bg-emerald-50 text-emerald-900', EGRESOS: 'bg-rose-50 text-rose-900', INVERSION: 'bg-amber-50 text-amber-900' };
const button = 'rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50';
const firstCell = 'sticky left-0 z-10 min-w-[240px] max-w-[240px] border-b border-slate-200 px-4 py-3 text-left text-xs sm:min-w-[360px] sm:max-w-[360px]';

function renderAmount(value: string | null) {
  if (value !== null && /^-?0+(\.0+)?$/.test(value)) {
    return <span className="text-slate-300" aria-label="0">—</span>;
  }
  return displayAmount(value);
}

export function IncomeStatementView() {
  const [year, setYear] = useState(2026);
  const [currency, setCurrency] = useState('USD');
  const [data, setData] = useState<PLData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [revision, setRevision] = useState(0);
  const [collapsed, setCollapsed] = useState(new Set<string>());
  const [editing, setEditing] = useState<{ account: PLAccount; month: number; previous: string | null } | null>(null);
  const [draft, setDraft] = useState('');
  const cellInput = useRef<HTMLInputElement>(null);
  const caret = useRef({ start: 0, end: 0 });
  const [pickedCell, setPickedCell] = useState('');
  function pickReference(address: string) {
    const { start, end } = caret.current;
    const next = draft.slice(0, start) + address + draft.slice(end);
    const position = start + address.length;
    setDraft(next); setPickedCell(address); setFormError('');
    caret.current = { start: position, end: position };
    requestAnimationFrame(() => {
      cellInput.current?.focus({ preventScroll: true });
      cellInput.current?.setSelectionRange(position, position);
    });
  }

  const [newGroup, setNewGroup] = useState<PLGroup | null>(null);
  const [newSubgroup, setNewSubgroup] = useState<PLGroup | null>(null);
  const [newSection, setNewSection] = useState<PLSection | null>(null);
  const [renaming, setRenaming] = useState<{ kind: 'accounts' | 'groups' | 'sections'; id: string; name: string } | null>(null);
  const [dragging, setDragging] = useState<{kind: 'accounts' | 'groups'; id: string} | null>(null);
  const [drop, setDrop] = useState<{id:string;position:'before'|'after'} | null>(null);
  const [moving, setMoving] = useState(false);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [removalConfirmation, setRemovalConfirmation] = useState<{ id: string; name: string; hasValues: boolean } | null>(null);
  const [groupRemovalConfirmation, setGroupRemovalConfirmation] = useState<{ id: string; name: string; accountCount: number; hasValues: boolean; hasChildren: boolean; canDelete: boolean } | null>(null);
  const numberedRows = data ? referenceRows(data) : [];

  function parseDraft() {
    if (!editing || !data || !draft.trim().startsWith('=')) return parseCellInput(draft);
    const formula = compileFormula(draft, numberedRows);
    const calculated = previewCell(data, editing.account.id, editing.month, formula);
    if (calculated.formulaError) throw new Error(calculated.formulaError);
    return { amount: calculated.amount, formula };
  }

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(''); setData(null);
    fetch(`/api/estado-resultados?year=${year}&currency=${currency}`, { signal: controller.signal, cache: 'no-store' })
      .then(async response => { const body = await response.json(); if (!response.ok) throw new Error(body.error || 'No se pudo cargar el P&L.'); return body as PLData; })
      .then(body => { if (!controller.signal.aborted) setData(body); })
      .catch(e => { if (!controller.signal.aborted) setError(e.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [year, currency, revision]);

  useEffect(() => {
    if (!editing && !newGroup && !newSubgroup && !newSection && !renaming) return;
    const guard = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, [editing, newGroup, newSubgroup, newSection, renaming]);

  async function save() {
    setFormError('');
    let payload;
    try {
      payload = renaming ? { action: 'rename', kind: renaming.kind, id: renaming.id, previousName: renaming.name, name } : newSubgroup ? { action: 'group', sectionId: newSubgroup.section_id, parentId: newSubgroup.id, name } : newSection ? { action: 'group', sectionId: newSection.id, name } : editing ? { action: 'value', accountId: editing.account.id, month: editing.month, year, currency, previous: editing.previous, ...parseDraft() } : { action: 'account', groupId: newGroup?.id, name };
      if (editing && draft.trim().startsWith('=') && !data?.formulasEnabled) throw new Error('Las fórmulas todavía no están habilitadas en la base de datos.');
    } catch (e) { setFormError((e as Error).message); return; }
    setSaving(true);
    try {
      const response = await fetch('/api/estado-resultados', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'No se pudo guardar.');
      setData(previous => {
        if (!previous) return previous;
        if (renaming) return { ...previous, [renaming.kind]: previous[renaming.kind].map(record => record.id === renaming.id ? { ...record, name: body.record.name } : record) };
        if (editing) {
          const changed = { ...previous, values: [...previous.values.filter(v => !(v.account_id === editing.account.id && v.month === editing.month)), ...(body.value ? [body.value] : [])] };
          return { ...changed, values: recalculateValues(changed) };
        }
        if (newSubgroup || newSection) return { ...previous, groups: [...previous.groups, body.group].sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id)) };
        return { ...previous, accounts: [...previous.accounts, body.account].sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id)) };
      });
      if (newGroup) setCollapsed(previous => { const next = new Set(previous); next.delete(newGroup.id); return next; });
      setEditing(null); setNewGroup(null); setNewSubgroup(null); setNewSection(null); setRenaming(null); setNotice('Cambios guardados en Supabase.');
    } catch (e) { setFormError((e as Error).message); }
    finally { setSaving(false); }
  }

  async function removeAccount(id: string) {
    setSaving(true); setFormError('');
    try {
      async function request(action: string) {
        const response = await fetch('/api/estado-resultados', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, id }) });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'No se pudo completar la operación.');
        return result;
      }
      const check = await request('remove-check');
      setRemovalConfirmation({ id, name: check.name, hasValues: check.hasValues });
    } catch (e) { setFormError((e as Error).message); }
    finally { setSaving(false); }
  }

  async function confirmAccountRemoval() {
    if (!removalConfirmation) return;
    setSaving(true); setFormError('');
    try {
      const response = await fetch('/api/estado-resultados', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: removalConfirmation.hasValues ? 'archive-account' : 'delete-account', id: removalConfirmation.id }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'No se pudo completar la operación.');
      setData(previous => previous ? { ...previous, accounts: result.archived ? previous.accounts.map(a => a.id === removalConfirmation.id ? { ...a, active: false } : a) : previous.accounts.filter(a => a.id !== removalConfirmation.id) } : previous);
      setRemovalConfirmation(null);
      setRenaming(null);
      setNotice(result.archived ? 'Cuenta archivada. Sus importes históricos se conservan.' : 'Fila eliminada.');
    } catch (e) { setFormError((e as Error).message); }
    finally { setSaving(false); }
  }

  async function removeGroup(id: string) {
    setSaving(true); setFormError('');
    try {
      const response = await fetch('/api/estado-resultados', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'remove-group-check', id }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'No se pudo comprobar el grupo.');
      setGroupRemovalConfirmation({ ...result, id });
    } catch (e) { setFormError((e as Error).message); }
    finally { setSaving(false); }
  }

  async function confirmGroupRemoval() {
    if (!groupRemovalConfirmation?.canDelete) return;
    setSaving(true); setFormError('');
    try {
      const response = await fetch('/api/estado-resultados', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'delete-group', id: groupRemovalConfirmation.id }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'No se pudo eliminar el grupo.');
      setData(previous => previous ? { ...previous, groups: previous.groups.filter(group => group.id !== groupRemovalConfirmation.id), accounts: previous.accounts.filter(account => !result.accountIds.includes(account.id)) } : previous);
      setGroupRemovalConfirmation(null);
      setNotice('Grupo eliminado.');
    } catch (e) { setFormError((e as Error).message); }
    finally { setSaving(false); }
  }

  function visibleAccounts(accounts: PLAccount[]) {
    return accounts.filter(a => a.active || data?.values.some(v => v.account_id === a.id));
  }

  function editableName(kind: 'accounts' | 'groups' | 'sections', record: { id: string; name: string }) {
    if (!data?.canEdit) return <span>{record.name}</span>;
    if (renaming?.kind === kind && renaming.id === record.id) {
      return <form className="min-w-0 flex-1 normal-case tracking-normal" onSubmit={event => { event.preventDefault(); if (!saving) void save(); }}>
        <input autoFocus aria-label={`Nombre de ${record.name}`} aria-describedby="pl-name-help" required maxLength={200} disabled={saving} value={name}
          onFocus={event => event.currentTarget.select()} onChange={event => setName(event.target.value)}
          onKeyDown={event => { event.stopPropagation(); if (event.key === 'Escape' && !saving) { event.preventDefault(); setRenaming(null); setFormError(''); } }}
          className="w-full rounded-md border border-blue-300 bg-white px-2 py-1.5 text-xs text-slate-900 outline-none ring-2 ring-blue-100 disabled:opacity-60" />
        <span id="pl-name-help" className="mt-1 block text-[10px] font-normal text-slate-500">{saving ? 'Guardando…' : 'Enter para guardar · Escape para cancelar'}</span>
        {kind === 'accounts' && data.accounts.find(a => a.id === record.id)?.active && <button type="button" disabled={saving} onClick={() => void removeAccount(record.id)} className="mt-2 text-xs font-normal text-rose-600 hover:underline disabled:opacity-50">Eliminar fila</button>}
        {formError && <span role="alert" className="mt-1 block text-xs font-normal text-rose-700">{formError}</span>}
      </form>;
    }
    return <button type="button" disabled={Boolean(renaming) || Boolean(editing) || saving || moving} title="Haz clic para editar el nombre" aria-label={`Editar nombre de ${record.name}`}
      className="min-w-0 flex-1 rounded-md py-1 text-left font-inherit transition-colors hover:bg-blue-100/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400"
      onClick={() => { setRenaming({ kind, id: record.id, name: record.name }); setName(record.name); setFormError(''); }}>{record.name}</button>;
  }

  function sameLevel(kind: 'accounts' | 'groups', id: string, target: string) {
    if (!data) return false;
    if (kind === 'accounts') return data.accounts.find(a => a.id === id)?.group_id === data.accounts.find(a => a.id === target)?.group_id;
    const a = data.groups.find(g => g.id === id), b = data.groups.find(g => g.id === target);
    return Boolean(a && b && a.section_id === b.section_id && a.parent_id === b.parent_id);
  }
  async function moveRow(kind: 'accounts' | 'groups', id: string, targetId: string, position: 'before' | 'after') {
    setDragging(null); setDrop(null);
    if (id === targetId || moving) return;
    setMoving(true); setError(''); setNotice('Guardando orden…');
    try {
      const response = await fetch('/api/estado-resultados', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'reorder',kind,id,targetId,position})});
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'No se pudo guardar el orden.');
      setData(previous => previous ? {...previous, [kind]: previous[kind].map(row => ({...row, sort_order: body.order.find((o: {id:string;sort_order:number}) => o.id === row.id)?.sort_order ?? row.sort_order})).sort((a,b) => a.sort_order-b.sort_order || a.id.localeCompare(b.id))} : previous);
      setNotice('Orden guardado.');
    } catch (e) { setNotice(''); setError((e as Error).message + ' Pulsa Actualizar para consultar el orden guardado.'); }
    finally { setMoving(false); }
  }
  function dragHandle(kind: 'accounts' | 'groups', record: {id:string;name:string}) {
    if (!data?.canEdit) return null;
    return <button type="button" draggable={!modal && !saving} disabled={modal || saving} aria-label={`Mover ${record.name}`} title="Arrastra para mover. También puedes usar las flechas ↑ y ↓."
      className="absolute left-0 top-0 flex h-full w-5 cursor-grab items-center justify-center text-slate-300 opacity-0 transition-opacity hover:bg-blue-100/60 hover:text-blue-600 hover:opacity-100 focus-visible:opacity-100 active:cursor-grabbing active:opacity-100 disabled:cursor-default"
      onDragStart={e => { setDragging({kind,id:record.id}); e.dataTransfer.effectAllowed='move'; e.dataTransfer.setData('text/plain',record.id); }} onDragEnd={() => {setDragging(null);setDrop(null);}}
      onKeyDown={e => { if (!['ArrowUp','ArrowDown'].includes(e.key) || !data) return; e.preventDefault(); const peers=data[kind].filter(r => sameLevel(kind,record.id,r.id)); const index=peers.findIndex(r=>r.id===record.id); const target=peers[index+(e.key==='ArrowUp'?-1:1)]; if(target) void moveRow(kind,record.id,target.id,e.key==='ArrowUp'?'before':'after'); }}><GripVertical className="h-3 w-3" /></button>;
  }
  function dropProps(kind: 'accounts' | 'groups', id: string) {
    return {
      onDragOver: (e: React.DragEvent<HTMLTableRowElement>) => {
        if (!dragging || dragging.kind !== kind || !sameLevel(kind,dragging.id,id) || moving) return;
        e.preventDefault(); e.dataTransfer.dropEffect='move'; const rect=e.currentTarget.getBoundingClientRect(); setDrop({id,position:e.clientY < rect.top+rect.height/2?'before':'after'});
        const scroller=e.currentTarget.closest('[role="region"]'); if(scroller) {const bounds=scroller.getBoundingClientRect(); if(e.clientY>bounds.bottom-45) scroller.scrollTop+=20; else if(e.clientY<bounds.top+65) scroller.scrollTop-=20;}
      },
      onDrop: (e: React.DragEvent<HTMLTableRowElement>) => {e.preventDefault(); if(dragging && drop?.id===id && dragging.kind===kind && sameLevel(kind,dragging.id,id)) void moveRow(kind,dragging.id,id,drop.position);},
    };
  }
  function dropLine(id: string) { return drop?.id === id ? (drop.position === 'before' ? 'inset 0 3px #2563eb' : 'inset 0 -3px #2563eb') : undefined; }

  function groupAccounts(groupId: string, seen = new Set<string>()): PLAccount[] {
    if (!data || seen.has(groupId)) return [];
    seen.add(groupId);
    return [...data.accounts.filter(a => a.group_id === groupId), ...data.groups.filter(g => g.parent_id === groupId).flatMap(g => groupAccounts(g.id, seen))];
  }
  function valuesFor(accounts: PLAccount[], month?: number) {
    const ids = new Set(accounts.map(a => a.id));
    return (data?.values || []).filter(v => ids.has(v.account_id) && (month === undefined || v.month === month)).map(v => v.amount);
  }
  function hasFormulaError(accounts: PLAccount[], month?: number) {
    const ids = new Set(accounts.map(a=>a.id));
    return data?.values.some(value=>ids.has(value.account_id) && (month===undefined || value.month===month) && value.formulaError);
  }
  function cells(accounts: PLAccount[], account?: PLAccount) {
    return <>{months.map((label, i) => {
      const value = data?.values.find(v => v.account_id === account?.id && v.month === i + 1);
      const failed = hasFormulaError(accounts, i + 1);
      const amount = failed ? null : sumAmounts(valuesFor(accounts, i + 1));
      const formula = value?.formula ? displayFormula(value.formula, numberedRows) : undefined;
      const address = account ? cellAddress(numberedRows,account.id,i+1) : '';
      const content = failed ? <span className="text-rose-500" title={value?.formulaError || 'Una cuenta contiene una fórmula con error.'}>#ERROR</span> : renderAmount(amount);
      return <td key={label} className="h-10 min-w-[104px] border-b border-l border-slate-200/60 text-right text-xs tabular-nums">
        {account && editing?.account.id === account.id && editing.month === i + 1 ? <input
          ref={cellInput} autoFocus aria-label={`Editar ${account.name}, ${label}`} disabled={saving}
          className="h-10 w-full min-w-[104px] bg-white px-3 text-right text-sm text-slate-900 outline outline-2 -outline-offset-2 outline-blue-500"
          value={draft} maxLength={500} onFocus={e => { caret.current = {start:e.currentTarget.selectionStart ?? draft.length,end:e.currentTarget.selectionEnd ?? draft.length}; }}
          onSelect={e => { caret.current = {start:e.currentTarget.selectionStart ?? draft.length,end:e.currentTarget.selectionEnd ?? draft.length}; }}
          onChange={e => { setDraft(e.target.value); setFormError(''); setPickedCell(''); caret.current = {start:e.target.selectionStart ?? 0,end:e.target.selectionEnd ?? 0}; }}
          onKeyDown={e => { if (e.nativeEvent.isComposing) return; if (e.key === 'Enter') { e.preventDefault(); if (!saving) void save(); } if (e.key === 'Escape' && !saving) { setEditing(null); setFormError(''); setPickedCell(''); } }}
        /> : account && data?.canEdit && (account.active || editing?.account && draft.trim().startsWith('=')) ? <button type="button"
          disabled={Boolean(renaming) || moving || saving || Boolean(editing && !draft.trim().startsWith('='))}
          className={cn('h-full min-h-10 w-full px-3 py-2 text-right hover:bg-blue-100/60 focus-visible:outline-blue-500', editing && pickedCell === address && 'bg-emerald-50 ring-2 ring-inset ring-emerald-500')}
          title={`${address}${formula ? ' · '+formula : ''}`} aria-label={`${editing ? 'Seleccionar' : 'Editar'} ${address}, ${account.name}, ${label} ${year}, ${currency}`}
          onMouseDown={e => { if (editing) e.preventDefault(); }}
          onClick={() => { if (editing) { pickReference(address); return; } setEditing({ account, month: i + 1, previous: value?.updated_at || null }); const initial = formula ?? value?.amount ?? ''; setDraft(initial); caret.current = {start:initial.length,end:initial.length}; setPickedCell(''); setFormError(''); }}
        >{content}</button> : <span className="px-3" title={formula} aria-label={amount === null && !failed ? 'Sin datos' : undefined}>{content}</span>}
      </td>;
    })}<td className="min-w-[112px] border-b border-l border-slate-200/60 px-3 text-right text-xs font-semibold tabular-nums">{hasFormulaError(accounts) ? <span className="text-rose-500">#ERROR</span> : renderAmount(sumAmounts(valuesFor(accounts)))}</td></>;
  }
  function renderGroup(group: PLGroup, depth = 0, seen = new Set<string>()): React.ReactNode {
    if (!data || seen.has(group.id)) return null;
    const next = new Set(seen); next.add(group.id);
    const accounts = visibleAccounts(data.accounts.filter(a => a.group_id === group.id));
    const children = data.groups.filter(g => g.parent_id === group.id);
    return <Fragment key={group.id}>
      <tr {...dropProps('groups', group.id)} className="bg-slate-50"><th scope="row" className={cn(firstCell, 'bg-slate-50 font-semibold text-slate-700')} style={{ paddingLeft: 24 + depth * 16, boxShadow: dropLine(group.id) }}>{dragHandle('groups', group)}
        <div className="group/account flex items-center gap-2"><button type="button" className="flex shrink-0 items-center rounded p-1 text-left hover:bg-blue-100" disabled={Boolean(renaming) || saving || moving || Boolean(editing && !collapsed.has(group.id))} aria-label={`Expandir o contraer ${group.name}`} aria-expanded={!collapsed.has(group.id)} onClick={() => setCollapsed(previous => { const result = new Set(previous); if (result.has(group.id)) result.delete(group.id); else result.add(group.id); return result; })}>
          {collapsed.has(group.id) ? <ChevronRight className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}</button>{editableName('groups', group)}
          {data.canEdit && <><button type="button" disabled={Boolean(renaming) || Boolean(editing) || saving || moving} aria-label={`Agregar cuenta en ${group.name}`} title="Agregar cuenta" className="rounded p-1 opacity-0 transition-opacity hover:bg-blue-100 focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400 group-hover/account:opacity-100 disabled:opacity-0" onClick={() => { setNewGroup(group); setName(''); setFormError(''); }}><Plus className="h-4 w-4" /></button><button type="button" disabled={Boolean(renaming) || Boolean(editing) || saving || moving} aria-label={`Agregar subcuenta en ${group.name}`} title={`Agregar subcuenta en ${group.name}`} className="rounded p-1 text-blue-600 opacity-0 transition-opacity hover:bg-blue-100 focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400 group-hover/account:opacity-100 disabled:opacity-0" onClick={() => { setNewSubgroup(group); setName(''); setFormError(''); }}><FolderPlus className="h-4 w-4" /></button><button type="button" disabled={Boolean(renaming) || Boolean(editing) || saving || moving} aria-label={`Eliminar grupo ${group.name}`} title={`Eliminar grupo ${group.name}`} className="rounded p-1 text-rose-600 opacity-0 transition-opacity hover:bg-rose-100 focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose-400 group-hover/account:opacity-100 disabled:opacity-0" onClick={() => void removeGroup(group.id)}><Trash2 className="h-4 w-4" /></button></>}
        </div></th>{cells(groupAccounts(group.id))}</tr>
      {!collapsed.has(group.id) && <>{accounts.map(account => <tr key={account.id} {...dropProps('accounts', account.id)} className="hover:bg-blue-50/40"><th scope="row" className={cn(firstCell, 'bg-white font-normal text-slate-600')} style={{ paddingLeft: 40 + depth * 16, boxShadow: dropLine(account.id) }}>{dragHandle('accounts', account)}<span className="group/account-row inline-flex w-full items-center justify-between gap-2">{editableName('accounts', account)}{account.active && data.canEdit && !(renaming?.kind === 'accounts' && renaming.id === account.id) && <button type="button" disabled={saving || moving || Boolean(editing)} aria-label={`Eliminar ${account.name}`} title={`Eliminar ${account.name}`} className="rounded p-1 text-rose-600 opacity-0 transition-opacity hover:bg-rose-100 focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose-400 group-hover/account-row:opacity-100 disabled:opacity-0" onClick={() => void removeAccount(account.id)}><Trash2 className="h-4 w-4" /></button>}</span>{!account.active && <span className="ml-2 text-slate-400">(archivada)</span>}</th>{cells([account], account)}</tr>)}{children.map(child => renderGroup(child, depth + 1, next))}
      {!accounts.length && !children.length && <tr><td colSpan={14} className="border-b bg-white px-10 py-3 text-xs text-slate-400">Todavía no hay cuentas en este grupo.</td></tr>}</>}
    </Fragment>;
  }
  function operatingResult(month: number): string | null {
    if (!data) return null;
    const getSection = (code: string) => {
      const section = data.sections.find(s => s.code === code);
      const ids = new Set(data.groups.filter(g => g.section_id === section?.id).map(g => g.id));
      return visibleAccounts(data.accounts.filter(a => ids.has(a.group_id)));
    };
    const income = getSection('INGRESOS'), expenses = getSection('EGRESOS');
    if (hasFormulaError([...income,...expenses],month)) return null;
    const incoming = valuesFor(income, month), outgoing = valuesFor(expenses, month);
    if (!income.length || !expenses.length || incoming.length !== income.length || outgoing.length !== expenses.length) return null;
    return sumAmounts([...incoming, ...outgoing.map(value => value.startsWith('-') ? value.slice(1) : '-' + value)]);
  }
  const results = months.map((_, i) => operatingResult(i + 1));
  let formulaPreview: string | null = null;
  let formulaError = '';
  if (editing && draft.trim().startsWith('=')) {
    try { formulaPreview = parseDraft().amount; }
    catch (e) { formulaError = (e as Error).message; }
  }
  const modal = Boolean(editing || newGroup || newSubgroup || newSection || renaming || moving || removalConfirmation || groupRemovalConfirmation);
  return <div className="space-y-6 p-4 md:p-6 lg:p-8">
    <header className="flex flex-wrap items-start justify-between gap-4"><div><div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-blue-600"><FileSpreadsheet className="h-4 w-4" />Reportes financieros</div><h1 className="text-2xl font-bold tracking-tight text-slate-900">Estado de Resultados</h1><p className="mt-2 text-sm text-slate-500">Europe Intelligence Solutions · Sucursal Bolivia</p></div><span className="rounded-full border bg-white px-3 py-1.5 text-xs text-slate-600">{loading ? 'Cargando…' : data ? (data.canEdit ? 'Edición habilitada' : 'Solo lectura') : 'Sin conexión'}</span></header>
    <div className="flex flex-wrap items-end justify-between gap-4 rounded-xl border bg-white p-4 shadow-sm"><div className="flex gap-4">
      <label className="text-xs text-slate-500">Ejercicio<select className="mt-2 block rounded-lg border bg-white px-3 py-2 text-sm text-slate-900" value={year} disabled={modal} onChange={e => { setYear(Number(e.target.value)); setNotice(''); }}>{[2025, 2026, 2027].map(y => <option key={y}>{y}</option>)}</select></label>
      <label className="text-xs text-slate-500">Moneda de los importes<select className="mt-2 block rounded-lg border bg-white px-3 py-2 text-sm text-slate-900" value={currency} disabled={modal} onChange={e => { setCurrency(e.target.value); setNotice(''); }}><option value="USD">USD · Dólares</option><option value="BOB">BOB · Bolivianos</option></select></label></div>
      <div className="flex flex-wrap gap-2"><button className={button} disabled={saving || moving || Boolean(renaming)} onClick={() => setCollapsed(new Set())}>Expandir todo</button><button className={button} disabled={modal} onClick={() => setCollapsed(new Set(data?.groups.map(g => g.id)))}>Contraer todo</button><button className={button} disabled={loading || modal} onClick={() => { setRevision(r => r + 1); setNotice(''); }}><RefreshCw className="mr-1 inline h-3 w-3" />Actualizar</button></div></div>
    {notice && <p role="status" className="text-sm text-emerald-700">{notice}</p>}
    {error && <p role="alert" className="rounded-lg bg-rose-50 p-4 text-sm text-rose-800">{error}</p>}
    {loading && <p role="status" className="p-6 text-sm text-slate-500">Cargando cuentas e importes…</p>}
    {data && <section className="overflow-hidden rounded-xl border bg-white shadow-sm" aria-label="Estado de resultados mensual">
      <div className="flex flex-wrap justify-between gap-2 border-b px-5 py-4"><h2 className="text-sm font-semibold">P&amp;L / {year}</h2><span className="text-xs text-slate-500">{currency} · {data.accounts.length} cuentas · {data.values.length ? 'Totales sobre importes cargados' : 'Importes pendientes de carga'}</span></div>
      {editing && <div className="flex flex-wrap items-center gap-3 border-b bg-blue-50 px-5 py-2 text-xs" aria-live="polite">
        <span className="text-slate-700">{editing.account.name} · {months[editing.month - 1]}</span>
        <code className="break-all text-blue-900">{draft}</code>
        {formulaPreview !== null && <span>Resultado: {displayAmount(formulaPreview)}</span>}
        <span className="text-rose-700" role={formError ? 'alert' : undefined}>{formError || formulaError}</span>
        <button className={button} disabled={saving} onClick={() => void save()}>{saving ? 'Guardando…' : 'Guardar'}</button>
        <button className={button} disabled={saving} onClick={() => { setEditing(null); setFormError(''); setPickedCell(''); }}>Cancelar</button>
      </div>}
      <div tabIndex={0} role="region" aria-label="Tabla mensual con desplazamiento" className="max-h-[72vh] overflow-auto"><table className="w-full border-separate border-spacing-0 text-sm"><caption className="sr-only">Estado de resultados {year}, {currency}. Las celdas vacías indican datos pendientes.</caption><thead className="sticky top-0 z-30"><tr className="text-xs text-white"><th className={cn(firstCell, 'z-40 bg-[#0B1B3B]')}>Concepto / Cuenta</th>{months.map(month => <th key={month} className="min-w-[104px] border-l border-slate-700 bg-[#0B1B3B] px-3 py-4 text-right font-medium">{month}-{String(year).slice(-2)}</th>)}<th className="min-w-[112px] bg-[#132B51] px-3 py-4 text-right">Total anual</th></tr></thead><tbody>
        {data.sections.map(section => {
          const groups = data.groups.filter(g => g.section_id === section.id);
          const ids = new Set(groups.map(g => g.id));
          const accounts = data.accounts.filter(a => ids.has(a.group_id));
          return <Fragment key={section.id}><tr className={tones[section.code] || 'bg-blue-50'}><th className={cn(firstCell, 'font-bold uppercase tracking-wider', tones[section.code] || 'bg-blue-50')}><span className="group/section flex items-center justify-between gap-2">{editableName('sections', section)}{data.canEdit && <button type="button" disabled={Boolean(renaming) || Boolean(editing) || saving || moving} aria-label={`Agregar grupo en ${section.name}`} title={`Agregar grupo en ${section.name}`} className="rounded p-1 opacity-0 transition-opacity hover:bg-white/70 focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400 group-hover/section:opacity-100 disabled:opacity-0" onClick={() => { setNewSection(section); setName(''); setFormError(''); }}><Plus className="h-5 w-5" /></button>}</span></th>{cells([])}</tr>{groups.filter(g => !g.parent_id).map(g => renderGroup(g))}
            {!groups.length && <tr><td colSpan={14} className="px-5 py-4 text-xs text-slate-400">Catálogo pendiente de cargar.</td></tr>}
            <tr className="bg-[#193D6B] text-white"><th className={cn(firstCell, 'bg-[#193D6B]')}>Total {section.name.toLowerCase()}</th>{cells(accounts)}</tr>
            {section.code === 'EGRESOS' && <tr className="bg-[#0B1B3B] text-white"><th className={cn(firstCell, 'bg-[#0B1B3B]')}>Resultado operativo</th>{results.map((value, i) => <td key={i} title={value === null ? 'Completa los ingresos y egresos del mes, incluyendo los ceros.' : undefined} className="border-b border-l border-slate-700 px-3 text-right text-xs">{renderAmount(value)}</td>)}<td className="border-l border-slate-700 px-3 text-right text-xs">{renderAmount(results.every(v => v !== null) ? sumAmounts(results as string[]) : null)}</td></tr>}
            <tr aria-hidden="true"><td colSpan={14} className="h-5" /></tr></Fragment>;
        })}
      </tbody></table></div><p className="border-t px-5 py-3 text-xs leading-relaxed text-slate-500">{data.canEdit ? 'Haz clic en una celda para editar; Enter guarda y Escape cancela. Haz clic en un nombre para editarlo y pulsa Enter para guardar; Escape cancela. Usa + para agregar una cuenta.' : 'Consulta disponible. La edición requiere que tu correo esté habilitado por el administrador.'} Los totales suman únicamente valores cargados; un mes vacío no equivale a cero. USD y BOB se cargan por separado. El resultado operativo se muestra cuando todas las cuentas de ingresos y egresos del mes tienen un importe, incluyendo los ceros.</p>
    </section>}
    {(newGroup || newSubgroup || newSection) && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"><form role="dialog" aria-modal="true" aria-labelledby="pl-edit-title" className="w-full max-w-md space-y-4 rounded-xl bg-white p-6 shadow-xl" onSubmit={e => { e.preventDefault(); void save(); }} onKeyDown={e => { if (e.key === 'Escape' && !saving) { setEditing(null); setNewGroup(null); setNewSubgroup(null); setNewSection(null); setRenaming(null); } if (e.key === 'Tab') { const nodes = e.currentTarget.querySelectorAll<HTMLElement>('input,button:not(:disabled)'); const first = nodes[0], last = nodes[nodes.length - 1]; if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); } } }}>
      <h2 id="pl-edit-title" className="text-lg font-semibold">{editing ? `Editar ${cellAddress(numberedRows,editing.account.id,editing.month)}` : newSubgroup ? 'Agregar subcuenta' : newSection ? 'Agregar grupo' : renaming ? 'Editar nombre' : 'Agregar cuenta'}</h2><p className="text-sm text-slate-500">{editing ? `${editing.account.name} · ${months[editing.month - 1]} ${year} · ${currency}` : newSubgroup ? `Dentro de ${newSubgroup.name}` : newSection ? `Dentro de ${newSection.name}` : renaming?.name || newGroup?.name}</p>
      <label className="block text-sm">{editing ? 'Importe o fórmula' : 'Nombre'}<input autoFocus disabled={saving} className={cn('mt-2 w-full rounded-lg border px-3 py-2', editing && draft.trim().startsWith('=') && 'font-mono text-sm')} inputMode="text" value={editing ? draft : name} maxLength={editing ? 500 : 200} required={!editing} onChange={e => editing ? setDraft(e.target.value) : setName(e.target.value)} /></label>
      {editing && <div className="space-y-2 text-xs text-slate-500">
        <p>Sin separadores de miles. Ejemplo: 38377,50. Deja vacío para quitar el importe de este mes.</p>
        {!data?.formulasEnabled && <p className="text-amber-700">Las fórmulas están pendientes de habilitación. Puedes seguir cargando importes.</p>}
        {formulaPreview !== null && <div role="status" className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-blue-900">Resultado: <strong>{displayAmount(formulaPreview)}</strong> {currency}</div>}
        {formulaError && <p role="status" className="text-rose-700">{formulaError}</p>}
      </div>}
      {formError && <p role="alert" className="text-sm text-rose-700">{formError}</p>}<div className="flex justify-end gap-2"><button type="button" className={button} disabled={saving} onClick={() => { setEditing(null); setNewGroup(null); setNewSubgroup(null); setNewSection(null); setRenaming(null); }}>Cancelar</button><button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50" disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</button></div>
    </form></div>}
    {removalConfirmation && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/50 p-4"><div role="alertdialog" aria-modal="true" aria-labelledby="remove-title" aria-describedby="remove-description" className="w-full max-w-md space-y-5 rounded-xl bg-white p-6 shadow-xl"><div className="flex items-start gap-3"><div className="rounded-full bg-amber-100 p-2 text-amber-700"><AlertTriangle className="h-5 w-5" /></div><div><h2 id="remove-title" className="text-lg font-semibold text-slate-900">{removalConfirmation.hasValues ? '¿Archivar esta cuenta?' : '¿Eliminar esta fila?'}</h2><p id="remove-description" className="mt-1 text-sm leading-relaxed text-slate-600">{removalConfirmation.hasValues ? <>La cuenta <strong className="font-semibold text-slate-900">«{removalConfirmation.name}»</strong> tiene importes guardados. Se conservarán en los informes históricos, pero la cuenta no podrá recibir nuevas cargas.</> : <>La fila <strong className="font-semibold text-slate-900">«{removalConfirmation.name}»</strong> no tiene importes guardados en ningún año ni moneda. Esta acción no se puede deshacer.</>}</p></div></div><div className="flex justify-end gap-2"><button type="button" className={button} disabled={saving} onClick={() => setRemovalConfirmation(null)}>Cancelar</button><button type="button" className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50" disabled={saving} onClick={() => void confirmAccountRemoval()}>{saving ? 'Procesando…' : removalConfirmation.hasValues ? 'Sí, archivar' : 'Sí, eliminar'}</button></div></div></div>}
    {groupRemovalConfirmation && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/50 p-4"><div role="alertdialog" aria-modal="true" aria-labelledby="remove-group-title" aria-describedby="remove-group-description" className="w-full max-w-md space-y-5 rounded-xl bg-white p-6 shadow-xl"><div className="flex items-start gap-3"><div className="rounded-full bg-amber-100 p-2 text-amber-700"><AlertTriangle className="h-5 w-5" /></div><div><h2 id="remove-group-title" className="text-lg font-semibold text-slate-900">{groupRemovalConfirmation.canDelete ? '¿Eliminar este grupo?' : 'No se puede eliminar este grupo'}</h2><p id="remove-group-description" className="mt-1 text-sm leading-relaxed text-slate-600">{groupRemovalConfirmation.canDelete ? <>El grupo <strong className="font-semibold text-slate-900">«{groupRemovalConfirmation.name}»</strong> y sus {groupRemovalConfirmation.accountCount} cuenta{groupRemovalConfirmation.accountCount === 1 ? '' : 's'} sin importes guardados serán eliminados. Esta acción no se puede deshacer.</> : <>El grupo <strong className="font-semibold text-slate-900">«{groupRemovalConfirmation.name}»</strong> contiene {groupRemovalConfirmation.hasValues ? 'importes históricos' : 'subgrupos'}. Elimina primero sus cuentas o subgrupos para proteger la información.</>}</p></div></div><div className="flex justify-end gap-2"><button type="button" className={button} disabled={saving} onClick={() => setGroupRemovalConfirmation(null)}>Cerrar</button>{groupRemovalConfirmation.canDelete && <button type="button" className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50" disabled={saving} onClick={() => void confirmGroupRemoval()}>{saving ? 'Eliminando…' : 'Sí, eliminar'}</button>}</div></div></div>}
  </div>;
}
