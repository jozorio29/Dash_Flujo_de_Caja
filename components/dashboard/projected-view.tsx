"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DashboardData,
  Movement,
  ProjectedDashboardData,
  ProjectedMovement,
  SaldoSeriesPoint,
} from "@/lib/types";
import { monthKey, monthLabel, formatCurrency } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { SaldoRealVsProyectadoChart } from "./saldo-real-vs-proyectado-chart";
import { ProjectedTable } from "./projected-table";
import { Loader2, AlertTriangle, ArrowUpRight, ArrowDownRight, Wallet, Clock } from "lucide-react";

/** Rehidrata fechas (Date) que viajaron como string por JSON. */
function rehydrate<T extends { fecha: any }>(arr: T[]): T[] {
  return arr.map((m) => ({ ...m, fecha: m.fecha ? new Date(m.fecha) : null }));
}

/** Saldo final por mes en una serie de movimientos con campo `saldo`. */
function lastSaldoPorMes<T extends { fecha: Date | null }>(
  movements: T[],
  pickSaldo: (m: T) => number
): Map<string, number> {
  const out = new Map<string, number>();
  for (const m of movements) {
    if (!m.fecha) continue;
    out.set(monthKey(m.fecha), pickSaldo(m));
  }
  return out;
}

export function ProjectedView() {
  const [realData, setRealData] = useState<DashboardData | null>(null);
  const [proyData, setProyData] = useState<ProjectedDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        const [resReal, resProy] = await Promise.all([
          fetch("/api/dashboard", { cache: "no-store" }),
          fetch("/api/proyectado", { cache: "no-store" }),
        ]);
        if (!resReal.ok) throw new Error(`Error cargando real: HTTP ${resReal.status}`);
        if (!resProy.ok) {
          const body = await resProy.json().catch(() => ({}));
          throw new Error(body.error || `Error cargando proyectado: HTTP ${resProy.status}`);
        }
        const jsonReal = (await resReal.json()) as DashboardData;
        const jsonProy = (await resProy.json()) as ProjectedDashboardData;
        if (cancelled) return;
        // Rehidratar fechas
        jsonReal.movements = rehydrate(jsonReal.movements as unknown as Movement[]);
        jsonProy.movements = rehydrate(jsonProy.movements as unknown as ProjectedMovement[]);
        setRealData(jsonReal);
        setProyData(jsonProy);
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

  // Construye la serie unificada Real vs Proyectado por mes
  const { chartData, cutoffMonth } = useMemo(() => {
    if (!realData || !proyData) return { chartData: [], cutoffMonth: null };

    const realByMonth = lastSaldoPorMes(realData.movements, (m: Movement) => m.saldo);
    const proyByMonth = lastSaldoPorMes(
      proyData.movements,
      (m: ProjectedMovement) => m.saldoBs
    );

    // Cutoff = último mes con data real
    const realMonths = Array.from(realByMonth.keys()).sort();
    const cutoff = realMonths[realMonths.length - 1] ?? null;

    // Universo de meses = unión de ambos, ordenado
    const allMonths = Array.from(
      new Set([...realByMonth.keys(), ...proyByMonth.keys()])
    ).sort();

    const points: SaldoSeriesPoint[] = allMonths.map((m) => {
      const real = realByMonth.has(m) ? realByMonth.get(m)! : null;
      const proy = proyByMonth.has(m) ? proyByMonth.get(m)! : null;
      return {
        month: m,
        label: monthLabel(m),
        real,
        // Solo mostrar la línea proyectada DESPUÉS del corte
        // (incluyendo el corte mismo para conectar visualmente con el real).
        proyectado: cutoff && m >= cutoff ? proy : null,
      };
    });

    // Si el corte tiene real pero no proyectado, reusar el real como ancla
    // del comienzo de la línea proyectada para que se conecten visualmente.
    if (cutoff) {
      const idx = points.findIndex((p) => p.month === cutoff);
      if (idx >= 0 && points[idx].proyectado === null && points[idx].real !== null) {
        points[idx].proyectado = points[idx].real;
      }
    }

    return { chartData: points, cutoffMonth: cutoff };
  }, [realData, proyData]);

  if (loading) {
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
          No se pudieron cargar los datos proyectados
        </div>
        <pre className="mt-3 whitespace-pre-wrap text-sm">{error}</pre>
        <p className="mt-3 text-sm">
          Revisa que la pestaña <code className="rounded bg-white px-1.5 py-0.5">Flujo</code> exista en
          tu Google Sheet y que <code className="rounded bg-white px-1.5 py-0.5">PROYECTADO_RANGE</code>{" "}
          en <code className="rounded bg-white px-1.5 py-0.5">.env.local</code> apunte a ella.
        </p>
      </div>
    );
  }

  if (!proyData) return null;

  const summary = proyData.summary;

  return (
    <div className="space-y-5 p-6 lg:p-8">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
          FLUJO DE CAJA PROYECTADO
        </h1>
        <p className="mt-1 text-sm font-semibold uppercase tracking-wider text-blue-700">
          Pagos pendientes y proyección de saldo
        </p>
        <p className="mt-1 text-xs text-slate-500">
          {summary.numMovimientos.toLocaleString("es-PE")} pagos proyectados ·
          {summary.fechaInicio && summary.fechaFin && (
            <>
              {" "}
              período {new Date(summary.fechaInicio).toLocaleDateString("es-PE")} →{" "}
              {new Date(summary.fechaFin).toLocaleDateString("es-PE")}
            </>
          )}
        </p>
      </div>

      {/* KPIs resumen */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiBox
          label="Ingresos Proyectados"
          value={formatCurrency(summary.totalIngresos, { symbol: "Bs " })}
          tone="emerald"
          Icon={ArrowUpRight}
        />
        <KpiBox
          label="Egresos Proyectados"
          value={formatCurrency(summary.totalEgresos, { symbol: "Bs " })}
          tone="rose"
          Icon={ArrowDownRight}
        />
        <KpiBox
          label="Stand By (no comprometido)"
          value={formatCurrency(summary.totalStandBy, { symbol: "Bs " })}
          tone="amber"
          Icon={Clock}
        />
        <KpiBox
          label="Saldo Proyectado Final"
          value={formatCurrency(summary.saldoFinalBs, { symbol: "Bs " })}
          subtitle={`USD ${formatCurrency(summary.saldoFinalUsd, { symbol: "$" })}`}
          tone={summary.saldoFinalBs < 0 ? "rose" : "blue"}
          Icon={Wallet}
        />
      </div>

      {/* Gráfico Real vs Proyectado */}
      {chartData.length > 0 && (
        <SaldoRealVsProyectadoChart
          data={chartData}
          cutoffMonth={cutoffMonth}
        />
      )}

      {/* Tabla de pagos proyectados */}
      <ProjectedTable
        movements={proyData.movements}
        statuses={proyData.meta.statuses}
        centrosCosto={proyData.meta.centrosCosto}
        edificios={proyData.meta.edificios}
      />
    </div>
  );
}

