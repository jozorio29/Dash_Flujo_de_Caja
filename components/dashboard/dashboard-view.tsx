"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { DashboardData, Movement } from "@/lib/types";
import { buildDashboard } from "@/lib/aggregations";
import { DashboardFilters, DashboardHeader } from "./header";
import { KpiCards } from "./kpi-cards";
import { DailyBalanceChart } from "./daily-balance-chart";
import { MonthlyFlowsChart } from "./monthly-flows-chart";
import { NetFlowChart } from "./net-flow-chart";
import { CategoryTable } from "./category-table";
import { InsightsPanel } from "./insights-panel";
import { Loader2, AlertTriangle } from "lucide-react";

/**
 * El JSON serializa Date como string. Necesitamos rehidratar `fecha` a Date
 * para que las agregaciones por mes/día funcionen client-side.
 */
function rehydrateMovements(raw: any[]): Movement[] {
  return raw.map((m) => ({
    ...m,
    fecha: m.fecha ? new Date(m.fecha) : null,
  }));
}

/**
 * Parsea "yyyy-mm-dd" como medianoche en HORA LOCAL.
 * `new Date("yyyy-mm-dd")` lo interpreta como UTC, lo que rompe los filtros
 * en zonas horarias negativas (ej: en Lima excluye el día seleccionado).
 */
function parseLocalDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

export function DashboardView() {
  const [allMovements, setAllMovements] = useState<Movement[] | null>(null);
  const [allCuentas, setAllCuentas] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [filters, setFilters] = useState<DashboardFilters>({
    from: "",
    to: "",
    cuenta: "all",
  });
  const filtersInitializedRef = useRef(false);

  // Carga única al montar. Para ver datos nuevos del sheet, recargar la página.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        const res = await fetch("/api/dashboard", { cache: "no-store" });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `HTTP ${res.status}`);
        }
        const json = (await res.json()) as DashboardData;
        if (cancelled) return;
        const movs = rehydrateMovements(json.movements);
        setAllMovements(movs);
        setAllCuentas(json.meta.cuentas);
        if (!filtersInitializedRef.current) {
          setFilters({
            from: json.meta.fechaInicio ?? "",
            to: json.meta.fechaFin ?? "",
            cuenta: "all",
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

  // Aplica filtros y reconstruye el dashboard
  const filtered: DashboardData | null = useMemo(() => {
    if (!allMovements) return null;
    let movs = allMovements;
    if (filters.from) {
      const from = parseLocalDate(filters.from);
      movs = movs.filter((m) => m.fecha && m.fecha.getTime() >= from.getTime());
    }
    if (filters.to) {
      const to = parseLocalDate(filters.to);
      to.setHours(23, 59, 59, 999);
      movs = movs.filter((m) => m.fecha && m.fecha.getTime() <= to.getTime());
    }
    if (filters.cuenta !== "all") {
      movs = movs.filter((m) => m.oficina === filters.cuenta);
    }
    return buildDashboard(movs);
  }, [allMovements, filters]);

  // Min/max de fechas disponibles para el date picker
  const { minDate, maxDate } = useMemo(() => {
    if (!allMovements || allMovements.length === 0)
      return { minDate: null, maxDate: null };
    const dates = allMovements
      .map((m) => m.fecha)
      .filter((d): d is Date => d !== null)
      .sort((a, b) => a.getTime() - b.getTime());
    const first = dates[0];
    const last = dates[dates.length - 1];
    const fmt = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
        d.getDate()
      ).padStart(2, "0")}`;
    return {
      minDate: first ? fmt(first) : null,
      maxDate: last ? fmt(last) : null,
    };
  }, [allMovements]);

  if (loading && !allMovements) {
    return (
      <div className="flex h-[60vh] items-center justify-center text-slate-500">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Cargando datos del Google Sheet…
      </div>
    );
  }

  if (error) {
    return (
      <div className="m-8 rounded-xl border border-rose-200 bg-rose-50 p-6 text-rose-800">
        <div className="flex items-center gap-2 font-semibold">
          <AlertTriangle className="h-5 w-5" />
          No se pudieron cargar los datos
        </div>
        <pre className="mt-3 whitespace-pre-wrap text-sm">{error}</pre>
        <p className="mt-3 text-sm">
          Verifica que <code className="rounded bg-white px-1.5 py-0.5">GOOGLE_SHEETS_API_KEY</code>{" "}
          y <code className="rounded bg-white px-1.5 py-0.5">GOOGLE_SHEETS_SPREADSHEET_ID</code>{" "}
          estén configurados en{" "}
          <code className="rounded bg-white px-1.5 py-0.5">.env.local</code> y que el sheet esté
          compartido como <em>Cualquiera con el enlace</em>.
        </p>
      </div>
    );
  }

  if (!filtered) return null;

  const isEmpty = filtered.movements.length === 0;

  return (
    <div className="space-y-5 p-6 lg:p-8">
      <DashboardHeader
        filters={filters}
        onFiltersChange={setFilters}
        minDate={minDate}
        maxDate={maxDate}
        cuentas={allCuentas}
        filteredCount={filtered.movements.length}
      />

      {isEmpty ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-8 text-center text-amber-900">
          <p className="font-semibold">Sin movimientos en el período seleccionado</p>
          <p className="mt-1 text-sm">
            Ajusta el rango de fechas o cambia el filtro de cuenta para ver datos.
          </p>
        </div>
      ) : (
        <>
          <KpiCards kpis={filtered.kpis} />
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
            <DailyBalanceChart data={filtered.dailyBalances} />
            <MonthlyFlowsChart data={filtered.monthlyFlows} />
            <NetFlowChart data={filtered.monthlyFlows} />
          </div>
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-4">
            <div className="xl:col-span-3">
              <CategoryTable categories={filtered.categories} />
            </div>
            <div className="xl:col-span-1">
              <InsightsPanel insights={filtered.insights} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
