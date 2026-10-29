"use client";

import { PLFillHandle } from "./pl-fill-handle";
import { shiftPLFormula } from "@/lib/pl-fill";
import { usePLCellLinks } from "./pl-cell-links";
import { PLExchangeRates } from "./pl-exchange-rates";
import { Fragment, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  FileSpreadsheet,
  FolderPlus,
  GripVertical,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import {
  displayAmount,
  sumAmounts,
  type PLAccount,
  type PLData,
  type PLGroup,
  type PLSection,
} from "@/lib/pl-model";
import { parseCellInput } from "@/lib/pl-formula";
import {
  cellAddress,
  compileFormula,
  displayFormula,
  previewCell,
  recalculateValues,
  referenceRows,
} from "@/lib/pl-references";
import { cn } from "@/lib/utils";
import { PLSummaryView } from "./pl-summary-view";
import { FormulaDetailsCard } from "./formula-details-card";

const months = [
  "ENE",
  "FEB",
  "MAR",
  "ABR",
  "MAY",
  "JUN",
  "JUL",
  "AGO",
  "SEPT",
  "OCT",
  "NOV",
  "DIC",
];
const tones: Record<string, string> = {
  SOCIOS: "bg-blue-50 text-blue-900",
  INGRESOS: "bg-emerald-50 text-emerald-900",
  COSTOS_SERVICIOS: "bg-amber-50 text-amber-900",
  EGRESOS: "bg-rose-50 text-rose-900",
  INVERSION: "bg-amber-50 text-amber-900",
};
const button =
  "rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50";
const firstCell =
  "sticky left-0 z-10 min-w-[240px] max-w-[240px] border-b border-slate-200 px-4 py-3 text-left text-xs sm:min-w-[360px] sm:max-w-[360px]";

function renderAmount(value: string | null) {
  if (value === null || /^-?0+(\.0+)?$/.test(value)) {
    return (
      <span className="pl-empty-value text-slate-500" aria-label={value === null ? "Sin datos" : "0"}>
        —
      </span>
    );
  }
  return displayAmount(value);
}

export function IncomeStatementView() {
  const [year, setYear] = useState(2026);
  const [usdOriginal, setUsdOriginal] = useState(false);
  const [conversionNoticeClosed, setConversionNoticeClosed] = useState(false);
  const [summaryEditing, setSummaryEditing] = useState(false);
  const [summaryToolbarHost, setSummaryToolbarHost] = useState<HTMLDivElement | null>(null);
  const [currency, setCurrency] = useState("USD");
  const [data, setData] = useState<PLData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [revision, setRevision] = useState(0);
  const [compact, setCompact] = useState(true);
  const [totalsOnly, setTotalsOnly] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchTarget, setSearchTarget] = useState<string | null>(null);
  const searchButton = useRef<HTMLButtonElement>(null);
  const normalizeSearch = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const searchResults = (data?.accounts || []).filter(account =>
    (account.active || data?.values.some(value => value.account_id === account.id)) &&
    normalizeSearch(account.name).includes(normalizeSearch(searchQuery))
  );
  useEffect(() => {
    if (!searchTarget) return;
    const target = document.getElementById(`pl-account-${searchTarget}`);
    target?.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    target?.focus({ preventScroll: true });
  }, [searchTarget]);
  function selectSearchResult(account: PLAccount) {
    setTotalsOnly(false);
    setCollapsed(previous => {
      const next = new Set(previous);
      let id: string | null = account.group_id;
      const visited = new Set<string>();
      while (id && !visited.has(id)) {
        visited.add(id);
        next.delete(id);
        id = data?.groups.find(group => group.id === id)?.parent_id || null;
      }
      return next;
    });
    setSearchTarget(account.id);
    setSearchOpen(false);
  }
  const [collapsed, setCollapsed] = useState(new Set<string>());
  const [editing, setEditing] = useState<{
    account: PLAccount;
    month: number;
    previous: string | null;
  } | null>(null);
  const [draft, setDraft] = useState("");
  const [cellTyping, setCellTyping] = useState(false);
  const cellInput = useRef<HTMLInputElement>(null);
  const caret = useRef({ start: 0, end: 0 });
  const [pickedCell, setPickedCell] = useState("");
  const [referenceTarget, setReferenceTarget] = useState<{
    id: string;
    month: number;
  } | null>(null);
  useEffect(() => {
    if (!editing && !summaryEditing) setReferenceTarget(null);
  }, [editing, summaryEditing]);
  function navigateReference(account: PLAccount, month: number) {
    setTotalsOnly(false);
    setCollapsed((previous) => {
      const next = new Set(previous);
      let groupId: string | null = account.group_id;
      const visited = new Set<string>();
      while (groupId && !visited.has(groupId)) {
        visited.add(groupId);
        next.delete(groupId);
        groupId =
          data?.groups.find((group) => group.id === groupId)?.parent_id || null;
      }
      return next;
    });
    setPickedCell(cellAddress(numberedRows, account.id, month));
    setReferenceTarget({ id: account.id, month });
  }
  useEffect(() => {
    if (!referenceTarget || (!editing && !summaryEditing)) return;
    const target =
      document.getElementById(
        `pl-value-${referenceTarget.id}-${referenceTarget.month}`,
      ) ||
      document.querySelector<HTMLElement>(
        `[data-summary-section="${referenceTarget.id}"][data-summary-month="${referenceTarget.month}"]`,
      );
    target?.scrollIntoView({
      behavior: "smooth",
      block: "center",
      inline: "center",
    });
    target?.focus({ preventScroll: true });
  }, [referenceTarget, editing, summaryEditing]);

  function openCell(account: PLAccount, month: number) {
    const value = data?.values.find(
      (v) => v.account_id === account.id && v.month === month,
    );
    const initial = value?.formula
      ? displayFormula(value.formula, numberedRows)
      : (value?.amount ?? "");
    setEditing({ account, month, previous: value?.updated_at || null });
    setDraft(initial);
    setCellTyping(false);
    setPickedCell("");
    setReferenceTarget(null);
    setFormError("");
    caret.current = { start: initial.length, end: initial.length };
    requestAnimationFrame(() => {
      cellInput.current?.focus({ preventScroll: true });
      cellInput.current?.scrollIntoView({ block: "nearest", inline: "center" });
    });
  }
  async function moveCell(account: PLAccount, month: number, key: string) {
    const visible = numberedRows.filter(
      (a) => a.active && document.getElementById(`pl-value-${a.id}-1`),
    );
    const index = visible.findIndex((a) => a.id === account.id);
    const nextIndex =
      index + (key === "ArrowDown" ? 1 : key === "ArrowUp" ? -1 : 0);
    const nextMonth =
      month + (key === "ArrowRight" ? 1 : key === "ArrowLeft" ? -1 : 0);
    if (!visible[nextIndex] || nextMonth < 1 || nextMonth > 12) return;
    if (editing && cellTyping && !(await save())) return;
    openCell(visible[nextIndex], nextMonth);
  }

  function pickReference(address: string) {
    const { start, end } = caret.current;
    const next = draft.slice(0, start) + address + draft.slice(end);
    const position = start + address.length;
    setCellTyping(true);
    setDraft(next);
    setPickedCell(address);
    setFormError("");
    caret.current = { start: position, end: position };
    requestAnimationFrame(() => {
      cellInput.current?.focus({ preventScroll: true });
      cellInput.current?.setSelectionRange(position, position);
    });
  }

  const [newGroup, setNewGroup] = useState<PLGroup | null>(null);
  const [newSubgroup, setNewSubgroup] = useState<PLGroup | null>(null);
  const [newSection, setNewSection] = useState<PLSection | null>(null);
  const [renaming, setRenaming] = useState<{
    kind: "accounts" | "groups" | "sections";
    id: string;
    name: string;
  } | null>(null);
  const [dragging, setDragging] = useState<{
    kind: "accounts" | "groups";
    id: string;
  } | null>(null);
  const [drop, setDrop] = useState<{
    id: string;
    position: "before" | "after";
  } | null>(null);
  const [moving, setMoving] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [removalConfirmation, setRemovalConfirmation] = useState<{
    id: string;
    name: string;
    hasValues: boolean;
  } | null>(null);
  const [groupRemovalConfirmation, setGroupRemovalConfirmation] = useState<{
    id: string;
    name: string;
    accountCount: number;
    hasValues: boolean;
    hasChildren: boolean;
    canDelete: boolean;
  } | null>(null);
  const numberedRows = data ? referenceRows(data) : [];

  useEffect(() => {
    if (!editing) {
      setReferenceTarget(null);
      return;
    }
    const cancelOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.isComposing || saving) return;
      event.preventDefault();
      setEditing(null);
      setDraft("");
      setFormError("");
      setPickedCell("");
      setReferenceTarget(null);
    };
    window.addEventListener("keydown", cancelOnEscape);
    return () => window.removeEventListener("keydown", cancelOnEscape);
  }, [editing, saving]);

  function parseDraft() {
    if (!editing || !data || !draft.trim().startsWith("="))
      return parseCellInput(draft);
    const formula = compileFormula(draft, numberedRows);
    const calculated = previewCell(
      data,
      editing.account.id,
      editing.month,
      formula,
    );
    if (calculated.formulaError) throw new Error(calculated.formulaError);
    return { amount: calculated.amount, formula };
  }

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setData(null);
    fetch(currency==='USD' && !usdOriginal ? `/api/estado-resultados/conversion?year=${year}` : `/api/estado-resultados?year=${year}&currency=${currency}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok)
          throw new Error(body.error || "No se pudo cargar el P&L.");
        return body as PLData;
      })
      .then((body) => {
        if (!controller.signal.aborted) setData(body);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [year, currency, revision, usdOriginal]);

  useEffect(() => {
    if (!editing && !newGroup && !newSubgroup && !newSection && !renaming)
      return;
    const guard = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [editing, newGroup, newSubgroup, newSection, renaming]);

  async function fillAccount(account:PLAccount, sourceMonth:number, targets:number[]) {
    if(!data || !data.canEdit || saving || editing || summaryEditing)return;
    const source=data.values.find(v=>v.account_id===account.id && v.month===sourceMonth);
    if(!source)return;
    const copies=targets.map(month=>({...source,month,formula:source.formula?shiftPLFormula(source.formula,month-sourceMonth):null}));
    const proposed={...data,values:[...data.values.filter(v=>v.account_id!==account.id || !targets.includes(v.month)),...copies]};
    const computed=recalculateValues(proposed);
    const invalid=computed.find(v=>v.account_id===account.id && targets.includes(v.month) && v.formulaError);
    if(invalid)throw new Error(invalid.formulaError);
    setSaving(true);setNotice('');
    let completed=0;
    try {
      for(const copy of copies) {
        const previous=data.values.find(v=>v.account_id===account.id && v.month===copy.month)?.updated_at ?? null;
        const response=await fetch('/api/estado-resultados',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'value',accountId:account.id,year,currency,month:copy.month,amount:copy.amount,formula:copy.formula,previous})});
        const body=await response.json();if(!response.ok)throw new Error(body.error || 'No se pudo guardar.');
        completed++;
        setData(old=>{if(!old)return old;const next={...old,values:[...old.values.filter(v=>v.account_id!==account.id || v.month!==copy.month),body.value]};return {...next,values:recalculateValues(next)};});
      }
      setNotice(`Se rellenaron ${completed} meses.`);
    }catch(e){throw new Error(`Se guardaron ${completed} de ${targets.length} meses. ${e instanceof Error?e.message:'Error al guardar.'} Los restantes no se modificaron.`);}
    finally{setSaving(false);}
  }
  async function save() {
    setFormError("");
    let payload;
    try {
      payload = renaming
        ? {
            action: "rename",
            kind: renaming.kind,
            id: renaming.id,
            previousName: renaming.name,
            name,
          }
        : newSubgroup
          ? {
              action: "group",
              sectionId: newSubgroup.section_id,
              parentId: newSubgroup.id,
              name,
            }
          : newSection
            ? { action: "group", sectionId: newSection.id, name }
            : editing
              ? {
                  action: "value",
                  accountId: editing.account.id,
                  month: editing.month,
                  year,
                  currency,
                  previous: editing.previous,
                  ...parseDraft(),
                }
              : { action: "account", groupId: newGroup?.id, name };
      if (editing && draft.trim().startsWith("=") && !data?.formulasEnabled)
        throw new Error(
          "Las fórmulas todavía no están habilitadas en la base de datos.",
        );
    } catch (e) {
      setFormError((e as Error).message);
      return false;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/estado-resultados", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "No se pudo guardar.");
      setData((previous) => {
        if (!previous) return previous;
        if (renaming)
          return {
            ...previous,
            [renaming.kind]: previous[renaming.kind].map((record) =>
              record.id === renaming.id
                ? { ...record, name: body.record.name }
                : record,
            ),
          };
        if (editing) {
          const changed = {
            ...previous,
            values: [
              ...previous.values.filter(
                (v) =>
                  !(
                    v.account_id === editing.account.id &&
                    v.month === editing.month
                  ),
              ),
              ...(body.value ? [body.value] : []),
            ],
          };
          return { ...changed, values: recalculateValues(changed) };
        }
        if (newSubgroup || newSection)
          return {
            ...previous,
            groups: [...previous.groups, body.group].sort(
              (a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id),
            ),
          };
        return {
          ...previous,
          accounts: [...previous.accounts, body.account].sort(
            (a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id),
          ),
        };
      });
      if (newGroup)
        setCollapsed((previous) => {
          const next = new Set(previous);
          next.delete(newGroup.id);
          return next;
        });
      setEditing(null);
      setNewGroup(null);
      setNewSubgroup(null);
      setNewSection(null);
      setRenaming(null);
      setNotice("Cambios guardados en Supabase.");
      return true;
    } catch (e) {
      setFormError((e as Error).message);
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function removeAccount(id: string) {
    setSaving(true);
    setFormError("");
    try {
      async function request(action: string) {
        const response = await fetch("/api/estado-resultados", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, id }),
        });
        const result = await response.json();
        if (!response.ok)
          throw new Error(result.error || "No se pudo completar la operación.");
        return result;
      }
      const check = await request("remove-check");
      setRemovalConfirmation({
        id,
        name: check.name,
        hasValues: check.hasValues,
      });
    } catch (e) {
      setFormError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function confirmAccountRemoval() {
    if (!removalConfirmation) return;
    setSaving(true);
    setFormError("");
    try {
      const response = await fetch("/api/estado-resultados", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete-account",
          id: removalConfirmation.id,
        }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "No se pudo completar la operación.");
      setData((previous) =>
        previous
          ? {
              ...previous,
              values: previous.values.filter(v => v.account_id !== removalConfirmation.id),
              accounts: result.archived
                ? previous.accounts.map((a) =>
                    a.id === removalConfirmation.id
                      ? { ...a, active: false }
                      : a,
                  )
                : previous.accounts.filter(
                    (a) => a.id !== removalConfirmation.id,
                  ),
            }
          : previous,
      );
      setRemovalConfirmation(null);
      setRenaming(null);
      setNotice(
        result.archived
          ? "Cuenta archivada. Sus importes históricos se conservan."
          : "Fila eliminada.",
      );
    } catch (e) {
      setFormError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function removeGroup(id: string) {
    setSaving(true);
    setFormError("");
    try {
      const response = await fetch("/api/estado-resultados", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "remove-group-check", id }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "No se pudo comprobar el grupo.");
      setGroupRemovalConfirmation({ ...result, id });
    } catch (e) {
      setFormError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function confirmGroupRemoval() {
    if (!groupRemovalConfirmation?.canDelete) return;
    setSaving(true);
    setFormError("");
    try {
      const response = await fetch("/api/estado-resultados", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete-group",
          id: groupRemovalConfirmation.id,
        }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "No se pudo eliminar el grupo.");
      setData((previous) =>
        previous
          ? {
              ...previous,
              groups: previous.groups.filter(
                (group) => group.id !== groupRemovalConfirmation.id,
              ),
              accounts: previous.accounts.filter(
                (account) => !result.accountIds.includes(account.id),
              ),
            }
          : previous,
      );
      setGroupRemovalConfirmation(null);
      setNotice("Grupo eliminado.");
    } catch (e) {
      setFormError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function visibleAccounts(accounts: PLAccount[]) {
    return accounts.filter(
      (a) =>
        ((editing || summaryEditing) && referenceTarget?.id === a.id) ||
        a.active ||
        data?.values.some((v) => v.account_id === a.id),
    );
  }

  function editableName(
    kind: "accounts" | "groups" | "sections",
    record: { id: string; name: string },
  ) {
    if (!data?.canEdit) return <span>{record.name}</span>;
    if (renaming?.kind === kind && renaming.id === record.id) {
      return (
        <form
          className="min-w-0 flex-1 normal-case tracking-normal"
          onSubmit={(event) => {
            event.preventDefault();
            if (!saving) void save();
          }}
        >
          <input
            autoFocus
            aria-label={`Nombre de ${record.name}`}
            aria-describedby="pl-name-help"
            required
            maxLength={200}
            disabled={saving}
            value={name}
            onFocus={(event) => event.currentTarget.select()}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              event.stopPropagation();
              if (event.key === "Escape" && !saving) {
                event.preventDefault();
                setRenaming(null);
                setFormError("");
              }
            }}
            className="w-full rounded-md border border-blue-300 bg-white px-2 py-1.5 text-xs text-slate-900 outline-none ring-2 ring-blue-100 disabled:opacity-60"
          />
          <span
            id="pl-name-help"
            className="mt-1 block text-[10px] font-normal text-slate-500"
          >
            {saving
              ? "Guardando…"
              : "Enter para guardar · Escape para cancelar"}
          </span>
          {kind === "accounts" &&
            data.accounts.find((a) => a.id === record.id)?.active && (
              <button
                type="button"
                disabled={saving}
                onClick={() => void removeAccount(record.id)}
                className="mt-2 text-xs font-normal text-rose-600 hover:underline disabled:opacity-50"
              >
                Eliminar fila
              </button>
            )}
          {formError && (
            <span
              role="alert"
              className="mt-1 block text-xs font-normal text-rose-700"
            >
              {formError}
            </span>
          )}
        </form>
      );
    }
    return (
      <button
        type="button"
        disabled={Boolean(renaming) || Boolean(editing) || saving || moving}
        title="Haz clic para editar el nombre"
        aria-label={`Editar nombre de ${record.name}`}
        className="min-w-0 flex-1 rounded-md py-1 text-left font-inherit transition-colors hover:bg-blue-100/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400"
        onClick={() => {
          setRenaming({ kind, id: record.id, name: record.name });
          setName(record.name);
          setFormError("");
        }}
      >
        {record.name}
      </button>
    );
  }

  function sameLevel(kind: "accounts" | "groups", id: string, target: string) {
    if (!data) return false;
    if (kind === "accounts")
      return (
        data.accounts.find((a) => a.id === id)?.group_id ===
        data.accounts.find((a) => a.id === target)?.group_id
      );
    const a = data.groups.find((g) => g.id === id),
      b = data.groups.find((g) => g.id === target);
    return Boolean(
      a && b && a.section_id === b.section_id && a.parent_id === b.parent_id,
    );
  }
  async function moveRow(
    kind: "accounts" | "groups",
    id: string,
    targetId: string,
    position: "before" | "after",
  ) {
    setDragging(null);
    setDrop(null);
    if (id === targetId || moving) return;
    setMoving(true);
    setError("");
    setNotice("Guardando orden…");
    try {
      const response = await fetch("/api/estado-resultados", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reorder",
          kind,
          id,
          targetId,
          position,
        }),
      });
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.error || "No se pudo guardar el orden.");
      setData((previous) =>
        previous
          ? {
              ...previous,
              [kind]: previous[kind]
                .map((row) => ({
                  ...row,
                  sort_order:
                    body.order.find(
                      (o: { id: string; sort_order: number }) =>
                        o.id === row.id,
                    )?.sort_order ?? row.sort_order,
                }))
                .sort(
                  (a, b) =>
                    a.sort_order - b.sort_order || a.id.localeCompare(b.id),
                ),
            }
          : previous,
      );
      setNotice("Orden guardado.");
    } catch (e) {
      setNotice("");
      setError(
        (e as Error).message +
          " Pulsa Actualizar para consultar el orden guardado.",
      );
    } finally {
      setMoving(false);
    }
  }
  function dragHandle(
    kind: "accounts" | "groups",
    record: { id: string; name: string },
  ) {
    if (!data?.canEdit) return null;
    return (
      <button
        type="button"
        draggable={!modal && !saving}
        disabled={modal || saving}
        aria-label={`Mover ${record.name}`}
        title="Arrastra para mover. También puedes usar las flechas ↑ y ↓."
        className="absolute left-0 top-0 flex h-full w-5 cursor-grab items-center justify-center text-slate-300 opacity-0 transition-opacity hover:bg-blue-100/60 hover:text-blue-600 hover:opacity-100 focus-visible:opacity-100 active:cursor-grabbing active:opacity-100 disabled:cursor-default"
        onDragStart={(e) => {
          setDragging({ kind, id: record.id });
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", record.id);
        }}
        onDragEnd={() => {
          setDragging(null);
          setDrop(null);
        }}
        onKeyDown={(e) => {
          if (!["ArrowUp", "ArrowDown"].includes(e.key) || !data) return;
          e.preventDefault();
          const peers = data[kind].filter((r) =>
            sameLevel(kind, record.id, r.id),
          );
          const index = peers.findIndex((r) => r.id === record.id);
          const target = peers[index + (e.key === "ArrowUp" ? -1 : 1)];
          if (target)
            void moveRow(
              kind,
              record.id,
              target.id,
              e.key === "ArrowUp" ? "before" : "after",
            );
        }}
      >
        <GripVertical className="h-3 w-3" />
      </button>
    );
  }
  function dropProps(kind: "accounts" | "groups", id: string) {
    return {
      onDragOver: (e: React.DragEvent<HTMLTableRowElement>) => {
        if (
          !dragging ||
          dragging.kind !== kind ||
          !sameLevel(kind, dragging.id, id) ||
          moving
        )
          return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        const rect = e.currentTarget.getBoundingClientRect();
        setDrop({
          id,
          position: e.clientY < rect.top + rect.height / 2 ? "before" : "after",
        });
        const scroller = e.currentTarget.closest('[role="region"]');
        if (scroller) {
          const bounds = scroller.getBoundingClientRect();
          if (e.clientY > bounds.bottom - 45) scroller.scrollTop += 20;
          else if (e.clientY < bounds.top + 65) scroller.scrollTop -= 20;
        }
      },
      onDrop: (e: React.DragEvent<HTMLTableRowElement>) => {
        e.preventDefault();
        if (
          dragging &&
          drop?.id === id &&
          dragging.kind === kind &&
          sameLevel(kind, dragging.id, id)
        )
          void moveRow(kind, dragging.id, id, drop.position);
      },
    };
  }
  function dropLine(id: string) {
    return drop?.id === id
      ? drop.position === "before"
        ? "inset 0 3px #2563eb"
        : "inset 0 -3px #2563eb"
      : undefined;
  }

  function groupAccounts(
    groupId: string,
    seen = new Set<string>(),
  ): PLAccount[] {
    if (!data || seen.has(groupId)) return [];
    seen.add(groupId);
    return [
      ...data.accounts.filter((a) => a.group_id === groupId),
      ...data.groups
        .filter((g) => g.parent_id === groupId)
        .flatMap((g) => groupAccounts(g.id, seen)),
    ];
  }
  function valuesFor(accounts: PLAccount[], month?: number) {
    const ids = new Set(accounts.map((a) => a.id));
    return (data?.values || [])
      .filter(
        (v) =>
          ids.has(v.account_id) && (month === undefined || v.month === month),
      )
      .map((v) => v.amount);
  }
  function hasFormulaError(accounts: PLAccount[], month?: number) {
    const ids = new Set(accounts.map((a) => a.id));
    return data?.values.some(
      (value) =>
        ids.has(value.account_id) &&
        (month === undefined || value.month === month) &&
        value.formulaError,
    );
  }
  function cells(
    accounts: PLAccount[],
    account?: PLAccount,
    sectionId?: string,
  ) {
    return (
      <>
        {months.map((label, i) => {
          const value = data?.values.find(
            (v) => v.account_id === account?.id && v.month === i + 1,
          );
          const failed = hasFormulaError(accounts, i + 1);
          const amount = failed ? null : sumAmounts(valuesFor(accounts, i + 1));
          const formula = value?.formula
            ? displayFormula(value.formula, numberedRows)
            : undefined;
          const address = account
            ? cellAddress(numberedRows, account.id, i + 1)
            : "";
          const summaryTarget =
            summaryEditing &&
            referenceTarget?.id === (account?.id ?? sectionId) &&
            referenceTarget?.month === i + 1;
          const selectedReference = Boolean(
            summaryTarget || (account && editing && pickedCell === address),
          );
          const content = failed ? (
            <span
              className="text-rose-500"
              title={
                value?.formulaError ||
                "Una cuenta contiene una fórmula con error."
              }
            >
              #ERROR
            </span>
          ) : (
            renderAmount(amount)
          );
          return (
            <td
              key={label}
              onContextMenu={account ? event=>cellLinks.context(event,account.id,i+1,account.name) : undefined}
              data-fill-row={account ? `account-${account.id}` : undefined}
              data-fill-month={account ? i+1 : undefined}
              data-summary-section={sectionId}
              data-summary-month={sectionId ? i + 1 : undefined}
              style={
                sectionId && summaryEditing
                  ? { cursor: "crosshair" }
                  : undefined
              }
              id={account ? `pl-value-${account.id}-${i + 1}` : undefined}
              tabIndex={-1}
              onKeyDown={(e) => {
                if (
                  e.target instanceof HTMLInputElement ||
                  !account?.active ||
                  !data?.canEdit ||
                  saving ||
                  renaming ||
                  moving ||
                  editing
                )
                  return;
                if (
                  ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(
                    e.key,
                  )
                ) {
                  e.preventDefault();
                  void moveCell(account, i + 1, e.key);
                }
                if (e.key === "Delete" || e.key === "Backspace") {
                  e.preventDefault();
                  openCell(account, i + 1);
                }
              }}
              className={cn(
                "group/fill relative h-10 min-w-[104px] border-b border-l border-slate-200/60 text-right text-xs tabular-nums",
                selectedReference &&
                  "bg-emerald-50 text-emerald-950 ring-2 ring-inset ring-emerald-500 outline-none dark:bg-emerald-950 dark:text-emerald-100",
              )}
            >
              {account &&
              editing?.account.id === account.id &&
              editing.month === i + 1 ? (
                <input
                  ref={cellInput}
                  autoFocus
                  aria-label={`Editar ${account.name}, ${label}`}
                  disabled={saving}
                  className="h-10 w-full min-w-[104px] bg-white px-3 text-right text-sm text-slate-900 outline outline-2 -outline-offset-2 outline-blue-500"
                  value={draft}
                  maxLength={500}
                  onFocus={(e) => {
                    caret.current = {
                      start: e.currentTarget.selectionStart ?? draft.length,
                      end: e.currentTarget.selectionEnd ?? draft.length,
                    };
                  }}
                  onSelect={(e) => {
                    caret.current = {
                      start: e.currentTarget.selectionStart ?? draft.length,
                      end: e.currentTarget.selectionEnd ?? draft.length,
                    };
                  }}
                  onChange={(e) => {
                    setCellTyping(true);
                    setDraft(e.target.value);
                    setFormError("");
                    setPickedCell("");
                    caret.current = {
                      start: e.target.selectionStart ?? 0,
                      end: e.target.selectionEnd ?? 0,
                    };
                  }}
                  onKeyDown={(e) => {
                    if (e.nativeEvent.isComposing || saving) return;
                    if (e.key === "F2") {
                      e.preventDefault();
                      setCellTyping(true);
                      return;
                    }
                    if (e.key === "Delete" || e.key === "Backspace") {
                      setCellTyping(true);
                      return;
                    }
                    if (
                      [
                        "ArrowUp",
                        "ArrowDown",
                        "ArrowLeft",
                        "ArrowRight",
                      ].includes(e.key) &&
                      (!cellTyping || !draft.trim().startsWith("="))
                    ) {
                      e.preventDefault();
                      void moveCell(account, i + 1, e.key);
                      return;
                    }
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (!saving) void save();
                    }
                    if (e.key === "Escape" && !saving) {
                      setEditing(null);
                      setFormError("");
                      setPickedCell("");
                    }
                  }}
                />
              ) : account &&
                data?.canEdit &&
                (account.active ||
                  (editing?.account && draft.trim().startsWith("="))) ? (
                <button
                  type="button"
                  disabled={
                    Boolean(renaming) ||
                    moving ||
                    saving ||
                    Boolean(editing && !draft.trim().startsWith("="))
                  }
                  className={cn(
                    "h-full min-h-10 w-full px-3 py-2 text-right hover:bg-blue-100/60 focus-visible:outline-blue-500",
                    selectedReference &&
                      "bg-emerald-50 text-emerald-950 ring-2 ring-inset ring-emerald-500 dark:bg-emerald-950 dark:text-emerald-100",
                  )}
                  title={`${address}${formula ? " · " + formula : ""}`}
                  aria-label={`${editing ? "Seleccionar" : "Editar"} ${address}, ${account.name}, ${label} ${year}, ${currency}`}
                  onMouseDown={(e) => {
                    if (editing) e.preventDefault();
                  }}
                  onClick={() => {
                    if (editing) {
                      pickReference(address);
                      return;
                    }
                    openCell(account, i + 1);
                  }}
                >
                  {content}
                </button>
              ) : (
                <span
                  className="px-3"
                  title={formula}
                  aria-label={
                    amount === null && !failed ? "Sin datos" : undefined
                  }
                >
                  {content}
                </span>
              )}
              {account && cellLinks.indicator(account.id,i+1,account.name)}
              {account?.active && data?.canEdit && value && <PLFillHandle rowId={`account-${account.id}`} month={i+1} disabled={saving || Boolean(editing) || summaryEditing || Boolean(renaming) || moving} occupied={month=>Boolean(data.values.find(v=>v.account_id===account.id && v.month===month))} onFill={targets=>fillAccount(account,i+1,targets)}/>}
            </td>
          );
        })}
        <td className="min-w-[112px] border-b border-l border-slate-200/60 px-3 text-right text-xs font-semibold tabular-nums">
          {hasFormulaError(accounts) ? (
            <span className="text-rose-500">#ERROR</span>
          ) : (
            renderAmount(sumAmounts(valuesFor(accounts)))
          )}
        </td>
      </>
    );
  }
  function renderGroup(
    group: PLGroup,
    depth = 0,
    seen = new Set<string>(),
  ): React.ReactNode {
    if (!data || seen.has(group.id)) return null;
    const next = new Set(seen);
    next.add(group.id);
    const accounts = visibleAccounts(
      data.accounts.filter((a) => a.group_id === group.id),
    );
    const children = data.groups.filter((g) => g.parent_id === group.id);
    return (
      <Fragment key={group.id}>
        <tr {...dropProps("groups", group.id)} className="bg-slate-50">
          <th
            scope="row"
            className={cn(
              firstCell,
              "bg-slate-50 font-semibold text-slate-700",
            )}
            style={{
              paddingLeft: 24 + depth * 16,
              boxShadow: dropLine(group.id),
            }}
          >
            {dragHandle("groups", group)}
            <div className="group/account flex items-center gap-2">
              <button
                type="button"
                className="flex shrink-0 items-center rounded p-1 text-left hover:bg-blue-100"
                disabled={
                  Boolean(renaming) ||
                  saving ||
                  moving ||
                  Boolean(editing && !collapsed.has(group.id))
                }
                aria-label={`Expandir o contraer ${group.name}`}
                aria-expanded={!collapsed.has(group.id)}
                onClick={() =>
                  setCollapsed((previous) => {
                    const result = new Set(previous);
                    if (result.has(group.id)) result.delete(group.id);
                    else result.add(group.id);
                    return result;
                  })
                }
              >
                {collapsed.has(group.id) ? (
                  <ChevronRight className="h-4 w-4 shrink-0" />
                ) : (
                  <ChevronDown className="h-4 w-4 shrink-0" />
                )}
              </button>
              {editableName("groups", group)}
              {data.canEdit && (
                <>
                  <button
                    type="button"
                    disabled={
                      Boolean(renaming) || Boolean(editing) || saving || moving
                    }
                    aria-label={`Agregar cuenta en ${group.name}`}
                    title="Agregar cuenta"
                    className="rounded p-1 opacity-0 transition-opacity hover:bg-blue-100 focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400 group-hover/account:opacity-100 disabled:opacity-0"
                    onClick={() => {
                      setNewGroup(group);
                      setName("");
                      setFormError("");
                    }}
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    disabled={
                      Boolean(renaming) || Boolean(editing) || saving || moving
                    }
                    aria-label={`Agregar subcuenta en ${group.name}`}
                    title={`Agregar subcuenta en ${group.name}`}
                    className="rounded p-1 text-blue-600 opacity-0 transition-opacity hover:bg-blue-100 focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400 group-hover/account:opacity-100 disabled:opacity-0"
                    onClick={() => {
                      setNewSubgroup(group);
                      setName("");
                      setFormError("");
                    }}
                  >
                    <FolderPlus className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    disabled={
                      Boolean(renaming) || Boolean(editing) || saving || moving
                    }
                    aria-label={`Eliminar grupo ${group.name}`}
                    title={`Eliminar grupo ${group.name}`}
                    className="rounded p-1 text-rose-600 opacity-0 transition-opacity hover:bg-rose-100 focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose-400 group-hover/account:opacity-100 disabled:opacity-0"
                    onClick={() => void removeGroup(group.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </>
              )}
            </div>
          </th>
          {cells(groupAccounts(group.id))}
        </tr>
        {!collapsed.has(group.id) && (
          <>
            {accounts.map((account) => (
              <tr
                key={account.id}
                data-search-match={searchTarget === account.id || undefined}
                {...dropProps("accounts", account.id)}
                className="hover:bg-blue-50/40"
              >
                <th
                  scope="row"
                  id={`pl-account-${account.id}`}
                  tabIndex={-1}
                  className={cn(
                    firstCell,
                    "bg-white font-normal text-slate-600",
                  )}
                  style={{
                    paddingLeft: 40 + depth * 16,
                    boxShadow: dropLine(account.id),
                  }}
                >
                  {dragHandle("accounts", account)}
                  <span className="group/account-row inline-flex w-full items-center justify-between gap-2">
                    {editableName("accounts", account)}
                    {data.canEdit &&
                      !(
                        renaming?.kind === "accounts" &&
                        renaming.id === account.id
                      ) && (
                        <button
                          type="button"
                          disabled={saving || moving || Boolean(editing)}
                          aria-label={`Eliminar ${account.name}`}
                          title={`Eliminar ${account.name}`}
                          className="rounded p-1 text-rose-600 opacity-0 transition-opacity hover:bg-rose-100 focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose-400 group-hover/account-row:opacity-100 disabled:opacity-0"
                          onClick={() => void removeAccount(account.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                  </span>
                  {!account.active && (
                    <span className="ml-2 text-slate-400">(archivada)</span>
                  )}
                </th>
                {cells([account], account)}
              </tr>
            ))}
            {children.map((child) => renderGroup(child, depth + 1, next))}
            {!accounts.length && !children.length && (
              <tr>
                <td
                  colSpan={14}
                  className="border-b bg-white px-10 py-3 text-xs text-slate-400"
                >
                  Todavía no hay cuentas en este grupo.
                </td>
              </tr>
            )}
          </>
        )}
      </Fragment>
    );
  }
  let formulaPreview: string | null = null;
  let formulaError = "";
  if (editing && draft.trim().startsWith("=")) {
    try {
      formulaPreview = parseDraft().amount;
    } catch (e) {
      formulaError = (e as Error).message;
    }
  }
  const summaryAfter = data?.sections.some((s) => s.code === "DEPRECIACION")
    ? "DEPRECIACION"
    : data?.sections.some((s) => s.code === "IMPUESTOS")
      ? "IMPUESTOS"
      : "EGRESOS";
  const modal = Boolean(
    editing ||
    newGroup ||
    newSubgroup ||
    newSection ||
    renaming ||
    moving ||
    removalConfirmation ||
    groupRemovalConfirmation,
  );
  const cellLinks = usePLCellLinks(year,data?.conversion?"BOB":currency,"account",data?.canEdit ?? false,modal || summaryEditing || saving || moving);
  return (
    <div className="space-y-4 px-3 pb-4 pt-4 md:px-5 md:pt-6 lg:px-6">
      {cellLinks.overlay}
      <header className="flex flex-col justify-between gap-2 xl:flex-row xl:items-start">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-blue-600">
            <FileSpreadsheet className="h-4 w-4" />
            Reportes financieros
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Estado de Resultados
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Europe Intelligence Solutions · Sucursal Bolivia
          </p>
        </div>
        <div className="flex flex-col items-start gap-2 xl:items-end">
          <span className="rounded-full border bg-white px-3 py-1.5 text-xs text-slate-600">
            {loading
              ? "Cargando…"
              : data
                ? data.canEdit
                  ? "Edición habilitada"
                  : "Solo lectura"
                : "Sin conexión"}
          </span>
          <div className="flex flex-wrap items-end gap-2 xl:justify-end">
            <div className="flex gap-2">
              <label className="text-xs text-slate-500">
                Ejercicio
                <select
                  className="mt-1 block rounded-lg border bg-white px-2 py-2 text-xs text-slate-900"
                  value={year}
                  disabled={modal || summaryEditing}
                  onChange={(e) => {
                    setYear(Number(e.target.value));
                    setNotice("");
                  }}
                >
                  {[2025, 2026, 2027].map((y) => (
                    <option key={y}>{y}</option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-slate-500">
                Moneda
                <select
                  className="mt-1 block rounded-lg border bg-white px-2 py-2 text-xs text-slate-900"
                  value={currency==='USD' && usdOriginal ? 'USD_LOADED' : currency}
                  disabled={modal || summaryEditing}
                  onChange={(e) => {
                    setUsdOriginal(e.target.value==='USD_LOADED');
                    setCurrency(e.target.value==='USD_LOADED'?'USD':e.target.value);
                    setNotice("");
                  }}
                >
                  <option value="USD">USD · Convertido desde BOB</option>
                  <option value="USD_LOADED">USD · Cargado originalmente</option>
                  <option value="BOB">BOB · Bolivianos</option>
                </select>
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              <PLExchangeRates year={year} disabled={loading || modal || summaryEditing || saving} onSaved={()=>{setRevision(r=>r+1);setNotice("Tipos de cambio guardados.");}}/>
              <button
                className={button}
                disabled={loading || modal || summaryEditing}
                onClick={() => {
                  setRevision((r) => r + 1);
                  setNotice("");
                }}
              >
                <RefreshCw className="mr-1 inline h-3 w-3" />
                Actualizar
              </button>
            </div>
          </div>
        </div>
      </header>
      {data?.conversion && !conversionNoticeClosed && <div className="relative rounded-lg border bg-blue-500/5 py-3 pl-4 pr-12 text-xs text-muted-foreground">
        <button type="button" aria-label="Cerrar aviso de conversión" title="Cerrar aviso" onClick={()=>setConversionNoticeClosed(true)} className="absolute right-2 top-2 rounded-md p-1.5 hover:bg-blue-500/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500"><X className="h-4 w-4"/></button>
        USD calculado desde BOB con el tipo de cambio de cada mes. Para corregir importes, selecciona BOB.
        {months.some((_,i)=>!data.conversion?.rates[i+1]) && <p className="mt-1">Sin cotización: {months.filter((_,i)=>!data.conversion?.rates[i+1]).join(', ')}. Esos meses quedan sin convertir; el total anual incluye solo los meses convertidos.</p>}
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">{months.map((m,i)=><span key={m}>{m}: {data.conversion?.rates[i+1] ? displayAmount(data.conversion.rates[i+1]) : 'Pendiente'}</span>)}</div>
      </div>}
      {editing && data && (
        <FormulaDetailsCard
          anchor={cellInput}
          draft={draft}
          rows={numberedRows}
          data={data}
          currency={currency}
          error={formError || formulaError}
          onNavigate={navigateReference}
        />
      )}
      {notice && (
        <p role="status" className="text-sm text-emerald-700">
          {notice}
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="rounded-lg bg-rose-50 p-4 text-sm text-rose-800"
        >
          {error}
        </p>
      )}
      {loading && (
        <p role="status" className="p-6 text-sm text-slate-500">
          Cargando cuentas e importes…
        </p>
      )}
      {data && (
        <section
          className={cn("pl-insight overflow-hidden rounded-2xl border bg-white shadow-sm", compact && "pl-compact")}
          aria-label="Estado de resultados mensual"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-sm font-semibold">P&amp;L / {year}</h2>
              <span className="text-xs text-slate-500">{currency} · {data.accounts.length} cuentas</span>
              <div className="flex gap-1 rounded-full bg-slate-100 p-1 dark:bg-slate-800">
                <button type="button" aria-pressed={compact} onClick={() => setCompact(v => !v)} className={cn("rounded-full px-3 py-1 text-xs transition-colors", compact ? "bg-white text-indigo-700 shadow-sm dark:bg-slate-700 dark:text-indigo-200" : "text-slate-500")}>Compacto</button>
                <button type="button" aria-pressed={totalsOnly} disabled={modal || summaryEditing} onClick={() => setTotalsOnly(v => !v)} className={cn("rounded-full px-3 py-1 text-xs transition-colors disabled:opacity-50", totalsOnly ? "bg-white text-indigo-700 shadow-sm dark:bg-slate-700 dark:text-indigo-200" : "text-slate-500")}>Solo totales</button>
              </div>
            </div>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <button
                className={button}
                disabled={saving || moving || Boolean(renaming)}
                onClick={() => { setTotalsOnly(false); setCollapsed(new Set()); }}
              >
                Expandir todo
              </button>
              <button
                className={button}
                disabled={modal}
                onClick={() =>
                  setCollapsed(new Set(data?.groups.map((g) => g.id)))
                }
              >
                Contraer todo
              </button>
              <button ref={searchButton} type="button" className={button} title="Buscar cuenta" aria-label="Buscar cuenta" aria-expanded={searchOpen} aria-controls="pl-account-search" disabled={modal || summaryEditing} onClick={() => {setSearchOpen(v => !v); setSearchTarget(null);}}><Search className="h-4 w-4" /></button>
            </div>
          </div>
          {searchOpen && <div id="pl-account-search" className="border-b bg-slate-50/70 px-4 py-3 dark:bg-slate-900/50" onKeyDown={event => {if(event.key === "Escape") {event.stopPropagation(); setSearchOpen(false); searchButton.current?.focus();}}}>
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 shrink-0 text-slate-400" />
              <input autoFocus type="search" aria-label="Nombre de la cuenta" placeholder="Buscar cuenta…" value={searchQuery} onChange={event => {setSearchQuery(event.target.value); setSearchTarget(null);}} onKeyDown={event => {if(event.key === "Enter" && searchQuery.trim() && searchResults[0]) {event.preventDefault(); selectSearchResult(searchResults[0]);}}} className="min-w-0 flex-1 rounded-lg border bg-white px-3 py-2 text-sm dark:bg-slate-800" />
              <button type="button" className={button} aria-label="Cerrar búsqueda" onClick={() => {setSearchOpen(false); searchButton.current?.focus();}}><X className="h-4 w-4" /></button>
            </div>
            {searchQuery.trim() && <>
              <p role="status" className="mt-2 text-xs text-slate-500">{searchResults.length ? `${searchResults.length} coincidencias` : "No se encontraron cuentas."}</p>
              <div className="mt-1 max-h-48 overflow-y-auto">
                {searchResults.map(account => <button key={account.id} type="button" onClick={() => selectSearchResult(account)} className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-xs hover:bg-indigo-50 focus-visible:bg-indigo-50 dark:hover:bg-slate-800 dark:focus-visible:bg-slate-800">
                  <span>{account.name}</span><span className="text-slate-500">{data.groups.find(group => group.id === account.group_id)?.name}</span>
                </button>)}
              </div>
            </>}
          </div>}
          <div ref={setSummaryToolbarHost} />
          {editing && (
            <div
              className="flex flex-wrap items-center gap-3 border-b bg-blue-50 px-5 py-2 text-xs"
              aria-live="polite"
            >
              <span className="text-slate-700">
                {editing.account.name} · {months[editing.month - 1]}
              </span>
              <code className="break-all text-blue-900">{draft}</code>
              {formulaPreview !== null && (
                <span>Resultado: {displayAmount(formulaPreview)}</span>
              )}
              <span
                className="text-rose-700"
                role={formError ? "alert" : undefined}
              >
                {formError || formulaError}
              </span>
              <button
                className={button}
                disabled={saving}
                onClick={() => void save()}
              >
                {saving ? "Guardando…" : "Guardar"}
              </button>
              <button
                className={button}
                disabled={saving}
                onClick={() => {
                  setEditing(null);
                  setFormError("");
                  setPickedCell("");
                }}
              >
                Cancelar
              </button>
            </div>
          )}
          <div
            tabIndex={0}
            role="region"
            aria-label="Tabla mensual con desplazamiento"
            className="max-h-[72vh] overflow-auto"
          >
            <table className="w-full border-separate border-spacing-0 text-sm">
              <caption className="sr-only">
                Estado de resultados {year}, {currency}. Las celdas vacías
                indican datos pendientes.
              </caption>
              <thead className="sticky top-0 z-30">
                <tr className="text-xs text-white">
                  <th className={cn(firstCell, "z-40 bg-[#0B1B3B]")}>
                    Concepto / Cuenta
                  </th>
                  {months.map((month) => (
                    <th
                      key={month}
                      className="min-w-[104px] border-l border-slate-700 bg-[#0B1B3B] px-3 py-4 text-right font-medium"
                    >
                      {month}-{String(year).slice(-2)}
                    </th>
                  ))}
                  <th className="min-w-[112px] bg-[#132B51] px-3 py-4 text-right">
                    Total anual
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.sections.map((section) => {
                  const groups = data.groups.filter(
                    (g) => g.section_id === section.id,
                  );
                  const ids = new Set(groups.map((g) => g.id));
                  const accounts = data.accounts.filter((a) =>
                    ids.has(a.group_id),
                  );
                  return (
                    <Fragment key={section.id}>
                      {!totalsOnly && <>
                      <tr className="pl-section" data-tone={section.code}>
                        <th
                          className={cn(
                            firstCell,
                            "font-bold uppercase tracking-wider",
                            tones[section.code] || "bg-blue-50",
                          )}
                        >
                          <span className="pl-section-label group/section flex items-center justify-between gap-2">
                            {editableName("sections", section)}
                            {data.canEdit && (
                              <button
                                type="button"
                                disabled={
                                  Boolean(renaming) ||
                                  Boolean(editing) ||
                                  saving ||
                                  moving
                                }
                                aria-label={`Agregar grupo en ${section.name}`}
                                title={`Agregar grupo en ${section.name}`}
                                className="rounded p-1 opacity-0 transition-opacity hover:bg-white/70 focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400 group-hover/section:opacity-100 disabled:opacity-0"
                                onClick={() => {
                                  setNewSection(section);
                                  setName("");
                                  setFormError("");
                                }}
                              >
                                <Plus className="h-5 w-5" />
                              </button>
                            )}
                          </span>
                        </th>
                        {Array.from({ length: 13 }, (_, index) => <td key={index} />)}
                      </tr>
                      {groups
                        .filter((g) => !g.parent_id)
                        .map((g) => renderGroup(g))}
                      {!groups.length && (
                        <tr>
                          <td
                            colSpan={14}
                            className="px-5 py-4 text-xs text-slate-400"
                          >
                            Catálogo pendiente de cargar.
                          </td>
                        </tr>
                      )}
                      </>}
                      <tr className="pl-total" data-tone={section.code}>
                        <th className={cn(firstCell, "bg-[#193D6B]")}>
                          Total {section.name.toLowerCase()}
                        </th>
                        {cells(accounts, undefined, section.id)}
                      </tr>
                      {section.code === summaryAfter && (
                        <PLSummaryView
                          data={data}
                          year={year}
                          currency={currency}
                          locked={modal || saving}
                          toolbarHost={summaryToolbarHost}
                          onEditingChange={setSummaryEditing}
                          onNavigateReference={navigateReference}
                        />
                      )}
                      <tr aria-hidden="true">
                        <td colSpan={14} className={totalsOnly ? "h-1" : "h-2"} />
                      </tr>
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {(newGroup || newSubgroup || newSection) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <form
            role="dialog"
            aria-modal="true"
            aria-labelledby="pl-edit-title"
            className="w-full max-w-md space-y-4 rounded-xl bg-white p-6 shadow-xl"
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape" && !saving) {
                setEditing(null);
                setNewGroup(null);
                setNewSubgroup(null);
                setNewSection(null);
                setRenaming(null);
              }
              if (e.key === "Tab") {
                const nodes = e.currentTarget.querySelectorAll<HTMLElement>(
                  "input,button:not(:disabled)",
                );
                const first = nodes[0],
                  last = nodes[nodes.length - 1];
                if (e.shiftKey && document.activeElement === first) {
                  e.preventDefault();
                  last.focus();
                } else if (!e.shiftKey && document.activeElement === last) {
                  e.preventDefault();
                  first.focus();
                }
              }
            }}
          >
            <h2 id="pl-edit-title" className="text-lg font-semibold">
              {editing
                ? `Editar ${cellAddress(numberedRows, editing.account.id, editing.month)}`
                : newSubgroup
                  ? "Agregar subcuenta"
                  : newSection
                    ? "Agregar grupo"
                    : renaming
                      ? "Editar nombre"
                      : "Agregar cuenta"}
            </h2>
            <p className="text-sm text-slate-500">
              {editing
                ? `${editing.account.name} · ${months[editing.month - 1]} ${year} · ${currency}`
                : newSubgroup
                  ? `Dentro de ${newSubgroup.name}`
                  : newSection
                    ? `Dentro de ${newSection.name}`
                    : renaming?.name || newGroup?.name}
            </p>
            <label className="block text-sm">
              {editing ? "Importe o fórmula" : "Nombre"}
              <input
                autoFocus
                disabled={saving}
                className={cn(
                  "mt-2 w-full rounded-lg border px-3 py-2",
                  editing &&
                    draft.trim().startsWith("=") &&
                    "font-mono text-sm",
                )}
                inputMode="text"
                value={editing ? draft : name}
                maxLength={editing ? 500 : 200}
                required={!editing}
                onChange={(e) =>
                  editing ? setDraft(e.target.value) : setName(e.target.value)
                }
              />
            </label>
            {editing && (
              <div className="space-y-2 text-xs text-slate-500">
                <p>
                  Sin separadores de miles. Ejemplo: 38377,50. Deja vacío para
                  quitar el importe de este mes.
                </p>
                {!data?.formulasEnabled && (
                  <p className="text-amber-700">
                    Las fórmulas están pendientes de habilitación. Puedes seguir
                    cargando importes.
                  </p>
                )}
                {formulaPreview !== null && (
                  <div
                    role="status"
                    className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-blue-900"
                  >
                    Resultado: <strong>{displayAmount(formulaPreview)}</strong>{" "}
                    {currency}
                  </div>
                )}
                {formulaError && (
                  <p role="status" className="text-rose-700">
                    {formulaError}
                  </p>
                )}
              </div>
            )}
            {formError && (
              <p role="alert" className="text-sm text-rose-700">
                {formError}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className={button}
                disabled={saving}
                onClick={() => {
                  setEditing(null);
                  setNewGroup(null);
                  setNewSubgroup(null);
                  setNewSection(null);
                  setRenaming(null);
                }}
              >
                Cancelar
              </button>
              <button
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                disabled={saving}
              >
                {saving ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </form>
        </div>
      )}
      {removalConfirmation && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/50 p-4">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="remove-title"
            aria-describedby="remove-description"
            className="w-full max-w-md space-y-5 rounded-xl bg-white p-6 shadow-xl"
          >
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-amber-100 p-2 text-amber-700">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h2
                  id="remove-title"
                  className="text-lg font-semibold text-slate-900"
                >
                  ¿Eliminar esta cuenta?
                </h2>
                <p
                  id="remove-description"
                  className="mt-1 text-sm leading-relaxed text-slate-600"
                >
                  {removalConfirmation.hasValues ? (
                    <>
                      La cuenta{" "}
                      <strong className="font-semibold text-slate-900">
                        «{removalConfirmation.name}»
                      </strong>{" "}
                      se eliminará junto con sus importes de todos los años y monedas y sus enlaces a facturas. Los archivos de Drive se conservan. Esta acción no se puede deshacer.
                    </>
                  ) : (
                    <>
                      La fila{" "}
                      <strong className="font-semibold text-slate-900">
                        «{removalConfirmation.name}»
                      </strong>{" "}
                      no tiene importes guardados en ningún año ni moneda. Esta
                      acción no se puede deshacer.
                    </>
                  )}
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className={button}
                disabled={saving}
                onClick={() => setRemovalConfirmation(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50"
                disabled={saving}
                onClick={() => void confirmAccountRemoval()}
              >
                {saving
                  ? "Procesando…"
                  : "Sí, eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}
      {groupRemovalConfirmation && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/50 p-4">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="remove-group-title"
            aria-describedby="remove-group-description"
            className="w-full max-w-md space-y-5 rounded-xl bg-white p-6 shadow-xl"
          >
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-amber-100 p-2 text-amber-700">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h2
                  id="remove-group-title"
                  className="text-lg font-semibold text-slate-900"
                >
                  {groupRemovalConfirmation.canDelete
                    ? "¿Eliminar este grupo?"
                    : "No se puede eliminar este grupo"}
                </h2>
                <p
                  id="remove-group-description"
                  className="mt-1 text-sm leading-relaxed text-slate-600"
                >
                  {groupRemovalConfirmation.canDelete ? (
                    <>
                      El grupo{" "}
                      <strong className="font-semibold text-slate-900">
                        «{groupRemovalConfirmation.name}»
                      </strong>{" "}
                      y sus {groupRemovalConfirmation.accountCount} cuenta
                      {groupRemovalConfirmation.accountCount === 1 ? "" : "s"}{" "}
                      sin importes guardados serán eliminados. Esta acción no se
                      puede deshacer.
                    </>
                  ) : (
                    <>
                      El grupo{" "}
                      <strong className="font-semibold text-slate-900">
                        «{groupRemovalConfirmation.name}»
                      </strong>{" "}
                      contiene{" "}
                      {groupRemovalConfirmation.hasValues
                        ? "importes históricos"
                        : "subgrupos"}
                      . Elimina primero sus cuentas o subgrupos para proteger la
                      información.
                    </>
                  )}
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className={button}
                disabled={saving}
                onClick={() => setGroupRemovalConfirmation(null)}
              >
                Cerrar
              </button>
              {groupRemovalConfirmation.canDelete && (
                <button
                  type="button"
                  className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50"
                  disabled={saving}
                  onClick={() => void confirmGroupRemoval()}
                >
                  {saving ? "Eliminando…" : "Sí, eliminar"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
