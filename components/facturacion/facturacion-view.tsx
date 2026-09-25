"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, AlertTriangle, Coins, Calendar, Filter } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { cn } from "@/lib/utils";

interface FacturacionRow {
  ano: number;
  mes: string;
  tigoBolivia: number;
  tigoUruguayCC: number;
  tigoUruguayTM: number;
  tigoUruguayCapCC: number;
  tigoUruguayCapTV: number;
  tigoUruguayCapPort: number;
  tigoOtros: number;
  alquilerPos: number;
  alquilerSala: number;
  alquilerZen: number;
  tc: number;
  fecha: string; // From API it's string
}

type Moneda = "USD" | "BOB";

const CustomTooltip = ({ active, payload, label, moneda }: any) => {
  if (active && payload && payload.length) {
    const total = payload.reduce((sum: number, entry: any) => sum + entry.value, 0);
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-lg">
        <p className="mb-2 font-bold text-slate-800">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex justify-between gap-4 text-sm mb-1" style={{ color: entry.color }}>
            <span>{entry.name}:</span>
            <span className="font-medium">
              {new Intl.NumberFormat("es-BO", { style: "currency", currency: moneda }).format(entry.value)}
            </span>
          </div>
        ))}
        <div className="mt-2 border-t pt-2 flex justify-between gap-4 text-sm font-bold text-slate-800">
          <span>Total:</span>
          <span>
            {new Intl.NumberFormat("es-BO", { style: "currency", currency: moneda }).format(total)}
          </span>
        </div>
      </div>
    );
  }
  return null;
};

const PieTooltip = ({ active, payload, moneda }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-lg">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: data.color }}></div>
          <p className="font-bold text-slate-800">{data.name}</p>
        </div>
        <div className="flex justify-between gap-4 text-sm">
          <span className="font-medium text-slate-600">
            {new Intl.NumberFormat("es-BO", { style: "currency", currency: moneda }).format(data.value)}
          </span>
          <span className="font-bold text-slate-800">
            {data.percentage ? `${data.percentage.toFixed(1)}%` : ""}
          </span>
        </div>
      </div>
    );
  }
  return null;
};

const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * Math.PI / 180);
  const y = cy + radius * Math.sin(-midAngle * Math.PI / 180);

  return percent > 0.04 ? (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight="bold">
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  ) : null;
};

const COLUMNS = [
  { key: "tigoBolivia", label: "TIGO Bolivia (e-care)", color: "#2563eb" }, // blue-600
  { key: "tigoUruguayCC", label: "TIGO Uruguay (Call center)", color: "#16a34a" }, // green-600
  { key: "tigoUruguayTM", label: "TIGO Uruguay (telemarketing)", color: "#dc2626" }, // red-600
  { key: "tigoUruguayCapCC", label: "TIGO Uruguay Call center Cap", color: "#d97706" }, // amber-600
  { key: "tigoUruguayCapTV", label: "TIGO Uruguay Televentas Cap", color: "#9333ea" }, // purple-600
  { key: "tigoUruguayCapPort", label: "TIGO Uruguay Portabilidad Cap", color: "#0891b2" }, // cyan-600
  { key: "tigoOtros", label: "TIGO Otros servicios", color: "#4f46e5" }, // indigo-600
  { key: "alquilerPos", label: "Alquiler Tupperware pos. trabajo", color: "#db2777" }, // pink-600
  { key: "alquilerSala", label: "Alquiler Tupperware sala cap.", color: "#ea580c" }, // orange-600
  { key: "alquilerZen", label: "Alquiler Torre Zen Piso 2 pos.", color: "#059669" }, // emerald-600
];

const COLUMNS_SERVICIOS = COLUMNS.slice(0, 7);
const COLUMNS_ALQUILERES = COLUMNS.slice(7, 10);

