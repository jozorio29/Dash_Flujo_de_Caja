"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, AlertTriangle, Calendar, Coins, Layers, GitCompare, ArrowUp, ArrowDown, Minus } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from "recharts";
import { cn } from "@/lib/utils";
import { colorFor } from "@/components/facturacion/series-dashboard";
import {
  computeKPIs,
  comparisonEnd,
  defaultPeriodo,
  type Comparacion,
  type IndicadorCol,
  type IndicadorRow,
  type KPI,
  type Modo,
  type Moneda,
} from "@/lib/indicadores";

interface Row extends IndicadorRow {
  mes: string;
}

// ─── Formato ──────────────────────────────────────────────────────────────────

const MES_CORTO = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function periodoLabel(p: string): string {
  const [y, m] = p.split("-").map(Number);
  return `${MES_CORTO[m - 1]} ${y}`;
}

const nfCompact = new Intl.NumberFormat("es-BO", { notation: "compact", maximumFractionDigits: 1 });
const nfFull = new Intl.NumberFormat("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nfPct = new Intl.NumberFormat("es-BO", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function prefix(moneda: Moneda) {
  return moneda === "USD" ? "USD" : "Bs";
}

function formatValor(col: IndicadorCol, v: number | null, moneda: Moneda, full = false): string {
  if (v === null) return "—";
  if (col.tipo === "porcentaje") return `${nfPct.format(v * 100)} %`;
  return `${prefix(moneda)} ${full ? nfFull.format(v) : nfCompact.format(v)}`;
}

function formatDelta(k: KPI): string {
  if (k.delta === null) return "s/d";
  const sign = k.delta > 0 ? "+" : k.delta < 0 ? "−" : "";
  const abs = nfPct.format(Math.abs(k.delta));
  return k.col.tipo === "porcentaje" ? `${sign}${abs} p.p.` : `${sign}${abs} %`;
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function KpiCard({ k, moneda, compLabel }: { k: KPI; moneda: Moneda; compLabel: string }) {
  const Icon = k.delta === null || k.delta === 0 ? Minus : k.delta > 0 ? ArrowUp : ArrowDown;
  const tone =
    k.favorable === null ? "text-slate-300" : k.favorable ? "text-emerald-400" : "text-rose-400";

  return (
    <div
      className="flex flex-col justify-between rounded-xl bg-[#0B1B3B] p-4 text-white shadow-sm ring-1 ring-white/10"
      title={`${k.col.label}\nActual: ${formatValor(k.col, k.actual, moneda, true)}\n${compLabel}: ${formatValor(k.col, k.anterior, moneda, true)}`}
    >
      <p className="line-clamp-2 text-xs font-medium text-slate-300">{k.col.label}</p>
      <p
        className={cn(
          "mt-2 text-2xl font-bold tabular-nums",
          k.actual !== null && k.actual < 0 ? "text-rose-300" : "text-white"
        )}
      >
        {formatValor(k.col, k.actual, moneda)}
      </p>
      <div className={cn("mt-2 flex items-center gap-1 text-sm font-semibold tabular-nums", tone)}>
        <Icon className="h-4 w-4" />
        {formatDelta(k)}
      </div>
      <p className="mt-0.5 text-[11px] text-slate-400">vs. {compLabel}</p>
    </div>
  );
}

function Control({ icon: Icon, label, children }: { icon: any; label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
      <div className="flex items-center gap-1.5">
        <Icon className="h-3 w-3 text-slate-500" />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</span>
      </div>
      {children}
    </div>
  );
}

function Toggle<T extends string>({ value, onChange, options }: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="mt-1 inline-flex rounded-md bg-slate-100 p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded px-3 py-1 text-xs font-semibold transition-colors",
            value === o.value ? "bg-white text-blue-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const ChartTooltip = ({ active, payload, label, format }: any) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-lg">
      <p className="mb-2 font-bold text-slate-800">{label}</p>
      {payload.map((entry: any) => (
        <div key={entry.dataKey} className="mb-1 flex justify-between gap-4 text-sm" style={{ color: entry.color }}>
          <span>{entry.name}:</span>
          <span className="font-medium tabular-nums">{format(entry.value)}</span>
        </div>
      ))}
    </div>
  );
};

