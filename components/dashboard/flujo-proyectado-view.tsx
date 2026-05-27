"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Calendar, Coins, Loader2 } from "lucide-react";
import { DashboardData, Movement, ProjectedDashboardData, ProjectedMovement } from "@/lib/types";
import { cn, parseApiDate } from "@/lib/utils";
import type { Moneda } from "./header";
import { FlujoRealTable, type FlujoRealData, type FlujoRow } from "./flujo-real-table";

function rehydrateReal(raw: any[]): Movement[] {
  return raw.map((m) => ({ ...m, fecha: parseApiDate(m.fecha) }));
}

function rehydrateProjected(raw: any[]): ProjectedMovement[] {
  return raw.map((m) => ({ ...m, fecha: parseApiDate(m.fecha) }));
}

function rateAt(m: Movement): number {
  if (!m.saldo || !m.saldoUsd) return 0;
  return m.saldoUsd / m.saldo;
}

function detectSection(
  label: string,
  creditos: number,
  debitos: number,
  tipo?: Movement["tipo"],
): "ingreso" | "egreso" | "financiamiento" {
  if (/(pr[eé]stamo|financ|inter[eé]s(es)?\s*banc)/i.test(label)) {
    return "financiamiento";
  }
  if (creditos > 0 && debitos === 0) return "ingreso";
  if (debitos > 0 && creditos === 0) return "egreso";
  if (tipo === "INGRESO") return "ingreso";
  return "egreso";
}

