"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { CategorySummary } from "@/lib/types";
import { formatCurrency, cn } from "@/lib/utils";
import type { Moneda } from "./header";

interface Props {
  categories: CategorySummary[];
  moneda: Moneda;
  selectedCategory: string | null;
  onSelectCategory: (category: string) => void;
}

const COLORS = [
  "#2563EB", // azul
  "#10B981", // verde
  "#F59E0B", // ámbar
  "#EF4444", // rojo
  "#8B5CF6", // violeta
  "#06B6D4", // cyan
  "#EC4899", // rosa
  "#84CC16", // lima
];

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; payload: any }>;
}

export function ExpenseDonut({
  categories,
  moneda,
  selectedCategory,
  onSelectCategory,
}: Props) {
  const isUsd = moneda === "USD";
  const fmt = (v: number) =>
    isUsd
      ? formatCurrency(v, { symbol: "$", decimals: 2 })
      : formatCurrency(v, { symbol: "Bs " });

  const total = categories.reduce(
    (s, c) => s + (isUsd ? c.totalEgresosUsd : c.totalEgresos),
    0,
  );
  const data = categories.map((c) => ({
    name: c.categoria,
    value: isUsd ? c.totalEgresosUsd : c.totalEgresos,
    pct: total === 0 ? 0 : (isUsd ? c.totalEgresosUsd : c.totalEgresos) / total,
  }));

  function CustomTooltip({ active, payload }: TooltipProps) {
    if (!active || !payload || !payload[0]) return null;
    const item = payload[0].payload;
    return (
      <div className="rounded-lg bg-slate-900 px-3 py-2 text-xs text-white shadow-lg">
        <div className="mb-0.5 font-semibold">{item.name}</div>
        <div className="tabular-nums">
          {fmt(item.value)} <span className="text-slate-400">({(item.pct * 100).toFixed(1)}%)</span>
        </div>
      </div>
    );
  }

  if (categories.length === 0 || total === 0) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle>Gastos por Categoría</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-[260px] items-center justify-center text-sm text-slate-400">
            Sin egresos en el período
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Gastos por Categoría</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center gap-4 sm:flex-row lg:flex-col xl:flex-row">
          {/* Donut */}
          <div className="relative h-[200px] w-[200px] shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={88}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {data.map((d, i) => {
                    const selected = d.name === selectedCategory;
                    return (
                      <Cell
                        key={d.name}
                        fill={COLORS[i % COLORS.length]}
                        cursor="pointer"
                        opacity={selectedCategory && !selected ? 0.35 : 1}
                        stroke={selected ? "#0f172a" : "#ffffff"}
                        strokeWidth={selected ? 3 : 1}
                        onClick={() => onSelectCategory(d.name)}
                      />
                    );
                  })}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            {/* Centro */}
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Total Egresos
              </div>
              <div className="mt-0.5 text-sm font-bold tabular-nums text-slate-900">
                {fmt(total)}
              </div>
            </div>
          </div>

          {/* Leyenda */}
          <div className="w-full space-y-1.5">
            {data.map((d, i) => (
              <button
                key={d.name}
                type="button"
                onClick={() => onSelectCategory(d.name)}
                className={cn(
                  "flex w-full items-center justify-between gap-2 rounded-md px-1.5 py-1 text-left text-xs transition-colors",
                  selectedCategory === d.name
                    ? "bg-slate-100 ring-1 ring-slate-200"
                    : "hover:bg-slate-50",
                )}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-sm"
                    style={{ background: COLORS[i % COLORS.length] }}
                  />
                  <span className="truncate text-slate-700" title={d.name}>
                    {d.name}
                  </span>
                </div>
                <span className={cn("shrink-0 tabular-nums font-semibold text-slate-800")}>
                  {(d.pct * 100).toFixed(1)}%
                </span>
              </button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
