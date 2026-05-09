"use client";

import { Search, Calendar, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ProjectedFilters {
  search: string;
  from: string;
  to: string;
  status: string;
  centroCosto: string;
  edificio: string;
}

interface Props {
  filters: ProjectedFilters;
  onFiltersChange: (next: ProjectedFilters) => void;
  minDate?: string | null;
  maxDate?: string | null;
  statuses: string[];
  centrosCosto: string[];
  edificios: string[];
  onClear: () => void;
}

function Select({
  label,
  value,
  options,
  onChange,
  width = "min-w-[140px]",
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
  width?: string;
}) {
  return (
    <div className={cn("flex flex-col rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm", width)}>
      <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-0.5 cursor-pointer bg-transparent text-sm font-medium text-slate-800 outline-none"
      >
        <option value="all">Todos ({options.length})</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}

export function ProjectedFiltersBar({
  filters,
  onFiltersChange,
  minDate,
  maxDate,
  statuses,
  centrosCosto,
  edificios,
  onClear,
}: Props) {
  const hasActiveFilters =
    filters.search.trim() !== "" ||
    filters.status !== "all" ||
    filters.centroCosto !== "all" ||
    filters.edificio !== "all" ||
    (filters.from && filters.from !== minDate) ||
    (filters.to && filters.to !== maxDate);

  return (
    <div className="flex flex-wrap items-end gap-3">
      {/* Búsqueda */}
      <div className="flex flex-1 min-w-[260px] flex-col rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
        <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          Buscar concepto
        </label>
        <div className="mt-0.5 flex items-center gap-2">
          <Search className="h-3.5 w-3.5 shrink-0 text-slate-400" />
          <input
            type="text"
            value={filters.search}
            onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
            placeholder="Alquiler, salarios, impuestos…"
            className="w-full bg-transparent text-sm font-medium text-slate-800 outline-none placeholder:text-slate-400"
          />
        </div>
      </div>

      {/* Período */}
      <div className="flex flex-col rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
        <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          Período
        </label>
        <div className="mt-0.5 flex items-center gap-2">
          <Calendar className="h-3.5 w-3.5 shrink-0 text-slate-500" />
          <input
            type="date"
            value={filters.from}
            min={minDate ?? undefined}
            max={filters.to || maxDate || undefined}
            onChange={(e) => onFiltersChange({ ...filters, from: e.target.value })}
            className="w-[125px] cursor-pointer bg-transparent text-sm tabular-nums text-slate-800 outline-none"
          />
          <span className="text-slate-400">—</span>
          <input
            type="date"
            value={filters.to}
            min={filters.from || minDate || undefined}
            max={maxDate ?? undefined}
            onChange={(e) => onFiltersChange({ ...filters, to: e.target.value })}
            className="w-[125px] cursor-pointer bg-transparent text-sm tabular-nums text-slate-800 outline-none"
          />
        </div>
      </div>

      {/* Selects */}
      <Select
        label="Status"
        value={filters.status}
        options={statuses}
        onChange={(v) => onFiltersChange({ ...filters, status: v })}
      />
      <Select
        label="Centro de Costo"
        value={filters.centroCosto}
        options={centrosCosto}
        onChange={(v) => onFiltersChange({ ...filters, centroCosto: v })}
        width="min-w-[180px]"
      />
      <Select
        label="Edificio"
        value={filters.edificio}
        options={edificios}
        onChange={(v) => onFiltersChange({ ...filters, edificio: v })}
        width="min-w-[160px]"
      />

      {hasActiveFilters && (
        <button
          onClick={onClear}
          className="inline-flex h-[58px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 shadow-sm hover:bg-slate-50"
        >
          <RotateCcw className="h-3 w-3" />
          Limpiar
        </button>
      )}
    </div>
  );
}
