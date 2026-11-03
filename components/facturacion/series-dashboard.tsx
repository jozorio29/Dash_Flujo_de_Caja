"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, AlertTriangle, Coins, Calendar, Filter } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { cn } from "@/lib/utils";

/**
 * Tablero genérico de series mensuales de la hoja P&L (Facturación, Horas…).
 * Muestra: evolución general con filtro de columnas, una evolución por grupo,
 * y tortas de distribución (general + una por grupo).
 */

// ─── Tipos (espejo de lib/pl-sheet, sin importar el módulo server) ────────────

interface SeriesColumn {
  key: string;
  label: string;
  group: string;
  sheetIndex: number;
  /** Color asignado en el cliente desde la paleta */
  color: string;
}

interface SeriesGroup {
  id: string;
  label: string;
}

interface SeriesRow {
  ano: number;
  mes: string;
  tc: number;
  fecha: string;
  [key: string]: number | string;
}

type Moneda = "USD" | "BOB";

export type Unidad = "moneda" | "horas";

export interface SeriesDashboardProps {
  title: string;
  subtitle: string;
  endpoint: string;
  loadingText: string;
  unidad: Unidad;
  /** Títulos del gráfico de líneas y de la torta de cada grupo */
  groupTitles: (group: SeriesGroup) => { line: string; pie: string };
}

// ─── Paleta de colores ─────────────────────────────────────────────────────────

const COLOR_PALETTE = [
  "#e63946", // rojo vivo
  "#f4a261", // naranja suave
  "#2a9d8f", // verde azulado
  "#6a0572", // púrpura oscuro
  "#457b9d", // azul acero
  "#e9c46a", // amarillo dorado
  "#264653", // verde petróleo
  "#f77f00", // naranja intenso
  "#8338ec", // violeta eléctrico
  "#06d6a0", // turquesa neón
  "#7f5539", // marrón café
  "#3a86ff", // azul brillante
  "#fb5607", // naranja rojo
  "#52b788", // verde esmeralda
  "#c77dff", // lavanda
  "#118ab2", // azul oceánico
  "#ffb703", // ámbar puro
  "#b5179e", // fucsia
  "#80b918", // verde lima
  "#ff006e", // rosa magenta
];

/** Color para la columna idx: usa la paleta y, si se agota, genera tonos nuevos. */
export function colorFor(idx: number): string {
  if (idx < COLOR_PALETTE.length) return COLOR_PALETTE[idx];
  const n = idx - COLOR_PALETTE.length;
  const hue = Math.round((n * 137.508 + 15) % 360); // ángulo áureo: tonos bien separados
  const light = [45, 60, 35][n % 3];
  return `hsl(${hue} 70% ${light}%)`;
}

function makeFormatter(unidad: Unidad, moneda: Moneda) {
  if (unidad === "horas") {
    const nf = new Intl.NumberFormat("es-BO", { maximumFractionDigits: 1 });
    return (v: number) => `${nf.format(v)} h`;
  }
  const nf = new Intl.NumberFormat("es-BO", { style: "currency", currency: moneda });
  return (v: number) => nf.format(v);
}

const compact = new Intl.NumberFormat("es-BO", { notation: "compact" });

// ─── Tooltips ─────────────────────────────────────────────────────────────────

const LineTooltip = ({ active, payload, label, format }: any) => {
  if (!active || !payload || !payload.length) return null;
  const total = payload.reduce((sum: number, entry: any) => sum + entry.value, 0);
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-lg">
      <p className="mb-2 font-bold text-slate-800">{label}</p>
      {payload.map((entry: any, index: number) => (
        <div key={index} className="mb-1 flex justify-between gap-4 text-sm" style={{ color: entry.color }}>
          <span>{entry.name}:</span>
          <span className="font-medium">{format(entry.value)}</span>
        </div>
      ))}
      <div className="mt-2 flex justify-between gap-4 border-t pt-2 text-sm font-bold text-slate-800">
        <span>Total:</span>
        <span>{format(total)}</span>
      </div>
    </div>
  );
};

const PieTooltip = ({ active, payload, format }: any) => {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0].payload;
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-lg">
      <div className="mb-1 flex items-center gap-2">
        <div className="h-3 w-3 rounded-full" style={{ backgroundColor: data.color }}></div>
        <p className="font-bold text-slate-800">{data.name}</p>
      </div>
      <div className="flex justify-between gap-4 text-sm">
        <span className="font-medium text-slate-600">{format(data.value)}</span>
        <span className="font-bold text-slate-800">
          {data.percentage ? `${data.percentage.toFixed(1)}%` : ""}
        </span>
      </div>
    </div>
  );
};

const renderPieLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * Math.PI / 180);
  const y = cy + radius * Math.sin(-midAngle * Math.PI / 180);
  return percent > 0.04 ? (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight="bold">
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  ) : null;
};

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function SeriesLineChart({ data, columns, format, height }: {
  data: any[];
  columns: SeriesColumn[];
  format: (v: number) => string;
  height: number;
}) {
  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#94a3b8" strokeOpacity={0.3} />
          <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
          <YAxis
            tick={{ fontSize: 12, fill: "#64748b" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(val) => compact.format(val)}
          />
          <Tooltip content={<LineTooltip format={format} />} />
          <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "20px" }} />
          {columns.map(c => (
            <Line key={c.key} type="monotone" dataKey={c.key} name={c.label} stroke={c.color} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

interface PieDatum { key: string; name: string; value: number; color: string; percentage: number }

function DistributionPie({ title, data, format }: { title: string; data: PieDatum[]; format: (v: number) => string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-center text-lg font-bold text-slate-800">{title}</h2>
      <div className="h-[280px] w-full">
        {data.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-400">Sin datos en el período</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} labelLine={false} label={renderPieLabel}>
                {data.map((entry) => <Cell key={entry.key} fill={entry.color} />)}
              </Pie>
              <Tooltip content={<PieTooltip format={format} />} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

function withPercentages(items: Omit<PieDatum, "percentage">[]): PieDatum[] {
  const total = items.reduce((acc, d) => acc + d.value, 0);
  return items.map(d => ({ ...d, percentage: total > 0 ? (d.value / total) * 100 : 0 }));
}

function SelectBox({ label, value, onChange, options }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
      <div className="flex items-center gap-1.5">
        <Calendar className="h-3 w-3 text-slate-500" />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</span>
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-0.5 cursor-pointer bg-transparent text-sm font-semibold tabular-nums text-slate-800 outline-none"
      >
        {options.map(o => (
          <option key={o.value} value={o.value} style={{ color: "black", backgroundColor: "white" }}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function SeriesDashboard({ title, subtitle, endpoint, loadingText, unidad, groupTitles }: SeriesDashboardProps) {
  const [data, setData] = useState<SeriesRow[] | null>(null);
  const [columns, setColumns] = useState<SeriesColumn[]>([]);
  const [groups, setGroups] = useState<SeriesGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [moneda, setMoneda] = useState<Moneda>("USD");
  const [dateStart, setDateStart] = useState<string>("ALL");
  const [dateEnd, setDateEnd] = useState<string>("ALL");
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        const res = await fetch(endpoint, { cache: "no-store" });
        const json = await res.json().catch(() => null);
        if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
        if (cancelled) return;

        // Colores en el orden en que llegan las columnas del sheet
        const coloredCols: SeriesColumn[] = (json.columns as Omit<SeriesColumn, "color">[]).map((col, idx) => ({
          ...col,
          color: colorFor(idx),
        }));

        setColumns(coloredCols);
        setGroups(json.groups || []);
        setData(json.data);
        setVisibleColumns(Object.fromEntries(coloredCols.map(c => [c.key, true])));
        setError(null);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [endpoint]);

  const format = useMemo(() => makeFormatter(unidad, moneda), [unidad, moneda]);

  const availableDates = useMemo(() => {
    if (!data) return [];
    const ds = new Map<string, string>();
    data.forEach(d => {
      const val = d.fecha.substring(0, 7); // YYYY-MM
      if (!ds.has(val)) ds.set(val, `${d.mes.substring(0, 3)} ${d.ano}`);
    });
    return Array.from(ds.entries()).map(([value, label]) => ({ value, label })).sort((a, b) => a.value.localeCompare(b.value));
  }, [data]);

  const rangoInvalido = dateStart !== "ALL" && dateEnd !== "ALL" && dateStart > dateEnd;

  const chartData = useMemo(() => {
    if (!data) return [];
    const filtered = data.filter(d => {
      const dVal = d.fecha.substring(0, 7);
      return (dateStart === "ALL" || dVal >= dateStart) && (dateEnd === "ALL" || dVal <= dateEnd);
    });
    // Conversión de moneda (solo aplica a montos)
    return filtered.map(row => {
      const multiplier = unidad === "moneda" && moneda === "BOB" ? row.tc : 1;
      const newRow: Record<string, string | number> = { name: `${row.mes.substring(0, 3)} ${row.ano}` };
      columns.forEach(c => {
        newRow[c.key] = ((row[c.key] as number) || 0) * multiplier;
      });
      return newRow;
    });
  }, [data, dateStart, dateEnd, moneda, columns, unidad]);

  const activeColumns = useMemo(() => columns.filter(c => visibleColumns[c.key]), [columns, visibleColumns]);

  const totals = useMemo(() => {
    const t: Record<string, number> = {};
    activeColumns.forEach(c => {
      t[c.key] = chartData.reduce((acc, row) => acc + ((row[c.key] as number) || 0), 0);
    });
    return t;
  }, [chartData, activeColumns]);

  const pieFor = (cols: SeriesColumn[]) =>
    withPercentages(
      cols
        .filter(c => totals[c.key] > 0)
        .map(c => ({ key: c.key, name: c.label, value: totals[c.key], color: c.color }))
    );

  const toggleColumn = (key: string) => setVisibleColumns(prev => ({ ...prev, [key]: !prev[key] }));

  if (loading && !data) {
    return (
      <div className="flex h-[60vh] items-center justify-center text-slate-500">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        {loadingText}
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

  const dateOptions = [{ value: "ALL", label: "Todo" }, ...availableDates];
  const groupsWithColumns = groups.filter(g => columns.some(c => c.group === g.id));

  return (
    <div className="space-y-6 p-6 lg:p-8">
      {/* Header & Filtros */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">{title}</h1>
          <p className="mt-1 text-sm font-semibold uppercase tracking-wider text-blue-700">{subtitle}</p>
        </div>

        <div className="flex flex-col flex-wrap gap-3 sm:flex-row sm:items-end">
          <SelectBox label="Desde" value={dateStart} onChange={setDateStart} options={dateOptions} />
          <SelectBox label="Hasta" value={dateEnd} onChange={setDateEnd} options={dateOptions} />

          {unidad === "moneda" && (
            <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
              <div className="flex items-center gap-1.5">
                <Coins className="h-3 w-3 text-slate-500" />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Moneda (TC Paralelo)
                </span>
              </div>
              <div className="mt-1 inline-flex rounded-md bg-slate-100 p-0.5">
                <button
                  onClick={() => setMoneda("BOB")}
                  className={cn(
                    "rounded px-3 py-1 text-xs font-semibold tabular-nums transition-colors",
                    moneda === "BOB" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
                  )}
                >
                  Bs.
                </button>
                <button
                  onClick={() => setMoneda("USD")}
                  className={cn(
                    "rounded px-3 py-1 text-xs font-semibold tabular-nums transition-colors",
                    moneda === "USD" ? "bg-white text-emerald-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
                  )}
                >
                  USD
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {rangoInvalido && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          La fecha &quot;Desde&quot; es posterior a &quot;Hasta&quot;: no hay meses en el rango seleccionado.
        </div>
      )}

      {columns.length === 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          No se encontraron columnas para este módulo en la hoja P&amp;L.
        </div>
      )}

      {/* Gráfico 1: General (todas las columnas con selector) */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <h2 className="text-lg font-bold text-slate-800">Evolución General</h2>

          <div className="max-w-sm rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="mb-2 flex items-center gap-2">
              <Filter className="h-4 w-4 text-slate-500" />
              <span className="text-xs font-semibold uppercase text-slate-600">Filtrar Columnas</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {columns.map(c => (
                <button
                  key={c.key}
                  onClick={() => toggleColumn(c.key)}
                  className={cn(
                    "rounded border px-2 py-1 text-[10px] font-semibold transition-colors",
                    visibleColumns[c.key]
                      ? "border-slate-800 bg-slate-800 text-white"
                      : "border-slate-200 bg-white text-slate-400 hover:bg-slate-100"
                  )}
                  style={visibleColumns[c.key] ? { backgroundColor: c.color, borderColor: c.color } : {}}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <SeriesLineChart data={chartData} columns={activeColumns} format={format} height={400} />
      </div>

      {/* Un gráfico por grupo */}
      {groupsWithColumns.length > 0 && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          {groupsWithColumns.map(g => (
            <div key={g.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-lg font-bold text-slate-800">{groupTitles(g).line}</h2>
              <SeriesLineChart
                data={chartData}
                columns={activeColumns.filter(c => c.group === g.id)}
                format={format}
                height={350}
              />
            </div>
          ))}
        </div>
      )}

      {/* Tortas de distribución */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        <DistributionPie title="Distribución General" data={pieFor(activeColumns)} format={format} />
        {groupsWithColumns.map(g => (
          <DistributionPie
            key={g.id}
            title={groupTitles(g).pie}
            data={pieFor(activeColumns.filter(c => c.group === g.id))}
            format={format}
          />
        ))}
      </div>
    </div>
  );
}
