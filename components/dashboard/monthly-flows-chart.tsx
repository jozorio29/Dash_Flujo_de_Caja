"use client";

import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
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

export function MonthlyFlowsChart({ data }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Flujos Mensuales</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 20, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="label" stroke="#94a3b8" fontSize={11} tickLine={false} />
              <YAxis tickFormatter={compact} stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} width={60} />
              <Tooltip
                contentStyle={{ background: "#0f172a", border: "none", borderRadius: 8, color: "white", fontSize: 12 }}
                formatter={(value: number, name: string) => [formatCurrency(value), name]}
              />
              <Legend
                verticalAlign="top"
                align="left"
                iconType="circle"
                wrapperStyle={{ paddingBottom: 8, fontSize: 12 }}
              />
              <Bar dataKey="ingresos" name="Ingresos" fill="#2563EB" radius={[4, 4, 0, 0]} barSize={22}>
                <LabelList dataKey="ingresos" position="top" formatter={compact as any} fontSize={10} fill="#1e3a8a" />
              </Bar>
              <Bar dataKey="egresos" name="Egresos" fill="#EF4444" radius={[4, 4, 0, 0]} barSize={22}>
                <LabelList dataKey="egresos" position="top" formatter={compact as any} fontSize={10} fill="#991b1b" />
              </Bar>
              <Line
                type="monotone"
                dataKey="netFlow"
                name="Net Flow"
                stroke="#10B981"
                strokeWidth={2}
                dot={{ r: 4, fill: "#10B981" }}
              >
                <LabelList dataKey="netFlow" position="top" formatter={compact as any} fontSize={10} fill="#065f46" />
              </Line>
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