export function FacturacionView() {
  const [data, setData] = useState<FacturacionRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [moneda, setMoneda] = useState<Moneda>("USD");
  const [dateStart, setDateStart] = useState<string>("ALL");
  const [dateEnd, setDateEnd] = useState<string>("ALL");
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(
    Object.fromEntries(COLUMNS.map(c => [c.key, true]))
  );

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        const res = await fetch("/api/facturacion", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (cancelled) return;
        setData(json.data);
        setError(null);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const availableDates = useMemo(() => {
    if (!data) return [];
    const ds = new Map<string, string>();
    data.forEach(d => {
      const val = d.fecha.substring(0, 7); // YYYY-MM
      const label = `${d.mes.substring(0, 3)} ${d.ano}`;
      if (!ds.has(val)) ds.set(val, label);
    });
    return Array.from(ds.entries()).map(([value, label]) => ({ value, label })).sort((a, b) => a.value.localeCompare(b.value));
  }, [data]);

  const filteredAndConvertedData = useMemo(() => {
    if (!data) return [];

    // Filtro por fechas
    let filtered = data;
    if (dateStart !== "ALL" || dateEnd !== "ALL") {
      filtered = data.filter(d => {
        const dVal = d.fecha.substring(0, 7);
        const passStart = dateStart === "ALL" || dVal >= dateStart;
        const passEnd = dateEnd === "ALL" || dVal <= dateEnd;
        return passStart && passEnd;
      });
    }

    // Conversión de moneda
    return filtered.map(row => {
      const multiplier = moneda === "BOB" ? row.tc : 1;
      const newRow: any = {
        name: `${row.mes.substring(0, 3)} ${row.ano}`,
      };
      COLUMNS.forEach(c => {
        newRow[c.key] = (row as any)[c.key] * multiplier;
      });
      return newRow;
    });
  }, [data, dateStart, dateEnd, moneda]);

  const pieDataGlobal = useMemo(() => {
    const totals: Record<string, number> = {};
    let grandTotal = 0;
    COLUMNS.forEach(c => totals[c.key] = 0);
    filteredAndConvertedData.forEach(row => {
      COLUMNS.forEach(c => {
        if (visibleColumns[c.key]) {
          totals[c.key] += (row[c.key] || 0);
        }
      });
    });
    const result = COLUMNS.filter(c => visibleColumns[c.key] && totals[c.key] > 0).map(c => {
      grandTotal += totals[c.key];
      return {
        name: c.label,
        value: totals[c.key],
        color: c.color
      };
    });
    return result.map(d => ({ ...d, percentage: grandTotal > 0 ? (d.value / grandTotal) * 100 : 0 }));
  }, [filteredAndConvertedData, visibleColumns]);

  const pieDataServicios = useMemo(() => {
    const filtered = pieDataGlobal.filter(d => COLUMNS_SERVICIOS.some(c => c.label === d.name));
    const total = filtered.reduce((acc, curr) => acc + curr.value, 0);
    return filtered.map(d => ({ ...d, percentage: total > 0 ? (d.value / total) * 100 : 0 }));
  }, [pieDataGlobal]);

  const pieDataAlquileres = useMemo(() => {
    const filtered = pieDataGlobal.filter(d => COLUMNS_ALQUILERES.some(c => c.label === d.name));
    const total = filtered.reduce((acc, curr) => acc + curr.value, 0);
    return filtered.map(d => ({ ...d, percentage: total > 0 ? (d.value / total) * 100 : 0 }));
  }, [pieDataGlobal]);

  const toggleColumn = (key: string) => {
    setVisibleColumns(prev => ({ ...prev, [key]: !prev[key] }));
  };

  if (loading && !data) {
    return (
      <div className="flex h-[60vh] items-center justify-center text-slate-500">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Cargando facturación…
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
        <pre className="mt-3 text-sm">{error}</pre>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 lg:p-8">
      {/* Header & Filtros */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
            Facturación
          </h1>
          <p className="mt-1 text-sm font-semibold uppercase tracking-wider text-blue-700">
            Módulo de ingresos P&L
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end flex-wrap">
          {/* Fecha Inicio */}
          <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3 w-3 text-slate-500" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Desde
              </span>
            </div>
            <select
              value={dateStart}
              onChange={(e) => setDateStart(e.target.value)}
              className="mt-0.5 cursor-pointer bg-transparent text-sm font-semibold tabular-nums text-slate-800 outline-none"
            >
              <option value="ALL" style={{ color: "black", backgroundColor: "white" }}>Todo</option>
              {availableDates.map(d => (
                <option key={d.value} value={d.value} style={{ color: "black", backgroundColor: "white" }}>{d.label}</option>
              ))}
            </select>
          </div>

          {/* Fecha Fin */}
          <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3 w-3 text-slate-500" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Hasta
              </span>
            </div>
            <select
              value={dateEnd}
              onChange={(e) => setDateEnd(e.target.value)}
              className="mt-0.5 cursor-pointer bg-transparent text-sm font-semibold tabular-nums text-slate-800 outline-none"
            >
              <option value="ALL" style={{ color: "black", backgroundColor: "white" }}>Todo</option>
              {availableDates.map(d => (
                <option key={d.value} value={d.value} style={{ color: "black", backgroundColor: "white" }}>{d.label}</option>
              ))}
            </select>
          </div>

          {/* Moneda */}
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
        </div>
      </div>

      {/* Gráfico 1: General (Todas las columnas con selector) */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <h2 className="text-lg font-bold text-slate-800">Evolución General</h2>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 max-w-sm">
            <div className="mb-2 flex items-center gap-2">
              <Filter className="h-4 w-4 text-slate-500" />
              <span className="text-xs font-semibold text-slate-600 uppercase">Filtrar Columnas</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {COLUMNS.map(c => (
                <button
                  key={c.key}
                  onClick={() => toggleColumn(c.key)}
                  className={cn(
                    "rounded px-2 py-1 text-[10px] font-semibold transition-colors border",
                    visibleColumns[c.key]
                      ? "bg-slate-800 text-white border-slate-800"
                      : "bg-white text-slate-400 border-slate-200 hover:bg-slate-100"
                  )}
                  style={visibleColumns[c.key] ? { backgroundColor: c.color, borderColor: c.color } : {}}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="h-[400px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={filteredAndConvertedData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fontSize: 12, fill: '#64748b' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(val) => new Intl.NumberFormat("es-BO", { notation: "compact" }).format(val)}
              />
              <Tooltip content={<CustomTooltip moneda={moneda} />} />
              <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "20px" }} />
              {COLUMNS.map(c => visibleColumns[c.key] && (
                <Line key={c.key} type="monotone" dataKey={c.key} name={c.label} stroke={c.color} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* Gráfico 2: Facturación de Servicios */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-bold text-slate-800">Facturación de Servicios</h2>
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={filteredAndConvertedData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 12, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(val) => new Intl.NumberFormat("es-BO", { notation: "compact" }).format(val)}
                />
                <Tooltip content={<CustomTooltip moneda={moneda} />} />
                <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "20px" }} />
                {COLUMNS_SERVICIOS.map(c => visibleColumns[c.key] && (
                  <Line key={c.key} type="monotone" dataKey={c.key} name={c.label} stroke={c.color} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico 3: Evolución de Alquileres */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-bold text-slate-800">Evolución de Alquileres</h2>
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={filteredAndConvertedData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 12, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(val) => new Intl.NumberFormat("es-BO", { notation: "compact" }).format(val)}
                />
                <Tooltip content={<CustomTooltip moneda={moneda} />} />
                <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "20px" }} />
                {COLUMNS_ALQUILERES.map(c => visibleColumns[c.key] && (
                  <Line key={c.key} type="monotone" dataKey={c.key} name={c.label} stroke={c.color} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Gráficos de Pastel (Distribución) */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {/* Pastel 1: General */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-bold text-slate-800 text-center">Distribución General</h2>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieDataGlobal} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} labelLine={false} label={renderCustomizedLabel}>
                  {pieDataGlobal.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                </Pie>
                <Tooltip content={<PieTooltip moneda={moneda} />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pastel 2: Servicios */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-bold text-slate-800 text-center">Distribución Servicios</h2>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieDataServicios} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} labelLine={false} label={renderCustomizedLabel}>
                  {pieDataServicios.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                </Pie>
                <Tooltip content={<PieTooltip moneda={moneda} />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pastel 3: Alquileres */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-bold text-slate-800 text-center">Distribución Alquileres</h2>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieDataAlquileres} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} labelLine={false} label={renderCustomizedLabel}>
                  {pieDataAlquileres.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                </Pie>
                <Tooltip content={<PieTooltip moneda={moneda} />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

    </div>
  );
}