function KpiBox({
  label,
  value,
  subtitle,
  tone,
  Icon,
}: {
  label: string;
  value: string;
  subtitle?: string;
  tone: "emerald" | "rose" | "amber" | "blue";
  Icon: React.ComponentType<{ className?: string }>;
}) {
  const tones = {
    emerald: { iconBg: "bg-emerald-50 text-emerald-600", labelClass: "text-emerald-600", valueClass: "text-slate-900" },
    rose: { iconBg: "bg-rose-50 text-rose-600", labelClass: "text-rose-600", valueClass: "text-slate-900" },
    amber: { iconBg: "bg-amber-50 text-amber-600", labelClass: "text-amber-700", valueClass: "text-slate-900" },
    blue: { iconBg: "bg-blue-50 text-blue-600", labelClass: "text-blue-600", valueClass: "text-slate-900" },
  } as const;
  const t = tones[tone];
  return (
    <Card className="px-5 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className={`text-[11px] font-semibold uppercase tracking-wider ${t.labelClass}`}>
            {label}
          </div>
          <div className={`mt-1 truncate text-2xl font-bold tabular-nums ${t.valueClass}`} title={value}>
            {value}
          </div>
          {subtitle && (
            <div className="mt-1 text-[11px] leading-tight text-slate-500">{subtitle}</div>
          )}
        </div>
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${t.iconBg}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  );
}
