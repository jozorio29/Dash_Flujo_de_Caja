"use client";

import { Calendar } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ProjectedMovement } from "@/lib/types";
import { formatCurrency, cn } from "@/lib/utils";
import type { Moneda } from "./header";

interface Props {
  movements: ProjectedMovement[];
  moneda: Moneda;
  /** Cuántas filas mostrar como máximo. Default 6. */
  limit?: number;
}

function formatDate(d: Date | null): string {
  if (!d) return "—";
  return d.toLocaleDateString("es-PE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/**
 * Listado de Cuentas por Pagar = pagos proyectados con egresos > 0,
 * ordenados por fecha próxima ascendente.
 * Resalta los que vencen pronto (próximos 7 días) en rojo.
 */
export function CuentasPorPagar({ movements, moneda, limit = 6 }: Props) {
  const isUsd = moneda === "USD";
  const fmt = (v: number) =>
    isUsd
      ? formatCurrency(v, { symbol: "$", decimals: 2 })
      : formatCurrency(v, { symbol: "Bs " });

  // Solo egresos con fecha y monto > 0, ordenados por fecha
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const items = movements
    .filter((m) => m.fecha && m.egresos > 0)
    .sort((a, b) => (a.fecha?.getTime() ?? 0) - (b.fecha?.getTime() ?? 0))
    .slice(0, limit);

  const total = movements
    .filter((m) => m.egresos > 0)
    .reduce((s, m) => s + m.egresos, 0);

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle>Cuentas por Pagar</CardTitle>
          <Calendar className="h-4 w-4 text-slate-400" />
        </div>
        <p className="mt-0.5 text-xs text-slate-500">
          Próximos pagos proyectados ordenados por vencimiento
        </p>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="py-6 text-center text-sm text-slate-400">
            Sin pagos proyectados pendientes
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  <th className="pb-2 pr-2 text-left">Proveedor</th>
                  <th className="pb-2 pr-2 text-right">Valor</th>
                  <th className="pb-2 text-right">Vencimiento</th>
                </tr>
              </thead>
              <tbody>
                {items.map((m, i) => {
                  const diasRestantes = m.fecha
                    ? Math.floor((m.fecha.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
                    : 0;
                  const urgente = diasRestantes >= 0 && diasRestantes <= 7;
                  const vencido = diasRestantes < 0;
                  return (
                    <tr
                      key={i}
                      className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60"
                    >
                      <td className="py-2 pr-2 text-slate-700">
                        <div className="max-w-[140px] truncate" title={m.concepto}>
                          {m.concepto || "—"}
                        </div>
                      </td>
                      <td className="py-2 pr-2 text-right tabular-nums font-medium text-slate-800">
                        {fmt(m.egresos)}
                      </td>
                      <td
                        className={cn(
                          "py-2 text-right tabular-nums",
                          vencido
                            ? "font-semibold text-rose-600"
                            : urgente
                            ? "font-semibold text-amber-600"
                            : "text-slate-600"
                        )}
                      >
                        {formatDate(m.fecha)}
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
                    {movements.filter((m) => m.egresos > 0).length} pagos
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
