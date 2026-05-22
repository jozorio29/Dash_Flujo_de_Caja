"use client";

import { Calendar, RotateCcw, Coins } from "lucide-react";
import { cn } from "@/lib/utils";

export type Moneda = "BOB" | "USD";

export interface DashboardFilters {
  from: string; // yyyy-mm-dd o ""
  to: string;
  moneda: Moneda;
}

interface Props {
  filters: DashboardFilters;
  onFiltersChange: (next: DashboardFilters) => void;
  /** Min/max disponibles en la data (para el input date) */
  minDate?: string | null;
  maxDate?: string | null;
  /** Conteo de movimientos en el rango filtrado actual */
  filteredCount?: number;
}

const PRESETS: { id: string; label: string }[] = [
  { id: "all", label: "Todo" },
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
  filteredCount,
}: Props) {
  const isAllPeriod =
    (!filters.from || filters.from === minDate) &&
    (!filters.to || filters.to === maxDate);

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

          {/* Moneda — toggle BOB / USD */}
          <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
            <div className="flex items-center gap-1.5">
              <Coins className="h-3 w-3 text-slate-500" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Moneda
              </span>
            </div>
            <div className="mt-1 inline-flex rounded-md bg-slate-100 p-0.5">
              <button
                onClick={() => onFiltersChange({ ...filters, moneda: "BOB" })}
                className={cn(
                  "rounded px-3 py-1 text-xs font-semibold tabular-nums transition-colors",
                  filters.moneda === "BOB"
                    ? "bg-white text-blue-700 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                )}
              >
                Bs
              </button>
              <button
                onClick={() => onFiltersChange({ ...filters, moneda: "USD" })}
                className={cn(
                  "rounded px-3 py-1 text-xs font-semibold tabular-nums transition-colors",
                  filters.moneda === "USD"
                    ? "bg-white text-emerald-700 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                )}
              >
                USD
              </button>
            </div>
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
        {!isAllPeriod && (
          <button
            onClick={() =>
              onFiltersChange({
                ...filters,
                from: minDate ?? "",
                to: maxDate ?? "",
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
