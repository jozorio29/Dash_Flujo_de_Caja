"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { CategorySummary } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";
import {
  Building2,
  Home,
  Utensils,
  Car,
  HeartPulse,
  Wrench,
  Tag,
  ArrowDown,
  ArrowUp,
} from "lucide-react";

interface Props {
  categories: CategorySummary[];
}

function getIcon(name: string) {
  const n = name.toLowerCase();
  if (/transferenc/i.test(n)) return Building2;
  if (/hogar|vivienda/i.test(n)) return Home;
  if (/aliment|comida|food/i.test(n)) return Utensils;
  if (/transp|gasolina|combust/i.test(n)) return Car;
  if (/salud|medic|farmac/i.test(n)) return HeartPulse;
  if (/serv/i.test(n)) return Wrench;
  return Tag;
}

function Sparkline({ data, color = "#EF4444" }: { data: number[]; color?: string }) {
  if (!data.length) return <div className="h-6 w-32" />;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const w = 120;
  const h = 28;
  const stepX = w / Math.max(data.length - 1, 1);
  const points = data
    .map((v, i) => `${(i * stepX).toFixed(2)},${(h - ((v - min) / range) * h).toFixed(2)}`)
    .join(" ");

  return (
    <svg width={w} height={h} className="overflow-visible">
      <polyline points={points} fill="none" stroke={color} strokeWidth={1.5} />
      {data.map((v, i) => (
        <circle
          key={i}
          cx={i * stepX}
          cy={h - ((v - min) / range) * h}
          r={1.8}
          fill={color}
        />
      ))}
    </svg>
  );
}

function PercentBar({ pct }: { pct: number }) {
  const width = `${Math.min(Math.max(pct * 100, 0), 100).toFixed(1)}%`;
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-rose-100">
        <div className="h-full rounded-full bg-rose-500" style={{ width }} />
      </div>
      <span className="tabular-nums text-rose-600">{(pct * 100).toFixed(1)}%</span>
    </div>
  );
}

export function CategoryTable({ categories }: Props) {
  const total = categories.reduce((a, b) => a + b.totalEgresos, 0);
  const promedioTotal = categories.reduce((a, b) => a + b.promedioMensual, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Principales Categorías de Egresos</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
                <th className="py-2 pr-4 text-left font-semibold">Categoría</th>
                <th className="py-2 pr-4 text-right font-semibold">Total Egresos</th>
                <th className="py-2 pr-4 text-right font-semibold">% del Total</th>
                <th className="py-2 pr-4 text-right font-semibold">Promedio Mensual</th>
                <th className="py-2 pr-4 text-left font-semibold">Evolución Mensual</th>
                <th className="py-2 pr-4 text-right font-semibold">Var. vs Prom.</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((c) => {
                const Icon = getIcon(c.categoria);
                const variation = c.variacionVsPromedio;
                const positive = variation >= 0;
                return (
                  <tr key={c.categoria} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-100 text-slate-600">
                          <Icon className="h-3.5 w-3.5" />
                        </div>
                        <span className="font-medium text-slate-800">{c.categoria}</span>
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-right font-semibold tabular-nums text-rose-600">
                      {formatCurrency(c.totalEgresos)}
                    </td>
                    <td className="py-3 pr-4">
                      <div className="flex justify-end">
                        <PercentBar pct={c.porcentajeTotal} />
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-right tabular-nums text-slate-700">
                      {formatCurrency(c.promedioMensual)}
                    </td>
                    <td className="py-3 pr-4">
                      <Sparkline data={c.evolucion.map((e) => e.value)} />
                    </td>
                    <td className="py-3 pr-4 text-right">
                      <div className="flex items-center justify-end gap-1 tabular-nums">
                        <span className={positive ? "text-rose-600" : "text-emerald-600"}>
                          {positive ? "+" : ""}
                          {(variation * 100).toFixed(1)}%
                        </span>
                        {positive ? (
                          <ArrowUp className="h-3.5 w-3.5 text-rose-600" />
                        ) : (
                          <ArrowDown className="h-3.5 w-3.5 text-emerald-600" />
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              <tr className="border-t-2 border-slate-300 bg-slate-50/80 font-semibold">
                <td className="py-3 pr-4 text-slate-800">Total</td>
                <td className="py-3 pr-4 text-right tabular-nums text-slate-900">
                  {formatCurrency(total)}
                </td>
                <td className="py-3 pr-4 text-right tabular-nums text-slate-900">100,0%</td>
                <td className="py-3 pr-4 text-right tabular-nums text-slate-900">
                  {formatCurrency(promedioTotal)}
                </td>
                <td className="py-3 pr-4" />
                <td className="py-3 pr-4" />
              </tr>
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
