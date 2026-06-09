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
  limit?: number;
}

function formatDate(date: Date | null): string {
  if (!date) return "-";
  return date.toLocaleDateString("es-PY", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function rateAt(movement: Movement): number {
  if (!movement.saldo || !movement.saldoUsd) return 0;
  return movement.saldoUsd / movement.saldo;
}

export function ExpenseCategoryDetail({
  category,
  movements,
  moneda,
  limit = 5,
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

  const items = movements
    .filter((movement) => movement.debitos > 0 && movement.categoria === category.categoria)
    .sort((a, b) => {
      const amountA = isUsd ? a.debitos * rateAt(a) : a.debitos;
      const amountB = isUsd ? b.debitos * rateAt(b) : b.debitos;
      return amountB - amountA;
    });

  const displayedItems = items.slice(0, limit);
  const total = isUsd ? category.totalEgresosUsd : category.totalEgresos;

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle>{category.categoria}</CardTitle>
          <Tags className="h-4 w-4 text-slate-400" />
        </div>
        <p className="mt-0.5 text-xs text-slate-500">Detalle de gastos de la categoría seleccionada</p>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                <th className="pb-2 pr-2 text-left">Concepto</th>
                <th className="pb-2 pr-2 text-right">Valor</th>
                <th className="pb-2 text-right">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {displayedItems.map((movement, index) => {
                const value = isUsd
                  ? movement.debitos * rateAt(movement)
                  : movement.debitos;
                const label =
                  movement.detallePL ||
                  movement.descPL ||
                  movement.referencia ||
                  category.categoria;

                return (
                  <tr
                    key={`${movement.fechaHoraMs}-${index}`}
                    className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60"
                  >
                    <td className="py-2 pr-2 text-slate-700">
                      <div className="max-w-[140px] truncate" title={label}>
                        {label}
                      </div>
                    </td>
                    <td className="py-2 pr-2 text-right tabular-nums font-medium text-slate-800">
                      {fmt(value)}
                    </td>
                    <td className="py-2 text-right tabular-nums text-slate-600">
                      {formatDate(movement.fecha)}
                    </td>
                  </tr>
                );
              })}
              <tr className="border-t-2 border-slate-300 bg-slate-50/60 font-semibold">
                <td className="py-2 pr-2 text-slate-700">Total</td>
                <td className="py-2 pr-2 text-right tabular-nums text-slate-900">
                  {fmt(total)}
                </td>
                <td className="py-2 text-right text-[10px] text-slate-500">
                  {items.length} gastos
                </td>
              </tr>
            </tbody>
          </table>
          {items.length > limit && (
            <p className="mt-2 text-right text-[10px] text-slate-400">
              Mostrando los {limit} gastos más elevados
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
