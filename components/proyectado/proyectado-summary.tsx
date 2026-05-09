"use client";

import { TrendingUp, TrendingDown, Pause, Wallet } from "lucide-react";
import { ProjectedMovement } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { formatCurrency, cn } from "@/lib/utils";

interface Props {
  movements: ProjectedMovement[];
}

/**
 * Tarjetas resumen del rango filtrado.
 * Stand by se muestra aparte: NO se suma al neto ni al saldo proyectado.
 */
export function ProyectadoSummary({ movements }: Props) {
  const ingresos = movements.reduce((s, m) => s + m.ingresos, 0);
  const egresos = movements.reduce((s, m) => s + m.egresos, 0);
  const standBy = movements.reduce((s, m) => s + m.standBy, 0);
  const neto = ingresos - egresos;

  const cards = [
    {
      title: "Ingresos Proyectados",
      value: formatCurrency(ingresos, { symbol: "Bs " }),
      Icon: TrendingUp,
      bg: "bg-blue-50 text-blue-600",
      titleColor: "text-blue-600",
    },
    {
      title: "Egresos Proyectados",
      value: formatCurrency(egresos, { symbol: "Bs " }),
      Icon: TrendingDown,
      bg: "bg-rose-50 text-rose-600",
      titleColor: "text-rose-600",
    },
    {
      title: "Stand by",
      value: formatCurrency(standBy, { symbol: "Bs " }),
      Icon: Pause,
      bg: "bg-amber-50 text-amber-600",
      titleColor: "text-amber-700",
      footer: "No incluido en el neto",
    },
    {
      title: "Flujo Neto Proyectado",
      value: formatCurrency(neto, { symbol: "Bs " }),
      Icon: Wallet,
      bg: neto >= 0 ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600",
      titleColor: neto >= 0 ? "text-emerald-700" : "text-rose-700",
      negative: neto < 0,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((c) => (
        <Card key={c.title} className="px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div
                className={cn(
                  "text-[11px] font-semibold uppercase tracking-wider",
                  c.titleColor
                )}
              >
                {c.title}
              </div>
              <div
                className={cn(
                  "mt-1 truncate text-2xl font-bold tabular-nums",
                  c.negative ? "text-rose-600" : "text-slate-900"
                )}
                title={c.value}
              >
                {c.value}
              </div>
              {c.footer && (
                <div className="mt-1 text-[11px] text-slate-500">{c.footer}</div>
              )}
            </div>
            <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full", c.bg)}>
              <c.Icon className="h-5 w-5" />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
