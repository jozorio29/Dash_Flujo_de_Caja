"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceDot,
} from "recharts";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { SaldoSeriesPoint } from "@/lib/types";
import { formatCurrency, monthLabel } from "@/lib/utils";

interface Props {
  data: SaldoSeriesPoint[];
  cutoffMonth: string | null; // yyyy-mm donde termina lo "real"
  /** Nivel mínimo de saldo en Bs (línea horizontal de referencia). Opcional. */
  nivelMinimo?: number;
}

function compactBs(v: number): string {
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}Bs ${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}Bs ${(abs / 1_000).toFixed(0)}K`;
  return `${sign}Bs ${abs}`;
}

export function SaldoRealVsProyectadoChart({
  data,
  cutoffMonth,
  nivelMinimo,
}: Props) {
  // Punto en la línea de corte: el último valor real
  const cutoffPoint = cutoffMonth
    ? data.find((d) => d.month === cutoffMonth)
    : undefined;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Datos Históricos (Real)</CardTitle>
        <p className="mt-1 text-xs font-normal text-slate-500">
          Evolución del Saldo de Caja (Real vs Proyectado)
        </p>
      </CardHeader>
      <CardContent>
        <div className="h-[340px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={data}
              margin={{ top: 24, right: 30, left: 10, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis
                dataKey="label"
                stroke="#94a3b8"
                fontSize={11}
                tickLine={false}
                interval="preserveStartEnd"
                minTickGap={30}
              />
              <YAxis
                tickFormatter={compactBs}
                stroke="#94a3b8"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                width={75}
              />
              <Tooltip
                contentStyle={{
                  background: "#0f172a",
                  border: "none",
                  borderRadius: 8,
                  color: "white",
                  fontSize: 12,
                }}
                formatter={(value: any, name) => {
                  if (value === null || value === undefined) return ["—", String(name)];
                  return [formatCurrency(Number(value), { symbol: "Bs " }), String(name)];
                }}
              />
              <Legend
                verticalAlign="top"
                align="left"
                iconType="line"
                wrapperStyle={{ paddingBottom: 10, fontSize: 12 }}
              />

              {/* Línea de corte vertical (boundary entre real y proyectado) */}
              {cutoffMonth && cutoffPoint && (
                <ReferenceLine
                  x={cutoffPoint.label}
                  stroke="#dc2626"
                  strokeDasharray="3 3"
                  label={{
                    value: `Corte: ${monthLabel(cutoffMonth)}`,
                    position: "top",
                    fill: "#dc2626",
                    fontSize: 11,
                    fontWeight: 600,
                  }}
                />
              )}

              {/* Nivel mínimo (opcional) */}
              {typeof nivelMinimo === "number" && (
                <ReferenceLine
                  y={nivelMinimo}
                  stroke="#64748b"
                  strokeDasharray="2 4"
                  label={{
                    value: `Nivel Mínimo ${compactBs(nivelMinimo)}`,
                    position: "right",
                    fill: "#64748b",
                    fontSize: 10,
                  }}
                />
              )}

              {/* Línea REAL (continua, azul corporativo) */}
              <Line
                type="monotone"
                dataKey="real"
                name="Real"
                stroke="#1E3A8A"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 5, fill: "#1E3A8A" }}
                connectNulls={false}
              />
              {/* Línea PROYECTADO (punteada) */}
              <Line
                type="monotone"
                dataKey="proyectado"
                name="Proyectado"
                stroke="#6366f1"
                strokeWidth={2}
                strokeDasharray="6 4"
                dot={false}
                activeDot={{ r: 5, fill: "#6366f1" }}
                connectNulls={false}
              />

              {/* Marcador en el corte */}
              {cutoffPoint && cutoffPoint.real !== null && (
                <ReferenceDot
                  x={cutoffPoint.label}
                  y={cutoffPoint.real}
                  r={5}
                  fill="#1E3A8A"
                  stroke="white"
                  strokeWidth={2}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
