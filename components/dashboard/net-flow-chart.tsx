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
  ReferenceLine,
  LabelList,
} from "recharts";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { MonthlyFlow } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

interface Props {
  data: MonthlyFlow[];
}

function compact(v: number) {
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(0)}K`;
  return `${sign}$${abs}`;
}

export function NetFlowChart({ data }: Props) {
  // Agregamos una barra "Total" al final
  const total = data.reduce((a, b) => a + b.netFlow, 0);
  const dataWithTotal = [
    ...data,
    {
      month: "TOTAL",
      label: "Total",
      ingresos: 0,
      egresos: 0,
      netFlow: total,
      ingresosUsd: 0,
      egresosUsd: 0,
      netFlowUsd: 0,
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Net Flow Mensual</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dataWithTotal} margin={{ top: 20, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="label" stroke="#94a3b8" fontSize={11} tickLine={false} />
              <YAxis tickFormatter={compact} stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} width={60} />
              <ReferenceLine y={0} stroke="#cbd5e1" />
              <Tooltip
                contentStyle={{ background: "#0f172a", border: "none", borderRadius: 8, color: "white", fontSize: 12 }}
                formatter={(value: number) => [formatCurrency(value), "Net Flow"]}
              />
              <Bar dataKey="netFlow" radius={[4, 4, 0, 0]} barSize={36}>
                {dataWithTotal.map((entry, idx) => (
                  <Cell
                    key={idx}
                    fill={
                      entry.month === "TOTAL"
                        ? "#0B1B3B"
                        : entry.netFlow >= 0
                        ? "#10B981"
                        : "#EF4444"
                    }
                  />
                ))}
                <LabelList dataKey="netFlow" position="top" formatter={compact as any} fontSize={10} fill="#0f172a" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