function buildProjectedMatrix(
  realMovements: Movement[],
  projectedMovements: ProjectedMovement[],
  year: number,
  moneda: Moneda,
): FlujoRealData {
  const realOfYear = realMovements
    .filter((m) => m.fecha && m.fecha.getFullYear() === year)
    .sort((a, b) => (a.fechaHoraMs || a.fecha?.getTime() || 0) - (b.fechaHoraMs || b.fecha?.getTime() || 0));

  const projectedOfYear = projectedMovements
    .filter((m) => m.fecha && m.fecha.getFullYear() === year)
    .sort((a, b) => (a.fecha?.getTime() || 0) - (b.fecha?.getTime() || 0));

  const empty12 = () => new Array(12).fill(0);
  type Group = { values: number[]; children: Map<string, number[]> };
  const ingByCat = new Map<string, Group>();
  const egrByCat = new Map<string, Group>();
  const finByCat = new Map<string, Group>();
  const totalIngPorMes = empty12();
  const totalEgrPorMes = empty12();
  const totalFinPorMes = empty12();
  const proyectadoNetoPorMes = empty12();

  function ensureGroup(map: Map<string, Group>, cat: string): Group {
    let group = map.get(cat);
    if (!group) {
      group = { values: empty12(), children: new Map() };
      map.set(cat, group);
    }
    return group;
  }

  function addToGroup(map: Map<string, Group>, cat: string, detail: string, monthIdx: number, amount: number) {
    const group = ensureGroup(map, cat);
    group.values[monthIdx] += amount;

    const childLabel = detail || cat;
    let child = group.children.get(childLabel);
    if (!child) {
      child = empty12();
      group.children.set(childLabel, child);
    }
    child[monthIdx] += amount;
  }

  function addMovement(
    label: string,
    detail: string,
    monthIdx: number,
    creditos: number,
    debitos: number,
    tipo?: Movement["tipo"],
    projected = false,
  ) {
    const section = detectSection(label, creditos, debitos, tipo);
    if (section === "financiamiento") {
      const neto = creditos - debitos;
      addToGroup(finByCat, label, detail, monthIdx, neto);
      totalFinPorMes[monthIdx] += neto;
      if (projected) proyectadoNetoPorMes[monthIdx] += neto;
    } else if (section === "ingreso") {
      addToGroup(ingByCat, label, detail, monthIdx, creditos);
      totalIngPorMes[monthIdx] += creditos;
      if (projected) proyectadoNetoPorMes[monthIdx] += creditos;
    } else {
      addToGroup(egrByCat, label, detail, monthIdx, debitos);
      totalEgrPorMes[monthIdx] += debitos;
      if (projected) proyectadoNetoPorMes[monthIdx] -= debitos;
    }
  }

  for (const m of realOfYear) {
    if (!m.fecha) continue;
    const monthIdx = m.fecha.getMonth();
    const factor = moneda === "USD" ? rateAt(m) || 0 : 1;
    const label = m.descPL || "Sin cuenta";
    addMovement(
      label,
      m.detallePL || label,
      monthIdx,
      m.creditos * factor,
      m.debitos * factor,
      m.tipo,
    );
  }

  for (const m of projectedOfYear) {
    if (!m.fecha) continue;
    const monthIdx = m.fecha.getMonth();
    const label = m.conceptoPL || m.concepto || m.centroCosto || "Proyección sin concepto";
    const detail = m.descPL || m.detallePL || label;
    const creditos = moneda === "USD" ? (m.ingresos > 0 ? Math.abs(m.montoUsd) : 0) : m.ingresos;
    const debitos = moneda === "USD" ? (m.egresos > 0 ? Math.abs(m.montoUsd) : 0) : m.egresos;
    if (creditos === 0 && debitos === 0) continue;
    addMovement(label, detail, monthIdx, creditos, debitos, undefined, true);
  }

  function toRows(map: Map<string, Group>): FlujoRow[] {
    return Array.from(map.entries())
      .map(([label, group]) => {
        const total = group.values.reduce((a, b) => a + b, 0);
        const children = Array.from(group.children.entries())
          .map(([childLabel, values]) => ({
            label: childLabel,
            values,
            total: values.reduce((a, b) => a + b, 0),
          }))
          .sort((a, b) => Math.abs(b.total) - Math.abs(a.total));

        return {
          label,
          values: group.values,
          total,
          children: children.length > 1 || children[0]?.label !== label ? children : undefined,
        };
      })
      .sort((a, b) => Math.abs(b.total) - Math.abs(a.total));
  }

  const saldoInicialPorMes = empty12();
  const saldoFinalPorMes = empty12();
  const projectedSaldoPorMes = empty12();

  for (const m of projectedOfYear) {
    if (!m.fecha || !m.saldoBs) continue;
    projectedSaldoPorMes[m.fecha.getMonth()] = moneda === "USD" ? m.montoUsd : m.saldoBs;
  }

  for (let monthIdx = 0; monthIdx < 12; monthIdx++) {
    const realRows = realOfYear.filter((m) => m.fecha?.getMonth() === monthIdx);
    if (realRows.length > 0) {
      const first = realRows[0];
      const last = realRows[realRows.length - 1];
      saldoInicialPorMes[monthIdx] = moneda === "USD" ? first.saldoUsd : first.saldo;
      saldoFinalPorMes[monthIdx] = projectedSaldoPorMes[monthIdx] || (moneda === "USD" ? last.saldoUsd : last.saldo);
    } else {
      saldoInicialPorMes[monthIdx] = projectedSaldoPorMes[monthIdx];
      saldoFinalPorMes[monthIdx] = projectedSaldoPorMes[monthIdx];
    }
  }

  const flujoEconomicoPorMes = empty12().map(
    (_, i) => totalIngPorMes[i] - totalEgrPorMes[i],
  );

  return {
    year,
    saldoInicialPorMes,
    ingresos: toRows(ingByCat),
    egresos: toRows(egrByCat),
    financiamiento: toRows(finByCat),
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

export function FlujoProyectadoView() {
  const [realMovements, setRealMovements] = useState<Movement[] | null>(null);
  const [projectedMovements, setProjectedMovements] = useState<ProjectedMovement[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState<number | null>(null);
  const [moneda, setMoneda] = useState<Moneda>("BOB");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        const [realRes, projectedRes] = await Promise.all([
          fetch("/api/dashboard", { cache: "no-store" }),
          fetch("/api/proyectado", { cache: "no-store" }),
        ]);
        if (!realRes.ok) throw new Error(`Error cargando real: HTTP ${realRes.status}`);
        if (!projectedRes.ok) {
          const body = await projectedRes.json().catch(() => ({}));
          throw new Error(body.error || `Error cargando proyectado: HTTP ${projectedRes.status}`);
        }

        const realJson = (await realRes.json()) as DashboardData;
        const projectedJson = (await projectedRes.json()) as ProjectedDashboardData;
        if (cancelled) return;
        setRealMovements(rehydrateReal(realJson.movements));
        setProjectedMovements(rehydrateProjected(projectedJson.movements));
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

  const availableYears = useMemo(() => {
    const ys = new Set<number>();
    for (const m of realMovements ?? []) {
      if (m.fecha) ys.add(m.fecha.getFullYear());
    }
    for (const m of projectedMovements ?? []) {
      if (m.fecha) ys.add(m.fecha.getFullYear());
    }
    return Array.from(ys).sort();
  }, [realMovements, projectedMovements]);

  useEffect(() => {
    if (year === null && availableYears.length > 0) {
      setYear(availableYears[availableYears.length - 1]);
    }
  }, [availableYears, year]);

  const matrix = useMemo(() => {
    if (!realMovements || !projectedMovements || year === null) return null;
    return buildProjectedMatrix(realMovements, projectedMovements, year, moneda);
  }, [realMovements, projectedMovements, year, moneda]);

  const projectedCount = useMemo(() => {
    if (!projectedMovements || year === null) return 0;
    return projectedMovements.filter((m) => m.fecha?.getFullYear() === year).length;
  }, [projectedMovements, year]);

  if (loading && (!realMovements || !projectedMovements)) {
    return (
      <div className="flex h-[60vh] items-center justify-center text-slate-500">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Cargando flujo de caja proyectado...
      </div>
    );
  }

  if (error) {
    return (
      <div className="m-8 rounded-xl border border-rose-200 bg-rose-50 p-6 text-rose-800">
        <div className="flex items-center gap-2 font-semibold">
          <AlertTriangle className="h-5 w-5" />
          No se pudieron cargar los datos proyectados
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
            FLUJO DE CAJA PROYECTADO
          </h1>
          <p className="mt-1 text-sm font-semibold uppercase tracking-wider text-blue-700">
            Real + proyecciones futuras
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Año {year} · {projectedCount.toLocaleString("es-PE")} movimientos proyectados
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
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
                  moneda === "BOB" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500 hover:text-slate-700",
                )}
              >
                Bs
              </button>
              <button
                onClick={() => setMoneda("USD")}
                className={cn(
                  "rounded px-3 py-1 text-xs font-semibold tabular-nums transition-colors",
                  moneda === "USD" ? "bg-white text-emerald-700 shadow-sm" : "text-slate-500 hover:text-slate-700",
                )}
              >
                USD
              </button>
            </div>
          </div>
        </div>
      </div>

      <FlujoRealTable
        data={matrix}
        moneda={moneda}
        title={`Flujo de caja proyectado — ${matrix.year}`}
      />
    </div>
  );
}
