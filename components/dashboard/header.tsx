"use client";

import { Calendar, ChevronDown, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface DashboardFilters {
  from: string; // yyyy-mm-dd o ""
  to: string;
  cuenta: string; // "all" o nombre de oficina
}

interface Props {
  filters: DashboardFilters;
  onFiltersChange: (next: DashboardFilters) => void;
  /** Min/max disponibles en la data (para el input date) */
  minDate?: string | null;
  maxDate?: string | null;
  cuentas: string[];
  /** Conteo de movimientos en el rango filtrado actual */
  filteredCount?: number;
}

const PRESETS: { id: string; label: string }[] = [
  { id: "all", label: "Todo" },
  { id: "ytd", label: "YTD" },
  { id: "mtd", label: "Este mes" },
  { id: "last30", label: "Últimos 30d" },
  { id: "lastMonth", label: "Mes anterior" },
];

function isoDay(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function computePreset(
  preset: string,
  minDate: string | null | undefined,
  maxDate: string | null | undefined
): { from: string; to: string } {
  const today = new Date();
  switch (preset) {
    case "all":
      return { from: minDate ?? "", to: maxDate ?? "" };
    case "ytd":
      return { from: `${today.getFullYear()}-01-01`, to: maxDate ?? isoDay(today) };
    case "mtd": {
      const first = new Date(today.getFullYear(), today.getMonth(), 1);
      return { from: isoDay(first), to: maxDate ?? isoDay(today) };
    }
    case "last30": {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      return { from: isoDay(d), to: maxDate ?? isoDay(today) };
    }
    case "lastMonth": {
      const first = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const last = new Date(today.getFullYear(), today.getMonth(), 0);
      return { from: isoDay(first), to: isoDay(last) };
    }
    default:
      return { from: minDate ?? "", to: maxDate ?? "" };
  }
}

function formatDisplay(s: string) {
  if (!s) return "—";
  const [y, m, d] = s.split("-");
  return `${d}/${m}/${y}`;
}

export function DashboardHeader({
  filters,
  onFiltersChange,
  minDate,
  maxDate,
  cuentas,
  filteredCount,
}: Props) {
  const [openCuenta, setOpenCuenta] = useState(false);
  const cuentaRef = useRef<HTMLDivElement>(null);

  // Cerrar dropdown al click fuera
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (cuentaRef.current && !cuentaRef.current.contains(e.target as Node)) {
        setOpenCuenta(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const isAllPeriod =
    (!filters.from || filters.from === minDate) &&
    (!filters.to || filters.to === maxDate);

  const cuentaLabel =
    filters.cuenta === "all"
      ? `Todas${cuentas.length > 0 ? ` (${cuentas.length})` : ""}`
      : filters.cuenta;

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
            FLUJO DE CAJA
          </h1>
          <p className="mt-1 text-sm font-semibold uppercase tracking-wider text-blue-700">
            Análisis Financiero
          </p>
          {typeof filteredCount === "number" && (
            <p className="mt-1 text-xs text-slate-500">
              {filteredCount.toLocaleString("es-PE")} movimientos en el período seleccionado
            </p>
          )}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          {/* Período */}
          <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Período del análisis
            </div>
            <div className="mt-1 flex items-center gap-2">
              <Calendar className="h-3.5 w-3.5 shrink-0 text-slate-500" />
              <input
                type="date"
                value={filters.from || ""}
                min={minDate ?? undefined}
                max={filters.to || maxDate || undefined}
                onChange={(e) =>
                  onFiltersChange({ ...filters, from: e.target.value })
                }
                className="w-[125px] cursor-pointer bg-transparent text-sm font-medium tabular-nums text-slate-800 outline-none focus:text-blue-700"
                aria-label="Fecha desde"
              />
              <span className="text-slate-400">—</span>
              <input
                type="date"
                value={filters.to || ""}
                min={filters.from || minDate || undefined}
                max={maxDate ?? undefined}
                onChange={(e) =>
                  onFiltersChange({ ...filters, to: e.target.value })
                }
                className="w-[125px] cursor-pointer bg-transparent text-sm font-medium tabular-nums text-slate-800 outline-none focus:text-blue-700"
                aria-label="Fecha hasta"
              />
            </div>
            <div className="mt-1 text-[10px] text-slate-400">
              {formatDisplay(filters.from)} → {formatDisplay(filters.to)}
            </div>
          </div>

          {/* Cuenta */}
          <div className="relative" ref={cuentaRef}>
            <button
              type="button"
              onClick={() => setOpenCuenta((v) => !v)}
              className="flex w-full min-w-[160px] flex-col items-start rounded-lg border border-slate-200 bg-white px-3 py-2 text-left shadow-sm hover:bg-slate-50"
            >
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Cuenta
              </span>
              <span className="mt-1 flex w-full items-center justify-between gap-2 text-sm font-medium text-slate-800">
                <span className="truncate">{cuentaLabel}</span>
                <ChevronDown
                  className={cn(
                    "h-3.5 w-3.5 shrink-0 text-slate-500 transition-transform",
                    openCuenta && "rotate-180"
                  )}
                />
              </span>
            </button>
            {openCuenta && (
              <div className="absolute right-0 z-20 mt-1 w-full min-w-[200px] overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                <button
                  className={cn(
                    "flex w-full items-center justify-between px-3 py-1.5 text-left text-sm hover:bg-slate-50",
                    filters.cuenta === "all" && "bg-blue-50 font-semibold text-blue-700"
                  )}
                  onClick={() => {
                    onFiltersChange({ ...filters, cuenta: "all" });
                    setOpenCuenta(false);
                  }}
                >
                  <span>Todas</span>
                  <span className="text-xs text-slate-400">{cuentas.length}</span>
                </button>
                {cuentas.map((c) => (
                  <button
                    key={c}
                    className={cn(
                      "block w-full px-3 py-1.5 text-left text-sm hover:bg-slate-50",
                      filters.cuenta === c && "bg-blue-50 font-semibold text-blue-700"
                    )}
                    onClick={() => {
                      onFiltersChange({ ...filters, cuenta: c });
                      setOpenCuenta(false);
                    }}
                  >
                    {c}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Presets + reset */}
      <div className="flex flex-wrap items-center gap-2">
        {PRESETS.map((p) => {
          const range = computePreset(p.id, minDate, maxDate);
          const active =
            filters.from === range.from && filters.to === range.to && (p.id !== "all" || isAllPeriod);
          return (
            <button
              key={p.id}
              onClick={() => onFiltersChange({ ...filters, from: range.from, to: range.to })}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                active
                  ? "border-blue-600 bg-blue-600 text-white shadow-sm"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
              )}
            >
              {p.label}
            </button>
          );
        })}
        {(filters.cuenta !== "all" || !isAllPeriod) && (
          <button
            onClick={() =>
              onFiltersChange({
                from: minDate ?? "",
                to: maxDate ?? "",
                cuenta: "all",
              })
            }
            className="ml-1 inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-500 hover:bg-slate-50"
          >
            <RotateCcw className="h-3 w-3" />
            Limpiar filtros
          </button>
        )}
      </div>
    </div>
  );
}
