"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceDot,
} from "recharts";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { DailyBalance } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

interface Props {
  data: DailyBalance[];
}

function formatTickDate(d: string) {
  const date = new Date(d);
  const months = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  return `${months[date.getMonth()]} ${date.getFullYear()}`;
}

function formatYAxis(v: number) {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `$${(v / 1_000_000).toFixed(0)}M`;
  if (abs >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v}`;
}

export function DailyBalanceChart({ data }: Props) {
  const last = data[data.length - 1];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Evolución del Saldo Diario</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
              <defs>
                <linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#1E3A8A" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#1E3A8A" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={formatTickDate}
                stroke="#94a3b8"
                fontSize={11}
                tickLine={false}
                interval="preserveStartEnd"
                minTickGap={50}
              />
              <YAxis
                tickFormatter={formatYAxis}
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
                labelStyle={{ color: "#cbd5e1" }}
                formatter={(value: number) => [formatCurrency(value), "Saldo"]}
                labelFormatter={(d) => new Date(d).toLocaleDateString("es-PE")}
              />
              <Line
                type="monotone"
                dataKey="saldo"
                stroke="#1E3A8A"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 5, fill: "#1E3A8A" }}
              />
              {last && (
                <ReferenceDot
                  x={last.date}
                  y={last.saldo}
                  r={5}
                  fill="#1E3A8A"
                  stroke="white"
                  strokeWidth={2}
                  label={{
                    value: formatCurrency(last.saldo),
                    position: "top",
                    fill: "#0f172a",
                    fontSize: 11,
                    fontWeight: 600,
                  }}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
