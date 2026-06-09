"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { MonthlyFlow } from "@/lib/types";
import { formatCurrency, monthLabel } from "@/lib/utils";
import type { Moneda } from "./header";

interface Props {
  monthlyFlows: MonthlyFlow[];
  saldoInicial: number;
  moneda: Moneda;
}

function compact(v: number, symbol: string) {
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}${symbol}${(abs / 1_000_000).toFixed(0)} M`;
  if (abs >= 1_000) return `${sign}${symbol}${(abs / 1_000).toFixed(0)}K`;
  return `${sign}${symbol}${Math.round(abs)}`;
}

export function SaldoTrendArea({ monthlyFlows, saldoInicial, moneda }: Props) {
  const isUsd = moneda === "USD";
  const symbol = isUsd ? "$" : "Bs ";

  // Construir saldo acumulado mes a mes
  let cum = saldoInicial;
  const data = monthlyFlows.map((m) => {
    cum += isUsd ? m.netFlowUsd : m.netFlow;
    return {
      month: m.month,
      label: monthLabel(m.month),
      saldo: cum,
    };
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Saldo Acumulado (Tendencia)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[200px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="saldoArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2563EB" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#2563EB" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="label" stroke="#94a3b8" fontSize={11} tickLine={false} />
              <YAxis
                tickFormatter={(v) => compact(v, symbol)}
                stroke="#94a3b8"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                width={70}
              />
              <Tooltip
                contentStyle={{
                  background: "#0f172a",
                  border: "none",
                  borderRadius: 8,
                  color: "white",
                  fontSize: 12,
                }}
                formatter={(value: any) => [
                  isUsd
                    ? formatCurrency(Number(value), { symbol: "$", decimals: 2 })
                    : formatCurrency(Number(value), { symbol: "Bs " }),
                  "Saldo",
                ]}
              />
              <Area
                type="monotone"
                dataKey="saldo"
                stroke="#2563EB"
                strokeWidth={2.5}
                fill="url(#saldoArea)"
                dot={{ r: 3, fill: "#2563EB" }}
                activeDot={{ r: 5 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
