"use client";

import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LabelList,
  ReferenceLine,
} from "recharts";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

export interface WaterfallStep {
  name: string;
  /**
   * Tipo del paso:
   * - "start" / "end" : barra completa desde 0 (saldo inicial / final)
   * - "ingreso"       : suma; barra hacia arriba
   * - "egreso"        : resta; barra hacia abajo
   */
  type: "start" | "ingreso" | "egreso" | "end";
  value: number; // monto absoluto del paso
  cumulative: number; // saldo después de aplicar este paso
}

interface Props {
  steps: WaterfallStep[];
}

function compact(v: number): string {
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(0)}K`;
  return `${sign}$${Math.round(abs)}`;
}

const COLOR = {
  start: "#0B1B3B",
  end: "#0B1B3B",
  ingreso: "#2563EB",
  egreso: "#EF4444",
};

interface ChartDatum {
  name: string;
  type: WaterfallStep["type"];
  /** Tupla [from, to] que recharts pinta como barra entre esos valores */
  bar: [number, number];
  value: number;
  cumulative: number;
  isPositive: boolean;
}

function buildChartData(steps: WaterfallStep[]): ChartDatum[] {
  return steps.map((s, i) => {
    if (s.type === "start") {
      return {
        name: s.name,
        type: s.type,
        bar: [0, s.cumulative],
        value: s.value,
        cumulative: s.cumulative,
        isPositive: s.cumulative >= 0,
      };
    }
    if (s.type === "end") {
      return {
        name: s.name,
        type: s.type,
        bar: [0, s.cumulative],
        value: s.value,
        cumulative: s.cumulative,
        isPositive: s.cumulative >= 0,
      };
    }
    // ingreso / egreso: la barra va del saldo previo al nuevo cumulative
    const prev = i > 0 ? steps[i - 1].cumulative : 0;
    const from = Math.min(prev, s.cumulative);
    const to = Math.max(prev, s.cumulative);
    return {
      name: s.name,
      type: s.type,
      bar: [from, to],
      value: s.value,
      cumulative: s.cumulative,
      isPositive: s.type === "ingreso",
    };
  });
}

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ payload: ChartDatum }>;
}

function CustomTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload || !payload[0]) return null;
  const d = payload[0].payload;
  const label =
    d.type === "ingreso" ? "+" : d.type === "egreso" ? "−" : "";
  return (
    <div className="rounded-lg bg-slate-900 px-3 py-2 text-xs text-white shadow-lg">
      <div className="mb-0.5 font-semibold">{d.name}</div>
      {d.type !== "start" && d.type !== "end" && (
        <div className="text-slate-300">
          Movimiento:{" "}
          <span
            className={`tabular-nums font-medium ${
              d.type === "ingreso" ? "text-emerald-300" : "text-rose-300"
            }`}
          >
            {label}
            {formatCurrency(d.value)}
          </span>
        </div>
      )}
      <div className="text-slate-300">
        Saldo:{" "}
        <span className="tabular-nums font-medium text-white">
          {formatCurrency(d.cumulative)}
        </span>
      </div>
    </div>
  );
}

export function CashFlowWaterfall({ steps }: Props) {
  const data = buildChartData(steps);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Waterfall del Flujo de Efectivo</CardTitle>
        <p className="mt-1 text-xs font-normal text-slate-500">
          Cómo se mueve el dinero del Saldo Inicial al Saldo Final, paso a paso por
          categoría.
        </p>
      </CardHeader>
      <CardContent>
        <div className="h-[360px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: 24, right: 20, left: 0, bottom: 60 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis
                dataKey="name"
                stroke="#94a3b8"
                fontSize={10}
                tickLine={false}
                interval={0}
                angle={-30}
                textAnchor="end"
                height={70}
              />
              <YAxis
                tickFormatter={compact}
                stroke="#94a3b8"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                width={70}
              />
              <ReferenceLine y={0} stroke="#cbd5e1" />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(148,163,184,0.1)" }} />
              <Bar dataKey="bar" radius={[4, 4, 0, 0]} barSize={32}>
                {data.map((d, i) => (
                  <Cell key={i} fill={COLOR[d.type]} />
                ))}
                <LabelList
                  dataKey="value"
                  position="top"
                  formatter={(v: number) => (v ? compact(v) : "")}
                  fontSize={10}
                  fill="#475569"
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
