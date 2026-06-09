"use client";

import { MousePointerClick, Tags } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CategorySummary, Movement } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";
import type { Moneda } from "./header";

interface Props {
  category: CategorySummary | null;
  movements: Movement[];
  moneda: Moneda;
}

function rateAt(movement: Movement): number {
  if (!movement.saldo || !movement.saldoUsd) return 0;
  return movement.saldoUsd / movement.saldo;
}

export function ExpenseCategoryDetail({
  category,
  movements,
  moneda,
}: Props) {
  const isUsd = moneda === "USD";
  const fmt = (value: number) =>
    isUsd
      ? formatCurrency(value, { symbol: "$", decimals: 2 })
      : formatCurrency(value, { symbol: "Bs " });

  if (!category) {
    return (
      <Card className="h-full">
        <CardContent className="flex min-h-[260px] flex-col items-center justify-center text-center">
          <MousePointerClick className="mb-3 h-7 w-7 text-slate-400" />
          <p className="text-sm font-semibold text-slate-700">Selecciona una categoría</p>
          <p className="mt-1 max-w-[240px] text-xs text-slate-500">
            Haz clic en una porción del gráfico para ver el detalle de sus gastos.
          </p>
        </CardContent>
      </Card>
    );
  }

  const categoryMovements = movements.filter(
    (movement) => movement.debitos > 0 && movement.categoria === category.categoria,
  );
  const total = isUsd ? category.totalEgresosUsd : category.totalEgresos;
  const grouped = new Map<string, { label: string; value: number; count: number }>();

  for (const movement of categoryMovements) {
    const label = movement.descPL.trim() || "Sin detalle";
    const key = label.toLocaleLowerCase("es");
    const current = grouped.get(key) ?? { label, value: 0, count: 0 };
    current.value += isUsd ? movement.debitos * rateAt(movement) : movement.debitos;
    current.count += 1;
    grouped.set(key, current);
  }

  const details = Array.from(grouped.values()).sort((a, b) => b.value - a.value);

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle>{category.categoria}</CardTitle>
          <Tags className="h-4 w-4 text-slate-400" />
        </div>
        <p className="mt-0.5 text-xs text-slate-500">
          Principales detalles agrupados por concepto
        </p>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <th className="pb-3 pr-4 text-left">Detalle</th>
                <th className="pb-3 pr-4 text-center">Movimientos</th>
                <th className="pb-3 pr-4 text-right">Participación</th>
                <th className="pb-3 text-right">Valor</th>
              </tr>
            </thead>
            <tbody>
              {details.map((detail) => (
                <tr
                  key={detail.label}
                  className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60"
                >
                  <td className="py-3 pr-4 font-medium text-slate-700">{detail.label}</td>
                  <td className="py-3 pr-4 text-center tabular-nums text-slate-600">
                    {detail.count}
                  </td>
                  <td className="py-3 pr-4 text-right tabular-nums text-slate-600">
                    {total === 0 ? "0.0%" : `${((detail.value / total) * 100).toFixed(1)}%`}
                  </td>
                  <td className="py-3 text-right tabular-nums font-semibold text-slate-800">
                    {fmt(detail.value)}
                  </td>
                </tr>
              ))}
              <tr className="border-t-2 border-slate-300 bg-slate-50/60 font-semibold">
                <td className="py-3 pr-4 text-slate-700">Total</td>
                <td className="py-3 pr-4 text-center tabular-nums text-slate-600">
                  {categoryMovements.length}
                </td>
                <td className="py-3 pr-4 text-right tabular-nums text-slate-600">100.0%</td>
                <td className="py-3 text-right tabular-nums text-slate-900">
                  {fmt(total)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
