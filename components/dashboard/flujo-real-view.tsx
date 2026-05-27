"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, AlertTriangle, Coins, Calendar } from "lucide-react";
import { DashboardData, Movement } from "@/lib/types";
import { parseApiDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { Moneda } from "./header";
import {
  FlujoRealTable,
  type FlujoRealData,
  type FlujoRow,
} from "./flujo-real-table";

function rehydrate(raw: any[]): Movement[] {
  return raw.map((m) => ({ ...m, fecha: parseApiDate(m.fecha) }));
}

function rateAt(m: Movement): number {
  if (!m.saldo || !m.saldoUsd) return 0;
  return m.saldoUsd / m.saldo;
}

/**
 * Detecta si un movimiento es de Financiamiento por keywords en conceptoPL o descPL.
 * Si no matchea, retorna "ingreso" o "egreso" según el monto.
 */
function detectSection(m: Movement): "ingreso" | "egreso" | "financiamiento" {
  // Buscamos keyword en concepto Y descripción (la que primero matchee)
  const haystack = `${m.conceptoPL || ""} ${m.descPL || ""}`.toLowerCase();
  if (/(pr[eé]stamo|financ|inter[eé]s(es)?\s*banc)/i.test(haystack)) {
    return "financiamiento";
  }
  if (m.creditos > 0 && m.debitos === 0) return "ingreso";
  if (m.debitos > 0 && m.creditos === 0) return "egreso";
  if (m.tipo === "INGRESO") return "ingreso";
  return "egreso";
}

/**
 * Construye toda la matriz del año seleccionado (12 meses ENE-DIC).
 * Si moneda === USD, aplica el rate por fila para convertir.
 */
function buildYearMatrix(
  movements: Movement[],
  year: number,
  moneda: Moneda,
): FlujoRealData {
  // Filtrar al año
  const ofYear = movements.filter(
    (m) => m.fecha && m.fecha.getFullYear() === year,
  );
  ofYear.sort((a, b) => {
    const ta = a.fechaHoraMs || a.fecha?.getTime() || 0;
    const tb = b.fechaHoraMs || b.fecha?.getTime() || 0;
    return ta - tb;
  });

  const empty12 = () => new Array(12).fill(0);

  // Grupos por categoría dentro de cada sección
  const ingByCat = new Map<string, number[]>();
  const egrByCat = new Map<string, number[]>();
  const finByCat = new Map<string, number[]>();
  const totalIngPorMes = empty12();
  const totalEgrPorMes = empty12();
  const totalFinPorMes = empty12();

  function ensure(map: Map<string, number[]>, cat: string): number[] {
    let arr = map.get(cat);
    if (!arr) {
      arr = empty12();
      map.set(cat, arr);
    }
    return arr;
  }

  for (const m of ofYear) {
    if (!m.fecha) continue;
    const monthIdx = m.fecha.getMonth(); // 0-11
    const factor = moneda === "USD" ? rateAt(m) || 0 : 1;
    // Etiqueta de la fila: usamos exclusivamente Desc P&L (columna K),
    // que contiene las cuentas que deben reflejarse en esta matriz.
    const cat = m.descPL || "Sin cuenta";
    const section = detectSection(m);

    const cred = m.creditos * factor;
    const deb = m.debitos * factor;

    if (section === "financiamiento") {
      // En financiamiento, sumamos NETO (créditos positivos, débitos negativos)
      const neto = cred - deb;
      ensure(finByCat, cat)[monthIdx] += neto;
      totalFinPorMes[monthIdx] += neto;
    } else if (section === "ingreso") {
      ensure(ingByCat, cat)[monthIdx] += cred;
      totalIngPorMes[monthIdx] += cred;
    } else {
      ensure(egrByCat, cat)[monthIdx] += deb;
      totalEgrPorMes[monthIdx] += deb;
    }
  }

  function toRows(map: Map<string, number[]>): FlujoRow[] {
    return Array.from(map.entries())
      .map(([label, values]) => ({
        label,
        values,
        total: values.reduce((a, b) => a + b, 0),
      }))
      .sort((a, b) => Math.abs(b.total) - Math.abs(a.total));
  }

  const ingresos = toRows(ingByCat);
  const egresos = toRows(egrByCat);
  const financiamiento = toRows(finByCat);

  // Flujo económico por mes = Ingresos - Egresos
  const flujoEconomicoPorMes = empty12().map(
    (_, i) => totalIngPorMes[i] - totalEgrPorMes[i],
  );

  // Saldos del extracto por mes: la fuente de verdad es la columna de saldo,
  // no un recálculo desde ingresos/egresos.
  const saldoInicialPorMes = empty12();
  const saldoFinalPorMes = empty12();
  for (const m of ofYear) {
    if (!m.fecha) continue;
    const monthIdx = m.fecha.getMonth();
    const saldo = moneda === "USD" ? m.saldoUsd : m.saldo;
    if (saldoInicialPorMes[monthIdx] === 0) {
      saldoInicialPorMes[monthIdx] = saldo;
    }
    saldoFinalPorMes[monthIdx] = saldo;
  }

  return {
    year,
    saldoInicialPorMes,
    ingresos,
    egresos,
    financiamiento,
    totalIngresosPorMes: totalIngPorMes,
    totalEgresosPorMes: totalEgrPorMes,
    totalFinanciamientoPorMes: totalFinPorMes,
    flujoEconomicoPorMes,
    saldoFinalPorMes,
    totalIngresosAnual: totalIngPorMes.reduce((a, b) => a + b, 0),
    totalEgresosAnual: totalEgrPorMes.reduce((a, b) => a + b, 0),
    totalFinanciamientoAnual: totalFinPorMes.reduce((a, b) => a + b, 0),
    flujoEconomicoAnual: flujoEconomicoPorMes.reduce((a, b) => a + b, 0),
  };
}

export function FlujoRealView() {
  const [movements, setMovements] = useState<Movement[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState<number | null>(null);
  const [moneda, setMoneda] = useState<Moneda>("BOB");

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
        setMovements(movs);
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

  // Años únicos disponibles
  const availableYears = useMemo(() => {
    if (!movements) return [];
    const ys = new Set<number>();
    for (const m of movements) {
      if (m.fecha) ys.add(m.fecha.getFullYear());
    }
    return Array.from(ys).sort();
  }, [movements]);

  // Auto-seleccionar el año más reciente al cargar
  useEffect(() => {
    if (year === null && availableYears.length > 0) {
      setYear(availableYears[availableYears.length - 1]);
    }
  }, [availableYears, year]);

  const matrix = useMemo(() => {
    if (!movements || year === null) return null;
    return buildYearMatrix(movements, year, moneda);
  }, [movements, year, moneda]);

  if (loading && !movements) {
    return (
      <div className="flex h-[60vh] items-center justify-center text-slate-500">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Cargando flujo de caja real…
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

  if (!matrix || year === null) return null;

  return (
    <div className="space-y-5 p-6 lg:p-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
            FLUJO DE CAJA REAL
          </h1>
          <p className="mt-1 text-sm font-semibold uppercase tracking-wider text-blue-700">
            Estado mensual por cuenta
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Año {year} ·{" "}
            {movements?.filter((m) => m.fecha?.getFullYear() === year).length}{" "}
            movimientos
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          {/* Año */}
          <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3 w-3 text-slate-500" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Año
              </span>
            </div>
            <select
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value, 10))}
              className="mt-0.5 cursor-pointer bg-transparent text-sm font-semibold tabular-nums text-slate-800 outline-none"
            >
              {availableYears.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          {/* Moneda */}
          <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
            <div className="flex items-center gap-1.5">
              <Coins className="h-3 w-3 text-slate-500" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Moneda
              </span>
            </div>
            <div className="mt-1 inline-flex rounded-md bg-slate-100 p-0.5">
              <button
                onClick={() => setMoneda("BOB")}
                className={cn(
                  "rounded px-3 py-1 text-xs font-semibold tabular-nums transition-colors",
                  moneda === "BOB"
                    ? "bg-white text-blue-700 shadow-sm"
                    : "text-slate-500 hover:text-slate-700",
                )}
              >
                Bs
              </button>
              <button
                onClick={() => setMoneda("USD")}
                className={cn(
                  "rounded px-3 py-1 text-xs font-semibold tabular-nums transition-colors",
                  moneda === "USD"
                    ? "bg-white text-emerald-700 shadow-sm"
                    : "text-slate-500 hover:text-slate-700",
                )}
              >
                USD
              </button>
            </div>
          </div>
        </div>
      </div>

      <FlujoRealTable data={matrix} moneda={moneda} />
    </div>
  );
}