function TrendChart({ title, data, cols, visible, onToggle, format, tickFormat }: {
  title: string;
  data: Record<string, number | string>[];
  cols: (IndicadorCol & { color: string })[];
  visible: Record<string, boolean>;
  onToggle: (key: string) => void;
  format: (v: number) => string;
  tickFormat: (v: number) => string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-bold text-slate-800">{title}</h2>
      <div className="my-3 flex flex-wrap gap-2">
        {cols.map((c) => (
          <button
            key={c.key}
            onClick={() => onToggle(c.key)}
            className={cn(
              "rounded border px-2 py-1 text-[10px] font-semibold transition-colors",
              visible[c.key] ? "text-white" : "border-slate-200 bg-white text-slate-400 hover:bg-slate-100"
            )}
            style={visible[c.key] ? { backgroundColor: c.color, borderColor: c.color } : {}}
          >
            {c.label}
          </button>
        ))}
      </div>
      <div className="h-[340px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#94a3b8" strokeOpacity={0.3} />
            <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} tickFormatter={tickFormat} />
            <ReferenceLine y={0} stroke="#94a3b8" />
            <Tooltip content={<ChartTooltip format={format} />} />
            <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "20px" }} />
            {cols.filter((c) => visible[c.key]).map((c) => (
              <Line key={c.key} type="monotone" dataKey={c.key} name={c.label} stroke={c.color} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function IndicadoresView() {
  const [data, setData] = useState<Row[] | null>(null);
  const [columns, setColumns] = useState<(IndicadorCol & { color: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [periodo, setPeriodo] = useState<string>("");
  const [modo, setModo] = useState<Modo>("mes");
  const [comparar, setComparar] = useState<Comparacion>("anterior");
  const [moneda, setMoneda] = useState<Moneda>("USD");
  const [visible, setVisible] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/indicadores", { cache: "no-store" });
        const json = await res.json().catch(() => null);
        if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
        if (cancelled) return;

        const cols = (json.columns as IndicadorCol[]).map((c, i) => ({ ...c, color: colorFor(i) }));
        const rows = json.data as Row[];
        setColumns(cols);
        setData(rows);
        setVisible(Object.fromEntries(cols.map((c) => [c.key, true])));
        const now = new Date();
        const hoy = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
        setPeriodo(defaultPeriodo(rows, cols, hoy) ?? "");
        setError(null);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const periodos = useMemo(
    () => Array.from(new Set((data ?? []).map((r) => r.fecha.slice(0, 7)))).sort(),
    [data]
  );

  const kpis = useMemo(
    () => (data && periodo ? computeKPIs(data, columns, { periodo, modo, comparar, moneda }) : []),
    [data, columns, periodo, modo, comparar, moneda]
  );

  const compLabel = useMemo(() => {
    if (!periodo) return "";
    const end = comparisonEnd(periodo, modo, comparar);
    return modo === "ytd" ? `ene–${periodoLabel(end)}` : periodoLabel(end);
  }, [periodo, modo, comparar]);

  // Tendencia: 12 meses hasta el período elegido
  const trendData = useMemo(() => {
    if (!data || !periodo) return [];
    const rows = data.filter((r) => r.fecha.slice(0, 7) <= periodo).slice(-12);
    return rows.map((r) => {
      const out: Record<string, number | string> = { name: periodoLabel(r.fecha.slice(0, 7)) };
      columns.forEach((c) => {
        const v = typeof r[c.key] === "number" ? (r[c.key] as number) : 0;
        out[c.key] = c.tipo === "porcentaje" ? v * 100 : v * (moneda === "BOB" ? r.tc : 1);
      });
      return out;
    });
  }, [data, columns, periodo, moneda]);

  const montoCols = columns.filter((c) => c.tipo === "monto");
  const pctCols = columns.filter((c) => c.tipo === "porcentaje");
  const toggle = (key: string) => setVisible((prev) => ({ ...prev, [key]: !prev[key] }));

  if (loading && !data) {
    return (
      <div className="flex h-[60vh] items-center justify-center text-slate-500">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Cargando indicadores…
      </div>
    );
  }

  if (error) {
    return (
      <div className="m-8 rounded-xl border border-rose-200 bg-rose-50 p-6 text-rose-800">
        <div className="flex items-center gap-2 font-semibold">
          <AlertTriangle className="h-5 w-5" />
          Error al cargar datos
        </div>
        <pre className="mt-3 whitespace-pre-wrap text-sm">{error}</pre>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 lg:p-8">
      {/* Header & controles */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Indicadores</h1>
          <p className="mt-1 text-sm font-semibold uppercase tracking-wider text-blue-700">
            Rentabilidad P&amp;L · {periodo ? (modo === "ytd" ? `ene–${periodoLabel(periodo)}` : periodoLabel(periodo)) : "—"}
          </p>
        </div>

        <div className="flex flex-col flex-wrap gap-3 sm:flex-row sm:items-end">
          <Control icon={Calendar} label="Mes">
            <select
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value)}
              className="mt-0.5 cursor-pointer bg-transparent text-sm font-semibold tabular-nums text-slate-800 outline-none"
            >
              {periodos.map((p) => (
                <option key={p} value={p} style={{ color: "black", backgroundColor: "white" }}>{periodoLabel(p)}</option>
              ))}
            </select>
          </Control>
          <Control icon={Layers} label="Vista">
            <Toggle value={modo} onChange={setModo} options={[{ value: "mes", label: "Mes" }, { value: "ytd", label: "Acumulado año" }]} />
          </Control>
          {modo === "mes" && (
            <Control icon={GitCompare} label="Comparar contra">
              <Toggle
                value={comparar}
                onChange={setComparar}
                options={[{ value: "anterior", label: "Mes anterior" }, { value: "anio", label: "Año anterior" }]}
              />
            </Control>
          )}
          <Control icon={Coins} label="Moneda (TC Paralelo)">
            <Toggle value={moneda} onChange={setMoneda} options={[{ value: "BOB", label: "Bs." }, { value: "USD", label: "USD" }]} />
          </Control>
        </div>
      </div>

      {columns.length === 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          No se encontraron columnas de indicadores en la hoja P&amp;L.
        </div>
      ) : (
        <>
          {/* Tableros */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {kpis.map((k) => <KpiCard key={k.col.key} k={k} moneda={moneda} compLabel={compLabel} />)}
          </div>

          {/* Tendencias */}
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            {montoCols.length > 0 && (
              <TrendChart
                title="Evolución de montos (12 meses)"
                data={trendData}
                cols={montoCols}
                visible={visible}
                onToggle={toggle}
                format={(v) => `${prefix(moneda)} ${nfFull.format(v)}`}
                tickFormat={(v) => nfCompact.format(v)}
              />
            )}
            {pctCols.length > 0 && (
              <TrendChart
                title="Evolución de márgenes % (12 meses)"
                data={trendData}
                cols={pctCols}
                visible={visible}
                onToggle={toggle}
                format={(v) => `${nfPct.format(v)} %`}
                tickFormat={(v) => `${nfCompact.format(v)} %`}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}
