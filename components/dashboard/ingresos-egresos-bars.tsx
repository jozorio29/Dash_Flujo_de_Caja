"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { MonthlyFlow } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";
import type { Moneda } from "./header";

interface Props {
  data: MonthlyFlow[];
  moneda: Moneda;
}

function compact(v: number, symbol: string) {
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}${symbol}${(abs / 1_000_000).toFixed(0)} M`;
  if (abs >= 1_000) return `${sign}${symbol}${(abs / 1_000).toFixed(0)}K`;
  return `${sign}${symbol}${Math.round(abs)}`;
}

export function IngresosEgresosBars({ data, moneda }: Props) {
  const isUsd = moneda === "USD";
  const symbol = isUsd ? "$" : "Bs ";
  const chartData = data.map((m) => ({
    month: m.month,
    label: m.label,
    ingresos: isUsd ? m.ingresosUsd : m.ingresos,
    egresos: isUsd ? m.egresosUsd : m.egresos,
  }));

  return (
    <Card>
      <CardHeader className="p-4 pb-2">
        <CardTitle>Comparativo Ingresos vs Egresos</CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-0">
        <div className="h-[180px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="label" stroke="#94a3b8" fontSize={11} tickLine={false} />
              <YAxis
                tickFormatter={(v) => compact(v, symbol)}
                stroke="#94a3b8"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                width={60}
              />
              <Tooltip
                contentStyle={{
                  background: "#0f172a",
                  border: "none",
                  borderRadius: 8,
                  color: "white",
                  fontSize: 12,
                }}
                formatter={(value: any, name: any) => [
                  isUsd
                    ? formatCurrency(Number(value), { symbol: "$", decimals: 2 })
                    : formatCurrency(Number(value), { symbol: "Bs " }),
                  String(name),
                ]}
              />
              <Legend
                verticalAlign="top"
                align="left"
                iconType="circle"
                wrapperStyle={{ paddingBottom: 6, fontSize: 11 }}
              />
              <Bar dataKey="ingresos" name="Ingresos" fill="#10B981" radius={[3, 3, 0, 0]} />
              <Bar dataKey="egresos" name="Egresos" fill="#EF4444" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
