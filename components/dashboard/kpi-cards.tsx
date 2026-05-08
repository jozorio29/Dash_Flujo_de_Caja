"use client";

import { ArrowDownRight, ArrowUpRight, Wallet, Database, Coins } from "lucide-react";
import { Card } from "@/components/ui/card";
import { KpiSummary } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface Props {
  kpis: KpiSummary;
}

export function KpiCards({ kpis }: Props) {
  const cards = [
    {
      title: "Ingresos Totales",
      value: kpis.ingresosTotales,
      sub: `Promedio mensual\n${formatCurrency(kpis.promedioMensualIngresos)}`,
      Icon: ArrowUpRight,
      iconBg: "bg-blue-50 text-blue-600",
      titleClass: "text-blue-600",
    },
    {
      title: "Egresos Totales",
      value: kpis.egresosTotales,
      sub: `Promedio mensual\n${formatCurrency(kpis.promedioMensualEgresos)}`,
      Icon: ArrowDownRight,
      iconBg: "bg-rose-50 text-rose-600",
      titleClass: "text-rose-600",
    },
    {
      title: "Net Flow (ING - EGR)",
      value: kpis.netFlow,
      sub: `Promedio mensual\n${formatCurrency(kpis.promedioMensualNet)}`,
      Icon: Wallet,
      iconBg: "bg-emerald-50 text-emerald-600",
      titleClass: kpis.netFlow >= 0 ? "text-emerald-600" : "text-rose-600",
      negative: kpis.netFlow < 0,
    },
    {
      title: "Saldo Inicial",
      value: kpis.saldoInicial,
      sub: "Inicio del período",
      Icon: Database,
      iconBg: "bg-violet-50 text-violet-600",
      titleClass: "text-violet-700",
    },
    {
      title: "Saldo Final",
      value: kpis.saldoFinal,
      sub: "Fin del período",
      Icon: Coins,
      iconBg: "bg-slate-100 text-slate-700",
      titleClass: "text-slate-700",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {cards.map((c) => (
        <Card key={c.title} className="px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className={cn("text-[11px] font-semibold uppercase tracking-wider", c.titleClass)}>
                {c.title}
              </div>
              <div
                className={cn(
                  "mt-1 truncate text-2xl font-bold tabular-nums",
                  c.negative ? "text-rose-600" : "text-slate-900"
                )}
                title={formatCurrency(c.value)}
              >
                {formatCurrency(c.value)}
              </div>
              {c.sub && (
                <div className="mt-2 whitespace-pre-line text-[11px] leading-tight text-slate-500">
                  {c.sub}
                </div>
              )}
            </div>
            <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full", c.iconBg)}>
              <c.Icon className="h-5 w-5" />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
