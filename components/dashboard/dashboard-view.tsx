"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { DashboardData, Movement, ProjectedDashboardData, ProjectedMovement } from "@/lib/types";
import { buildDashboard } from "@/lib/aggregations";
import { parseApiDate } from "@/lib/utils";
import { DashboardFilters, DashboardHeader } from "./header";
import { KpiCardsV2 } from "./kpi-cards-v2";
import { MonthlyFlowsChart } from "./monthly-flows-chart";
import { ExpenseDonut } from "./expense-donut";
import { IngresosEgresosBars } from "./ingresos-egresos-bars";
import { SaldoTrendArea } from "./saldo-trend-area";
import { CuentasPorPagar } from "./cuentas-por-pagar";
import { Loader2, AlertTriangle } from "lucide-react";

function rehydrateMovements(raw: any[]): Movement[] {
  return raw.map((m) => ({ ...m, fecha: parseApiDate(m.fecha) }));
}

function rehydrateProjected(raw: any[]): ProjectedMovement[] {
  return raw.map((m) => ({ ...m, fecha: parseApiDate(m.fecha) }));
}

function parseLocalDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

function rateAt(m: Movement): number {
  if (!m.saldo || !m.saldoUsd) return 0;
  return m.saldoUsd / m.saldo;
}

/**
 * Computa el período "anterior" del mismo largo, contiguo y precediendo al actual.
 * Si current = [feb 1, feb 28] (28d), prev = [ene 4, ene 31].
 */
function previousPeriod(from: Date, to: Date): { from: Date; to: Date } {
  const ms = to.getTime() - from.getTime();
  const prevTo = new Date(from.getTime() - 24 * 60 * 60 * 1000);
  prevTo.setHours(23, 59, 59, 999);
  const prevFrom = new Date(prevTo.getTime() - ms);
  prevFrom.setHours(0, 0, 0, 0);
  return { from: prevFrom, to: prevTo };
}

