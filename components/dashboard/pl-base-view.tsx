"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, FileSpreadsheet, RefreshCw, Search, X } from "lucide-react";
import type { Statement, StatementCell, StatementRow } from "@/lib/pl-base-sheet";
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

/** Grupos que contienen cada fila (para búsqueda y para contraer). */
function ancestorsOf(rows: StatementRow[]): Map<number, number[]> {
  const result = new Map<number, number[]>();
  const stack: StatementRow[] = [];
  rows.forEach((row, i) => {
    if (row.kind === "section" || row.kind === "total" || row.kind === "result") {
      stack.length = 0;
      result.set(i, []);
      return;
    }
    while (stack.length && stack[stack.length - 1].level >= row.level) stack.pop();
    result.set(i, stack.map((g) => rows.indexOf(g)));
    if (row.kind === "group") stack.push(row);
  });
  return result;
}

export function PLBaseView() {
  const [data, setData] = useState<Statement | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState<number | null>(null);
  const [view, setView] = useState<View>("completo");
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [selected, setSelected] = useState<{ row: StatementRow; month: number } | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    fetch("/api/estado-resultados-base", { signal: controller.signal, cache: "no-store" })
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body?.error || "No se pudo cargar el P&L.");
        const statement = body as Statement;
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
  const groupIndexes = useMemo(
    () => rows.map((r, i) => (r.kind === "group" ? i : -1)).filter((i) => i >= 0),
    [rows]
  );
  const accounts = rows.filter((r) => r.kind === "account").length;

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

  function toggle(i: number) {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  function renderCells(row: StatementRow) {
    const cells = year ? row.cells[year] ?? [] : [];
    return cells.map((cell, m) => {
      const isTotal = m === 12;
      const isSelected = selected?.row === row && selected.month === m;
      return (
        <td
          key={m}
          className={cn(
            "cursor-pointer whitespace-nowrap border-b border-slate-200 px-3 py-2.5 text-right text-xs tabular-nums",
            isTotal && "border-l border-slate-200 font-semibold",
            isSelected && "outline outline-2 -outline-offset-2 outline-blue-500"
          )}
          title={cell.formula ? `${cell.address}: ${cell.formula}` : cell.address}
          onClick={() => setSelected({ row, month: m })}
        >
          {isEmpty(cell) ? <span className="text-slate-400">—</span> : cell.text}
        </td>
      );
    });
  }

  const selectedCell = selected && year ? selected.row.cells[year]?.[selected.month] : undefined;

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
            {loading ? "Cargando…" : data ? "Solo lectura" : "Sin conexión"}
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
              <span className="text-xs text-slate-500">USD · {accounts} cuentas</span>
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
              <button type="button" className={button} onClick={() => setCollapsed(new Set(groupIndexes))}>
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
              <span>Valor: {selectedCell.text || "vacío"}</span>
              {selectedCell.formula && (
                <code className="rounded bg-white px-2 py-0.5 font-mono text-[11px] text-slate-700">{selectedCell.formula}</code>
              )}
              <button type="button" className="ml-auto" aria-label="Cerrar detalle" onClick={() => setSelected(null)}>
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          <div className="max-h-[calc(100vh-260px)] overflow-auto">
            <table className="w-full border-separate border-spacing-0">
              <thead className="sticky top-0 z-20 bg-white">
                <tr>
                  <th className={cn(firstCell, "z-30 bg-white font-semibold text-slate-600")}>Concepto / Cuenta</th>
                  {MONTHS.map((m) => (
                    <th key={m} className="border-b border-slate-200 bg-white px-3 py-2.5 text-right text-xs font-semibold tracking-wider text-slate-600">
                      {m}-{yy}
                    </th>
                  ))}
                  <th className="border-b border-l border-slate-200 bg-white px-3 py-2.5 text-right text-xs font-semibold text-slate-600">
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
                          <span className={cn("rounded-full px-3 py-1.5 text-xs font-semibold", SECTION_TONES[sectionCount % SECTION_TONES.length])}>
                            {row.label}
                          </span>
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
                        style={{ paddingLeft: 16 + row.level * 16 }}
                        title={`Fila ${row.row} del Sheet`}
                      >
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
