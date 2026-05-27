"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, AlertTriangle } from "lucide-react";
import { DashboardData, Movement } from "@/lib/types";
import { monthKey, parseApiDate } from "@/lib/utils";
import { DashboardFilters, DashboardHeader } from "./header";
import { MonthlyMatrixTable, type MatrixData, type MatrixRow } from "./monthly-matrix-table";

function rehydrate(raw: any[]): Movement[] {
  return raw.map((m) => ({ ...m, fecha: parseApiDate(m.fecha) }));
}

function parseLocalDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

/** Tipo de cambio del row: USD por Bs en ese momento (0 si no calculable). */
function rateAt(m: Movement): number {
  if (!m.saldo || !m.saldoUsd) return 0;
  return m.saldoUsd / m.saldo;
}

/**
 * Construye la matriz Categoría × Mes a partir de los movimientos filtrados.
 * Si `moneda === "USD"`, convierte cada movimiento usando el rate al momento
 * de la fila (saldoUsd/saldoBs).
 */
function buildMatrix(movements: Movement[], moneda: "BOB" | "USD"): MatrixData {
  const valid = movements.filter((m) => m.fecha !== null);

  // Universo de meses (ordenados ascendente)
  const monthsSet = new Set<string>();
  for (const m of valid) {
    if (m.fecha) monthsSet.add(monthKey(m.fecha));
  }
  const months = Array.from(monthsSet).sort();
  const monthIdx = new Map(months.map((mk, i) => [mk, i] as const));

  // Agrupar por categoría y mes
  const ingByCat = new Map<string, number[]>();
  const egrByCat = new Map<string, number[]>();
  const totalIngPorMes = new Array(months.length).fill(0);
  const totalEgrPorMes = new Array(months.length).fill(0);

  function ensure(map: Map<string, number[]>, cat: string): number[] {
    let arr = map.get(cat);
    if (!arr) {
      arr = new Array(months.length).fill(0);
      map.set(cat, arr);
    }
    return arr;
  }

  for (const m of valid) {
    if (!m.fecha) continue;
    const idx = monthIdx.get(monthKey(m.fecha));
    if (idx === undefined) continue;

    const r = rateAt(m);
    const factor = moneda === "USD" ? (r > 0 ? r : 0) : 1;

    if (m.creditos > 0) {
      const cat = m.categoria || "Otros ingresos";
      const amount = m.creditos * factor;
      ensure(ingByCat, cat)[idx] += amount;
      totalIngPorMes[idx] += amount;
    }
    if (m.debitos > 0) {
      const cat = m.categoria || "Otros egresos";
      const amount = m.debitos * factor;
      ensure(egrByCat, cat)[idx] += amount;
      totalEgrPorMes[idx] += amount;
    }
  }

  // Ordenar categorías por total descendente
  function toRows(map: Map<string, number[]>): MatrixRow[] {
    return Array.from(map.entries())
      .map(([label, values]) => ({
        label,
        values,
        total: values.reduce((a, b) => a + b, 0),
      }))
      .sort((a, b) => b.total - a.total);
  }

  const ingresos = toRows(ingByCat);
  const egresos = toRows(egrByCat);

  const flujoNetoPorMes = months.map((_, i) => totalIngPorMes[i] - totalEgrPorMes[i]);

  // Saldo acumulado: saldo previo al primer movimiento del rango + cumsum del net flow.
  const first = valid[0];
  const last = valid[valid.length - 1];
  const firstRate = first ? rateAt(first) : 0;
  const saldoInicialBs = first ? first.saldo - first.monto : 0;
  const saldoInicialUsd = first ? first.saldoUsd - first.monto * firstRate : 0;
  const saldoInicial = moneda === "USD" ? saldoInicialUsd : saldoInicialBs;

  const saldoAcumuladoPorMes: number[] = [];
  let cum = saldoInicial;
  for (const neto of flujoNetoPorMes) {
    cum += neto;
    saldoAcumuladoPorMes.push(cum);
  }

  const totalIngresosGlobal = totalIngPorMes.reduce((a, b) => a + b, 0);
  const totalEgresosGlobal = totalEgrPorMes.reduce((a, b) => a + b, 0);
  const flujoNetoGlobal = totalIngresosGlobal - totalEgresosGlobal;
  // saldoFinal = último valor del cumsum (o saldo real del último movimiento)
  const saldoFinal = last
    ? moneda === "USD"
      ? last.saldoUsd
      : last.saldo
    : saldoInicial + flujoNetoGlobal;

  return {
    months,
    ingresos,
    egresos,
    totalIngresosPorMes: totalIngPorMes,
    totalEgresosPorMes: totalEgrPorMes,
    flujoNetoPorMes,
    saldoAcumuladoPorMes,
    totalIngresosGlobal,
    totalEgresosGlobal,
    flujoNetoGlobal,
    saldoFinal,
  };
}

export function MonthlyMatrixView() {
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

  const matrix = useMemo(
    () => buildMatrix(filteredMovements, filters.moneda),
    [filteredMovements, filters.moneda]
  );

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
        Cargando flujo mensual…
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
          Flujo Mensual
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Matriz de categorías × meses con totales por columna, fila y saldo acumulado.
          Datos del Consolidado real, agrupados por <em>Concepto P&amp;L</em>.
        </p>
      </div>

      <MonthlyMatrixTable matrix={matrix} moneda={filters.moneda} />
    </div>
  );
}