export function DashboardView() {
  const [allMovements, setAllMovements] = useState<Movement[] | null>(null);
  const [allProjected, setAllProjected] = useState<ProjectedMovement[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [filters, setFilters] = useState<DashboardFilters>({
    from: "",
    to: "",
    moneda: "BOB",
  });
  const filtersInitializedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        // Cargar EN PARALELO el dashboard real Y los proyectados (para Cuentas por Pagar)
        const [resReal, resProy] = await Promise.all([
          fetch("/api/dashboard", { cache: "no-store" }),
          fetch("/api/proyectado", { cache: "no-store" }).catch(() => null),
        ]);
        if (!resReal.ok) {
          const body = await resReal.json().catch(() => ({}));
          throw new Error(body.error || `HTTP ${resReal.status}`);
        }
        const json = (await resReal.json()) as DashboardData;
        if (cancelled) return;

        const movs = rehydrateMovements(json.movements);
        setAllMovements(movs);

        // Proyectado es opcional (si no existe la pestaña Flujo, seguimos sin Cuentas por Pagar)
        if (resProy && resProy.ok) {
          const jsonProy = (await resProy.json()) as ProjectedDashboardData;
          setAllProjected(rehydrateProjected(jsonProy.movements));
        } else {
          setAllProjected([]);
        }

        if (!filtersInitializedRef.current) {
          setFilters({
            from: json.meta.fechaInicio ?? "",
            to: json.meta.fechaFin ?? "",
            moneda: "BOB",
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

  // Filtros aplicados → DashboardData
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
    return buildDashboard(movs);
  }, [allMovements, filters]);

  // Movements del período ANTERIOR (mismo largo, antes del actual) para los % vs prev
  const prevKpis = useMemo(() => {
    if (!allMovements || !filters.from || !filters.to) return null;
    const curFrom = parseLocalDate(filters.from);
    const curTo = parseLocalDate(filters.to);
    const { from, to } = previousPeriod(curFrom, curTo);

    const prevMovs = allMovements.filter(
      (m) => m.fecha && m.fecha.getTime() >= from.getTime() && m.fecha.getTime() <= to.getTime()
    );
    if (prevMovs.length === 0) return null;

    const isUsd = filters.moneda === "USD";
    let ingresos = 0;
    let egresos = 0;
    for (const m of prevMovs) {
      if (isUsd) {
        const r = rateAt(m);
        ingresos += m.creditos * r;
        egresos += m.debitos * r;
      } else {
        ingresos += m.creditos;
        egresos += m.debitos;
      }
    }
    const last = prevMovs[prevMovs.length - 1];
    const saldoAcumulado = isUsd ? last?.saldoUsd ?? 0 : last?.saldo ?? 0;

    return { ingresos, egresos, saldoAcumulado };
  }, [allMovements, filters]);

  // KPIs v2 (con comparación vs período anterior)
  const kpisV2 = useMemo(() => {
    if (!filtered) return null;
    const k = filtered.kpis;
    const isUsd = filters.moneda === "USD";

    const ingresosTotales = isUsd ? k.ingresosTotalesUsd : k.ingresosTotales;
    const egresosTotales = isUsd ? k.egresosTotalesUsd : k.egresosTotales;
    const saldoAcumulado = isUsd ? k.saldoFinalUsd : k.saldoFinal;

    // Saldo Disponible = Saldo Acumulado - Total pendientes de pago
    // (movimientos proyectados con egresos > 0, FUTUROS desde hoy)
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const totalPendiente = allProjected
      .filter((p) => p.fecha && p.fecha.getTime() >= now.getTime() && p.egresos > 0)
      .reduce((s, p) => s + (isUsd ? p.debitoUsd : p.egresos), 0);
    const saldoDisponible = saldoAcumulado - totalPendiente;

    return {
      ingresosTotales,
      egresosTotales,
      saldoAcumulado,
      saldoDisponible,
      prevIngresos: prevKpis?.ingresos ?? null,
      prevEgresos: prevKpis?.egresos ?? null,
      prevSaldoAcumulado: prevKpis?.saldoAcumulado ?? null,
    };
  }, [filtered, filters.moneda, prevKpis, allProjected]);

  // Cuentas por Pagar = proyectados con egresos > 0 desde HOY hacia adelante
  const cuentasPorPagar = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return allProjected.filter((p) => p.fecha && p.fecha.getTime() >= now.getTime() && p.egresos > 0);
  }, [allProjected]);

  const { minDate, maxDate } = useMemo(() => {
    if (!allMovements || allMovements.length === 0)
      return { minDate: null, maxDate: null };
    const dates = allMovements
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
      </div>
    );
  }

  if (!filtered || !kpisV2) return null;

  const isEmpty = filtered.movements.length === 0;

  // Saldo inicial del rango (para el área chart de tendencia)
  const saldoInicial =
    filters.moneda === "USD" ? filtered.kpis.saldoInicialUsd : filtered.kpis.saldoInicial;

  return (
    <div className="space-y-5 p-6 lg:p-8">
      <DashboardHeader
        filters={filters}
        onFiltersChange={setFilters}
        minDate={minDate}
        maxDate={maxDate}
        filteredCount={filtered.movements.length}
      />

      <p className="-mt-2 max-w-3xl text-sm text-slate-500">
        Visualiza tus ingresos, egresos y saldo disponible en tiempo real para tomar mejores
        decisiones financieras.
      </p>

      {isEmpty ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-8 text-center text-amber-900">
          <p className="font-semibold">Sin movimientos en el período seleccionado</p>
          <p className="mt-1 text-sm">Ajusta el rango de fechas para ver datos.</p>
        </div>
      ) : (
        <>
          {/* ── ROW 1: 4 KPI cards ── */}
          <KpiCardsV2 kpis={kpisV2} moneda={filters.moneda} />

          {/* ── ROW 2: Flujo Mensual (2/3) + Donut Gastos (1/3) ── */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <MonthlyFlowsChart data={filtered.monthlyFlows} moneda={filters.moneda} />
            </div>
            <div className="lg:col-span-1">
              <ExpenseDonut categories={filtered.categories} moneda={filters.moneda} />
            </div>
          </div>

          {/* ── ROW 3: Comparativo + Tendencia + Cuentas por Pagar ── */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            <IngresosEgresosBars data={filtered.monthlyFlows} moneda={filters.moneda} />
            <SaldoTrendArea
              monthlyFlows={filtered.monthlyFlows}
              saldoInicial={saldoInicial}
              moneda={filters.moneda}
            />
            <CuentasPorPagar movements={cuentasPorPagar} moneda={filters.moneda} />
          </div>
        </>
      )}
    </div>
  );
}
