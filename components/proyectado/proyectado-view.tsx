"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, AlertTriangle } from "lucide-react";
import { ProjectedDashboardData, ProjectedMovement } from "@/lib/types";
import { parseApiDate } from "@/lib/utils";
import { ProyectadoFilters, type ProjectedFilters } from "./proyectado-filters";
import { ProyectadoTable } from "./proyectado-table";
import { ProyectadoSummary } from "./proyectado-summary";

function rehydrate(raw: any[]): ProjectedMovement[] {
  return raw.map((m) => ({ ...m, fecha: parseApiDate(m.fecha) }));
}

function parseLocalDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

const EMPTY_FILTERS: ProjectedFilters = {
  search: "",
  from: "",
  to: "",
  status: "all",
  centroCosto: "all",
  edificio: "all",
};

export function ProyectadoView() {
  const [data, setData] = useState<ProjectedDashboardData | null>(null);
  const [movements, setMovements] = useState<ProjectedMovement[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<ProjectedFilters>(EMPTY_FILTERS);
  const filtersInitializedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        const res = await fetch("/api/proyectado", { cache: "no-store" });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `HTTP ${res.status}`);
        }
        const json = (await res.json()) as ProjectedDashboardData;
        if (cancelled) return;
        const movs = rehydrate(json.movements);
        setData(json);
        setMovements(movs);
        if (!filtersInitializedRef.current) {
          setFilters({
            ...EMPTY_FILTERS,
            from: json.summary.fechaInicio ?? "",
            to: json.summary.fechaFin ?? "",
          });
          filtersInitializedRef.current = true;
        }
        setError(null);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Aplica filtros al conjunto completo
  const filteredMovements = useMemo(() => {
    let movs = movements;
    if (filters.search.trim()) {
      const q = filters.search.toLowerCase().trim();
      movs = movs.filter(
        (m) =>
          m.concepto.toLowerCase().includes(q) ||
          m.centroCosto.toLowerCase().includes(q) ||
          m.edificio.toLowerCase().includes(q)
      );
    }
    if (filters.from) {
      const from = parseLocalDate(filters.from);
      movs = movs.filter((m) => m.fecha && m.fecha.getTime() >= from.getTime());
    }
    if (filters.to) {
      const to = parseLocalDate(filters.to);
      to.setHours(23, 59, 59, 999);
      movs = movs.filter((m) => m.fecha && m.fecha.getTime() <= to.getTime());
    }
    if (filters.status !== "all") {
      movs = movs.filter((m) => m.status === filters.status);
    }
    if (filters.centroCosto !== "all") {
      movs = movs.filter((m) => m.centroCosto === filters.centroCosto);
    }
    if (filters.edificio !== "all") {
      movs = movs.filter((m) => m.edificio === filters.edificio);
    }
    return movs;
  }, [movements, filters]);

  // Min/max de fechas para inputs
  const { minDate, maxDate } = useMemo(() => {
    if (movements.length === 0) return { minDate: null, maxDate: null };
    const dates = movements
      .map((m) => m.fecha)
      .filter((d): d is Date => d !== null)
      .sort((a, b) => a.getTime() - b.getTime());
    const fmt = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
        d.getDate()
      ).padStart(2, "0")}`;
    return {
      minDate: dates[0] ? fmt(dates[0]) : null,
      maxDate: dates[dates.length - 1] ? fmt(dates[dates.length - 1]) : null,
    };
  }, [movements]);

  if (loading && !data) {
    return (
      <div className="flex h-[60vh] items-center justify-center text-slate-500">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Cargando flujo proyectado…
      </div>
    );
  }

  if (error) {
    return (
      <div className="m-8 rounded-xl border border-rose-200 bg-rose-50 p-6 text-rose-800">
        <div className="flex items-center gap-2 font-semibold">
          <AlertTriangle className="h-5 w-5" />
          No se pudo cargar el flujo proyectado
        </div>
        <pre className="mt-3 whitespace-pre-wrap text-sm">{error}</pre>
        <p className="mt-3 text-sm">
          Verifica que la pestaña <code className="rounded bg-white px-1 py-0.5">Flujo</code>{" "}
          exista en tu Google Sheet y que{" "}
          <code className="rounded bg-white px-1 py-0.5">PROYECTADO_RANGE</code> apunte a
          ella.
        </p>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-5 p-6 lg:p-8">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
          FLUJO DE CAJA PROYECTADO
        </h1>
        <p className="mt-1 text-sm font-semibold uppercase tracking-wider text-blue-700">
          Pagos pendientes & confirmados
        </p>
        <p className="mt-1 text-xs text-slate-500">
          {filteredMovements.length.toLocaleString("es-PE")} de{" "}
          {movements.length.toLocaleString("es-PE")} pagos proyectados
        </p>
      </div>

      <ProyectadoFilters
        filters={filters}
        onFiltersChange={setFilters}
        minDate={minDate}
        maxDate={maxDate}
        statuses={data.meta.statuses}
        centrosCosto={data.meta.centrosCosto}
        edificios={data.meta.edificios}
        onClear={() =>
          setFilters({
            ...EMPTY_FILTERS,
            from: minDate ?? "",
            to: maxDate ?? "",
          })
        }
      />

      <ProyectadoSummary movements={filteredMovements} />

      <ProyectadoTable movements={filteredMovements} />
    </div>
  );
}
