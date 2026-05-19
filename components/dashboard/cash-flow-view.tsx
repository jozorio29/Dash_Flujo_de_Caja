"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, AlertTriangle } from "lucide-react";
import { DashboardData, Movement } from "@/lib/types";
import { DashboardFilters, DashboardHeader } from "./header";
import { CashFlowStatement, type CashFlowLine } from "./cash-flow-statement";
import { CashFlowWaterfall, type WaterfallStep } from "./cash-flow-waterfall";

function rehydrate(raw: any[]): Movement[] {
  return raw.map((m) => ({ ...m, fecha: m.fecha ? new Date(m.fecha) : null }));
}

function parseLocalDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

/** Top N + "Otros" (para mantener el waterfall legible) */
const MAX_CATEGORIES_PER_SIDE = 5;

interface CashFlowComputed {
  saldoInicial: number;
  saldoFinal: number;
  totalIngresos: number;
  totalEgresos: number;
  ingresosLines: CashFlowLine[];
  egresosLines: CashFlowLine[];
  waterfallSteps: WaterfallStep[];
  fechaInicio: string | null;
  fechaFin: string | null;
}

function buildCashFlow(movements: Movement[]): CashFlowComputed {
  const valid = movements.filter((m) => m.fecha !== null);

  if (valid.length === 0) {
    return {
      saldoInicial: 0,
      saldoFinal: 0,
      totalIngresos: 0,
      totalEgresos: 0,
      ingresosLines: [],
      egresosLines: [],
      waterfallSteps: [],
      fechaInicio: null,
      fechaFin: null,
    };
  }

  const first = valid[0];
  const last = valid[valid.length - 1];

  // Saldo previo al primer movimiento del rango
  const saldoInicial = first.saldo - first.monto;
  const saldoFinal = last.saldo;

  // Agrupar por categoría
  const ingByCat = new Map<string, number>();
  const egrByCat = new Map<string, number>();
  let totalIng = 0;
  let totalEgr = 0;

  for (const m of valid) {
    if (m.creditos > 0) {
      const cat = m.categoria || "Otros ingresos";
      ingByCat.set(cat, (ingByCat.get(cat) ?? 0) + m.creditos);
      totalIng += m.creditos;
    }
    if (m.debitos > 0) {
      const cat = m.categoria || "Otros egresos";
      egrByCat.set(cat, (egrByCat.get(cat) ?? 0) + m.debitos);
      totalEgr += m.debitos;
    }
  }

  const ingresosArr = Array.from(ingByCat.entries())
    .map(([categoria, monto]) => ({
      categoria,
      monto,
      porcentaje: totalIng === 0 ? 0 : monto / totalIng,
    }))
    .sort((a, b) => b.monto - a.monto);

  const egresosArr = Array.from(egrByCat.entries())
    .map(([categoria, monto]) => ({
      categoria,
      monto,
      porcentaje: totalEgr === 0 ? 0 : monto / totalEgr,
    }))
    .sort((a, b) => b.monto - a.monto);

  // Para la tabla mostramos TODAS las categorías
  const ingresosLines = ingresosArr;
  const egresosLines = egresosArr;

  // Para el waterfall: top N + "Otros"
  function topPlusOtros(arr: CashFlowLine[]): CashFlowLine[] {
    if (arr.length <= MAX_CATEGORIES_PER_SIDE + 1) return arr;
    const top = arr.slice(0, MAX_CATEGORIES_PER_SIDE);
    const rest = arr.slice(MAX_CATEGORIES_PER_SIDE);
    const restMonto = rest.reduce((s, x) => s + x.monto, 0);
    const restPct = rest.reduce((s, x) => s + x.porcentaje, 0);
    return [
      ...top,
      { categoria: "Otros", monto: restMonto, porcentaje: restPct },
    ];
  }

  const ingTop = topPlusOtros(ingresosArr);
  const egrTop = topPlusOtros(egresosArr);

  // Construir steps acumulados
  const steps: WaterfallStep[] = [];
  let cum = saldoInicial;
  steps.push({ name: "Saldo Inicial", type: "start", value: saldoInicial, cumulative: cum });

  for (const line of ingTop) {
    cum += line.monto;
    steps.push({
      name: line.categoria,
      type: "ingreso",
      value: line.monto,
      cumulative: cum,
    });
  }
  for (const line of egrTop) {
    cum -= line.monto;
    steps.push({
      name: line.categoria,
      type: "egreso",
      value: line.monto,
      cumulative: cum,
    });
  }
  steps.push({ name: "Saldo Final", type: "end", value: saldoFinal, cumulative: saldoFinal });

  return {
    saldoInicial,
    saldoFinal,
    totalIngresos: totalIng,
    totalEgresos: totalEgr,
    ingresosLines,
    egresosLines,
    waterfallSteps: steps,
    fechaInicio: first.fecha?.toISOString().slice(0, 10) ?? null,
    fechaFin: last.fecha?.toISOString().slice(0, 10) ?? null,
  };
}

export function CashFlowView() {
  const [allMovements, setAllMovements] = useState<Movement[] | null>(null);
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
        const res = await fetch("/api/dashboard", { cache: "no-store" });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `HTTP ${res.status}`);
        }
        const json = (await res.json()) as DashboardData;
        if (cancelled) return;
        const movs = rehydrate(json.movements);
        setAllMovements(movs);
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

  // Aplica los mismos filtros que el Resumen
  const filteredMovements = useMemo(() => {
    if (!allMovements) return [];
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
    return movs;
  }, [allMovements, filters]);

  const cf = useMemo(() => buildCashFlow(filteredMovements), [filteredMovements]);

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

  if (!allMovements) return null;

  const isEmpty = filteredMovements.length === 0;

  return (
    <div className="space-y-5 p-6 lg:p-8">
      <DashboardHeader
        filters={filters}
        onFiltersChange={setFilters}
        minDate={minDate}
        maxDate={maxDate}
        filteredCount={filteredMovements.length}
      />

      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">
          Estado de Flujo de Efectivo
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Muestra cómo se transformó el saldo en el período: saldo inicial + entradas
          − salidas = saldo final, agrupado por categoría P&L.
        </p>
      </div>

      {isEmpty ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-8 text-center text-amber-900">
          <p className="font-semibold">Sin movimientos en el período seleccionado</p>
          <p className="mt-1 text-sm">
            Ajusta el rango de fechas o cambia el filtro de cuenta.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-5">
          <div className="xl:col-span-2">
            <CashFlowStatement
              fechaInicio={cf.fechaInicio}
              fechaFin={cf.fechaFin}
              saldoInicial={cf.saldoInicial}
              saldoFinal={cf.saldoFinal}
              ingresos={cf.ingresosLines}
              egresos={cf.egresosLines}
              totalIngresos={cf.totalIngresos}
              totalEgresos={cf.totalEgresos}
            />
          </div>
          <div className="xl:col-span-3">
            <CashFlowWaterfall steps={cf.waterfallSteps} />
          </div>
        </div>
      )}
    </div>
  );
}
