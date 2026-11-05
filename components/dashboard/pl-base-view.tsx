"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, FileSpreadsheet, RefreshCw, Search, X } from "lucide-react";
import {
  EDITABLE_KINDS,
  editableText,
  type Statement,
  type StatementCell,
  type StatementRow,
} from "@/lib/pl-base-sheet";
import { cn } from "@/lib/utils";

const MONTHS = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEPT", "OCT", "NOV", "DIC"];
const SECTION_TONES = [
  "bg-blue-50 text-blue-900",
  "bg-emerald-50 text-emerald-900",
  "bg-amber-50 text-amber-900",
  "bg-rose-50 text-rose-900",
];
const button =
  "rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50";
const firstCell =
  "sticky left-0 z-10 min-w-[240px] max-w-[240px] border-b border-slate-200 px-4 py-2.5 text-left text-xs sm:min-w-[360px] sm:max-w-[360px]";

type View = "completo" | "totales";

function plain(text: string) {
  return text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function isEmpty(cell: StatementCell | undefined) {
  const t = cell?.text.trim() ?? "";
  return t === "" || t === "-" || /^-?0([.,]0+)?%?$/.test(t);
}

/**
 * Sección y grupos que contienen cada fila (para búsqueda y para contraer).
 * Los totales y resultados no tienen: siguen visibles con la sección contraída.
 */
function ancestorsOf(rows: StatementRow[]): Map<number, number[]> {
  const result = new Map<number, number[]>();
  const stack: number[] = [];
  let section = -1;
  rows.forEach((row, i) => {
    if (row.kind === "section") {
      section = i;
      stack.length = 0;
      result.set(i, []);
      return;
    }
    if (row.kind === "total" || row.kind === "result") {
      stack.length = 0;
      result.set(i, []);
      return;
    }
    while (stack.length && rows[stack[stack.length - 1]].level >= row.level) stack.pop();
    result.set(i, section >= 0 ? [section, ...stack] : [...stack]);
    if (row.kind === "group") stack.push(i);
  });
  return result;
}

type Currency = "USD" | "BOB";

/** Filas que no se convierten: porcentajes, índices y el propio TC. */
function isRatio(row: StatementRow, cell: StatementCell) {
  return row.kind === "info" || cell.text.trim().endsWith("%");
}

/** "=Q293/Q291": cociente entre dos filas de la misma columna. */
const RATIO_FORMULA = /^=\$?([A-Z]{1,3})\$?(\d+)\/\$?([A-Z]{1,3})\$?(\d+)$/;

const bobFormat = (value: number) =>
  value.toLocaleString("es-BO", { maximumFractionDigits: Math.abs(value) < 100 ? 2 : 0 });

export function PLBaseView() {
  const [data, setData] = useState<(Statement & { canEdit?: boolean }) | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState<number | null>(null);
  const [view, setView] = useState<View>("completo");
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [selected, setSelected] = useState<{ row: StatementRow; month: number } | null>(null);
  const [reload, setReload] = useState(0);
  const [currency, setCurrency] = useState<Currency>("USD");
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    fetch("/api/estado-resultados-base", { signal: controller.signal, cache: "no-store" })
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body?.error || "No se pudo cargar el P&L.");
        const statement = body as Statement & { canEdit?: boolean };
        setData(statement);
        setYear((current) => {
          if (current && statement.years.includes(current)) return current;
          const thisYear = new Date().getFullYear();
          return statement.years.includes(thisYear) ? thisYear : statement.years[statement.years.length - 1] ?? null;
        });
      })
      .catch((e: Error) => {
        if (e.name !== "AbortError") setError(e.message);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [reload]);

  useEffect(() => {
    const close = (e: KeyboardEvent) => e.key === "Escape" && setSelected(null);
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);

  const rows = useMemo(() => data?.rows ?? [], [data]);
  const ancestors = useMemo(() => ancestorsOf(rows), [rows]);
  const collapsibleIndexes = useMemo(
    () => rows.map((r, i) => (r.kind === "group" || r.kind === "section" ? i : -1)).filter((i) => i >= 0),
    [rows]
  );
  const accounts = rows.filter((r) => r.kind === "account").length;
  const rowsBySheetRow = useMemo(
    () => new Map(rows.filter((r) => r.kind !== "section").map((r) => [r.row, r])),
    [rows]
  );

  const visible = useMemo(() => {
    const q = plain(query.trim());
    if (q) {
      const keep = new Set<number>();
      rows.forEach((row, i) => {
        if (row.kind === "section" || !plain(row.label).includes(q)) return;
        keep.add(i);
        ancestors.get(i)?.forEach((a) => keep.add(a));
      });
      // Encabezado de sección de cada coincidencia.
      let section = -1;
      rows.forEach((row, i) => {
        if (row.kind === "section") section = i;
        else if (keep.has(i) && section >= 0) keep.add(section);
      });
      return rows.map((row, i) => ({ row, i })).filter(({ i }) => keep.has(i));
    }
    return rows
      .map((row, i) => ({ row, i }))
      .filter(({ row, i }) => {
        if (view === "totales" && !["section", "group", "total", "result"].includes(row.kind)) return false;
        if (view === "totales" && row.kind === "group" && row.level > 1) return false;
        return !(ancestors.get(i) ?? []).some((a) => collapsed.has(a));
      });
  }, [rows, ancestors, collapsed, query, view]);

  const yy = year ? String(year).slice(-2) : "";
  let sectionCount = -1;
  // Letra de columna del Sheet para cada mes y el total ("Q", "R", … "AC").
  const columnLetters = year
    ? (rows.find((r) => r.cells[year]?.length)?.cells[year] ?? []).map((c) => c.address.replace(/\d+$/, ""))
    : [];

  function toggle(i: number) {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  // TC PARALELO de cada mes del año elegido (null si falta).
  const tcRow = rows.find((r) => r.kind === "info" && plain(r.label).startsWith("tc paralelo"));
  const rates = year
    ? (tcRow?.cells[year] ?? []).slice(0, 12).map((c) => (c.value && c.value > 0 ? c.value : null))
    : [];
  const missingRates = MONTHS.filter((_, m) => !rates[m]);

  /** Importe en Bs: USD × TC del mes; el total anual suma los meses convertidos. */
  function bobAmount(row: StatementRow | undefined, m: number): number | null {
    const cells = row && year ? row.cells[year] ?? [] : [];
    const convert = (c: StatementCell | undefined, i: number) =>
      c && c.value !== null && rates[i] ? c.value * rates[i]! : null;
    if (m < 12) return convert(cells[m], m);
    return cells.slice(0, 12).reduce<number | null>((sum, c, i) => {
      const v = convert(c, i);
      return v === null ? sum : (sum ?? 0) + v;
    }, null);
  }

  /**
   * Texto de la celda en la moneda elegida. Los porcentajes del tipo
   * "=Q293/Q291" se recalculan con los importes en Bs de esas filas; el resto
   * de porcentajes, índices y el TC se muestran como en el Sheet.
   */
  function display(row: StatementRow, m: number): { text: string; empty: boolean } {
    const cell = year ? row.cells[year]?.[m] : undefined;
    if (!cell) return { text: "", empty: true };
    if (currency === "USD" || row.kind === "info") return { text: cell.text, empty: isEmpty(cell) };
    if (isRatio(row, cell)) {
      const ratio = RATIO_FORMULA.exec((cell.formula ?? "").replace(/\s+/g, "").toUpperCase());
      const column = cell.address.replace(/\d+$/, "");
      if (ratio && ratio[1] === column && ratio[3] === column) {
        const a = bobAmount(rowsBySheetRow.get(Number(ratio[2])), m);
        const b = bobAmount(rowsBySheetRow.get(Number(ratio[4])), m);
        if (a !== null && b) {
          return {
            text: `${((a / b) * 100).toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`,
            empty: false,
          };
        }
      }
      return { text: cell.text, empty: isEmpty(cell) };
    }
    const value = bobAmount(row, m);
    if (value === null || Math.abs(value) < 0.005) return { text: "", empty: true };
    return { text: bobFormat(value), empty: false };
  }

  function select(row: StatementRow, month: number) {
    const cell = year ? row.cells[year]?.[month] : undefined;
    setSelected({ row, month });
    setDraft(cell ? editableText(cell) : "");
    setEditError("");
  }

  const selectedCell = selected && year ? selected.row.cells[year]?.[selected.month] : undefined;
  const selectedEditable = Boolean(
    data?.canEdit && selected && selectedCell && selected.month < 12 && EDITABLE_KINDS.includes(selected.row.kind)
  );

  async function save() {
    if (!selected || !selectedCell || saving) return;
    setSaving(true);
    setEditError("");
    try {
      const res = await fetch("/api/estado-resultados-base", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          row: selected.row.row,
          address: selectedCell.address,
          label: selected.row.label,
          formula: selectedCell.formula,
          value: selectedCell.value,
          input: draft,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || "No se pudo guardar.");
      setNotice(
        `Guardado en el Google Sheet (${selectedCell.address}).${body?.logWarning ? ` ${body.logWarning}` : ""}`
      );
      setSelected(null);
      setReload((n) => n + 1);
    } catch (e) {
      setEditError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function renderCells(row: StatementRow) {
    const cells = year ? row.cells[year] ?? [] : [];
    return cells.map((cell, m) => {
      const isTotal = m === 12;
      const isSelected = selected?.row === row && selected.month === m;
      const shown = display(row, m);
      return (
        <td
          key={m}
          className={cn(
            "cursor-pointer whitespace-nowrap border-b border-slate-200 px-3 py-2.5 text-right text-xs tabular-nums",
            isTotal && "border-l border-slate-200 font-semibold",
            isSelected && "outline outline-2 -outline-offset-2 outline-blue-500"
          )}
          title={cell.formula ? `${cell.address}: ${cell.formula}` : cell.address}
          onClick={() => select(row, m)}
        >
          {shown.empty ? <span className="text-slate-400">—</span> : shown.text}
        </td>
      );
    });
  }

  return (
    <div className="space-y-4 px-3 pb-4 pt-4 md:px-5 md:pt-6 lg:px-6">
      <header className="flex flex-col justify-between gap-2 xl:flex-row xl:items-start">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-blue-600">
            <FileSpreadsheet className="h-4 w-4" />
            Reportes financieros
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Estado de Resultados</h1>
          <p className="mt-1 text-sm text-slate-500">
            Europe Intelligence Solutions · Sucursal Bolivia · Google Sheet del P&amp;L
          </p>
        </div>
        <div className="flex flex-col items-start gap-2 xl:items-end">
          <span className="rounded-full border bg-white px-3 py-1.5 text-xs text-slate-600">
            {loading ? "Cargando…" : data ? (data.canEdit ? "Edición habilitada" : "Solo lectura") : "Sin conexión"}
          </span>
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-xs text-slate-500">
              Ejercicio
              <select
                className="mt-1 block rounded-lg border bg-white px-2 py-2 text-xs text-slate-900"
                value={year ?? ""}
                disabled={!data}
                onChange={(e) => {
                  setYear(Number(e.target.value));
                  setSelected(null);
                }}
              >
                {(data?.years ?? []).map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-slate-500">
              Moneda
              <select
                className="mt-1 block rounded-lg border bg-white px-2 py-2 text-xs text-slate-900"
                value={currency}
                disabled={!data}
                onChange={(e) => setCurrency(e.target.value as Currency)}
              >
                <option value="USD">USD · Sheet original</option>
                <option value="BOB">BOB · Convertido con TC paralelo</option>
              </select>
            </label>
            <button type="button" className={cn(button, "flex items-center gap-1.5")} disabled={loading} onClick={() => setReload((n) => n + 1)}>
              <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
              Actualizar
            </button>
          </div>
        </div>
      </header>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>
      )}

      {data && year && (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-3">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-sm font-bold text-slate-900">P&amp;L / {year}</h2>
              <span className="text-xs text-slate-500">{currency} · {accounts} cuentas</span>
              <div className="flex rounded-full bg-slate-100 p-1 text-xs">
                {(["completo", "totales"] as View[]).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setView(v)}
                    className={cn(
                      "rounded-full px-3 py-1",
                      view === v ? "bg-white font-medium text-blue-700 shadow-sm" : "text-slate-500"
                    )}
                  >
                    {v === "completo" ? "Completo" : "Solo totales"}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className={button} onClick={() => setCollapsed(new Set())}>
                Expandir todo
              </button>
              <button type="button" className={button} onClick={() => setCollapsed(new Set(collapsibleIndexes))}>
                Contraer todo
              </button>
              {searchOpen ? (
                <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2">
                  <Search className="h-4 w-4 text-slate-400" />
                  <input
                    autoFocus
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Buscar cuenta…"
                    aria-label="Buscar cuenta"
                    className="w-44 bg-transparent py-2 text-xs text-slate-900 outline-none"
                  />
                  <button
                    type="button"
                    aria-label="Cerrar búsqueda"
                    onClick={() => {
                      setQuery("");
                      setSearchOpen(false);
                    }}
                  >
                    <X className="h-4 w-4 text-slate-400" />
                  </button>
                </div>
              ) : (
                <button type="button" aria-label="Buscar cuenta" className={button} onClick={() => setSearchOpen(true)}>
                  <Search className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {selected && selectedCell && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b bg-blue-50 px-5 py-2 text-xs text-blue-900">
              <span className="font-semibold">
                {selected.row.label} · {selected.month === 12 ? `TOTAL ${year}` : `${MONTHS[selected.month]}-${yy}`}
              </span>
              <span>Celda {selectedCell.address || "—"}</span>
              <span>Valor: {selectedCell.text || "vacío"}{currency === "BOB" && !isRatio(selected.row, selectedCell) ? " USD" : ""}</span>
              {currency === "BOB" && !isRatio(selected.row, selectedCell) && (
                <span>
                  En Bs: {display(selected.row, selected.month).text || "—"}
                  {selected.month < 12 && rates[selected.month] ? ` (TC ${rates[selected.month]!.toLocaleString("es-BO")})` : ""}
                </span>
              )}
              {selectedEditable && currency === "USD" ? (
                <form
                  className="flex min-w-[280px] flex-1 flex-wrap items-center gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void save();
                  }}
                >
                  <input
                    autoFocus
                    value={draft}
                    disabled={saving}
                    onChange={(e) => setDraft(e.target.value)}
                    aria-label={`Valor o fórmula de ${selectedCell.address}`}
                    placeholder="1234,50 o =30955,62/Q13"
                    className="min-w-[200px] flex-1 rounded-md border border-blue-200 bg-white px-2 py-1.5 font-mono text-[12px] text-slate-900 outline-none focus:border-blue-500"
                  />
                  <button type="submit" disabled={saving} className={cn(button, "py-1.5")}>
                    {saving ? "Guardando…" : "Guardar"}
                  </button>
                  <button type="button" disabled={saving} className={cn(button, "py-1.5")} onClick={() => setSelected(null)}>
                    Cancelar
                  </button>
                </form>
              ) : (
                <>
                  {selectedCell.formula && (
                    <code className="rounded bg-white px-2 py-0.5 font-mono text-[11px] text-slate-700">{selectedCell.formula}</code>
                  )}
                  {selectedEditable && currency === "BOB" && (
                    <span className="text-blue-700">Para editar cambia la moneda a USD (el Sheet guarda USD).</span>
                  )}
                  {data?.canEdit && !selectedEditable && (
                    <span className="text-slate-500">Esta celda la calcula el Sheet.</span>
                  )}
                  <button type="button" className="ml-auto" aria-label="Cerrar detalle" onClick={() => setSelected(null)}>
                    <X className="h-4 w-4" />
                  </button>
                </>
              )}
              {editError && <span className="w-full text-rose-700">{editError}</span>}
            </div>
          )}

          {notice && !selected && (
            <div className="flex items-center justify-between border-b bg-emerald-50 px-5 py-2 text-xs text-emerald-900">
              {notice}
              <button type="button" aria-label="Cerrar aviso" onClick={() => setNotice("")}>
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {currency === "BOB" && (
            <div className="border-b bg-amber-50 px-5 py-2 text-xs text-amber-900">
              Vista en bolivianos: USD del Sheet × TC PARALELO de cada mes; el total anual suma los meses convertidos y los
              porcentajes se recalculan con esos importes. Es solo visual: el Sheet sigue en USD.
              {missingRates.length > 0 && ` Sin TC: ${missingRates.join(", ")} (quedan sin convertir).`}
            </div>
          )}

          <div className="max-h-[calc(100vh-260px)] overflow-auto">
            <table className="w-full border-separate border-spacing-0">
              <thead className="sticky top-0 z-20 bg-white">
                <tr>
                  <th className={cn(firstCell, "z-30 bg-white font-semibold text-slate-600")}>Concepto / Cuenta</th>
                  {MONTHS.map((m, i) => (
                    <th key={m} className="border-b border-slate-200 bg-white px-3 py-2 text-right text-xs font-semibold tracking-wider text-slate-600">
                      <span className="block text-[10px] font-normal tracking-normal text-slate-400">{columnLetters[i]}</span>
                      {m}-{yy}
                    </th>
                  ))}
                  <th className="border-b border-l border-slate-200 bg-white px-3 py-2 text-right text-xs font-semibold text-slate-600">
                    <span className="block text-[10px] font-normal text-slate-400">{columnLetters[12]}</span>
                    TOTAL {year}
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map(({ row, i }) => {
                  const key = `${row.kind}-${row.row}-${i}`;
                  if (row.kind === "section") {
                    sectionCount++;
                    return (
                      <tr key={key}>
                        <th colSpan={14} className="border-b border-slate-200 bg-white px-4 pb-2 pt-5 text-left">
                          <button
                            type="button"
                            onClick={() => toggle(i)}
                            aria-expanded={!collapsed.has(i)}
                            title={collapsed.has(i) ? "Expandir sección" : "Contraer sección"}
                            className={cn(
                              "sticky left-4 inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold",
                              SECTION_TONES[sectionCount % SECTION_TONES.length]
                            )}
                          >
                            {collapsed.has(i) ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                            {row.label}
                          </button>
                        </th>
                      </tr>
                    );
                  }
                  const isGroup = row.kind === "group";
                  const strong = row.kind === "total" || row.kind === "result";
                  return (
                    <tr
                      key={key}
                      className={cn(
                        strong ? "bg-blue-50 font-semibold text-blue-900" : isGroup ? "bg-slate-50 font-semibold text-slate-800" : "hover:bg-blue-50/40",
                        row.kind === "detail" && "text-slate-500",
                        row.kind === "info" && "italic text-slate-500"
                      )}
                    >
                      <th
                        scope="row"
                        className={cn(
                          firstCell,
                          strong ? "bg-blue-50" : isGroup ? "bg-slate-50" : "bg-white font-normal text-slate-600",
                          row.kind === "detail" && "text-[11px]"
                        )}
                        style={{ paddingLeft: 36 + row.level * 16 }}
                        title={`Fila ${row.row} del Sheet`}
                      >
                        <span className="absolute left-2 top-1/2 w-6 -translate-y-1/2 text-right text-[10px] font-normal not-italic tabular-nums text-slate-400">
                          {row.row}
                        </span>
                        {isGroup ? (
                          <button type="button" className="inline-flex items-center gap-1 text-left" onClick={() => toggle(i)} aria-expanded={!collapsed.has(i)}>
                            {collapsed.has(i) ? <ChevronRight className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
                            {row.label}
                          </button>
                        ) : (
                          row.label
                        )}
                      </th>
                      {renderCells(row)}
                    </tr>
                  );
                })}
                {visible.length === 0 && (
                  <tr>
                    <td colSpan={14} className="px-5 py-6 text-center text-xs text-slate-400">
                      No hay cuentas que coincidan con la búsqueda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="border-t border-slate-200 px-5 py-2 text-[11px] text-slate-400">
            Los importes y totales los calcula el Google Sheet. Haz clic en una celda para ver su fórmula.
          </p>
        </section>
      )}
    </div>
  );
}

export default PLBaseView;
