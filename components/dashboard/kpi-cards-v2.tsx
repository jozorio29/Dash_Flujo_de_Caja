"use client";

import { TrendingUp, TrendingDown, Wallet, PiggyBank, ArrowUp, ArrowDown } from "lucide-react";
import { Card } from "@/components/ui/card";
import { formatCurrency, cn } from "@/lib/utils";
import type { Moneda } from "./header";

interface KpiV2 {
  saldoInicial: number;
  ingresosTotales: number;
  egresosTotales: number;
  saldoAcumulado: number;
  saldoDisponible: number;
  /** Comparación vs período anterior. null si no hay período anterior calculable. */
  prevIngresos: number | null;
  prevEgresos: number | null;
  prevSaldoAcumulado: number | null;
}

interface Props {
  kpis: KpiV2;
  moneda: Moneda;
}

function pctChange(current: number, previous: number | null): number | null {
  if (previous === null || previous === 0) return null;
  return (current - previous) / Math.abs(previous);
}

function formatPct(p: number): string {
  return `${Math.abs(p * 100).toFixed(1)}%`;
}

export function KpiCardsV2({ kpis, moneda }: Props) {
  const isUsd = moneda === "USD";
  const fmt = (v: number) =>
    isUsd
      ? formatCurrency(v, { symbol: "$", decimals: 2 })
      : formatCurrency(v, { symbol: "Bs " });

  const ingPct = pctChange(kpis.ingresosTotales, kpis.prevIngresos);
  const egrPct = pctChange(kpis.egresosTotales, kpis.prevEgresos);
  const saldoPct = pctChange(kpis.saldoAcumulado, kpis.prevSaldoAcumulado);

  const cards: Array<{
    title: string;
    value: number;
    Icon: any;
    valueColor: string;
    iconBg: string;
    sub: { text: string; positive?: boolean } | null;
  }> = [
    {
      title: "Saldo Inicial",
      value: kpis.saldoInicial,
      Icon: PiggyBank,
      valueColor: kpis.saldoInicial >= 0 ? "text-slate-800" : "text-rose-600",
      iconBg: "bg-slate-100 text-slate-600",
      sub: { text: "Saldo + débito - crédito inicial" },
    },
    {
      title: "Ingresos Totales",
      value: kpis.ingresosTotales,
      Icon: TrendingUp,
      valueColor: "text-emerald-600",
      iconBg: "bg-emerald-50 text-emerald-600",
      sub:
        ingPct !== null
          ? { text: `${formatPct(ingPct)} vs período anterior`, positive: ingPct >= 0 }
          : { text: "Sin período comparable" },
    },
    {
      title: "Egresos Totales",
      value: kpis.egresosTotales,
      Icon: TrendingDown,
      valueColor: "text-rose-600",
      iconBg: "bg-rose-50 text-rose-600",
      sub:
        egrPct !== null
          ? { text: `${formatPct(egrPct)} vs período anterior`, positive: egrPct < 0 }
          : { text: "Sin período comparable" },
    },
    {
      title: "Saldo Disponible",
      value: kpis.saldoAcumulado,
      Icon: Wallet,
      valueColor: kpis.saldoAcumulado >= 0 ? "text-blue-700" : "text-rose-600",
      iconBg: "bg-blue-50 text-blue-600",
      sub:
        saldoPct !== null
          ? { text: `${formatPct(saldoPct)} vs período anterior`, positive: saldoPct >= 0 }
          : { text: "Sin período comparable" },
    },
    // {
    //   title: "Saldo Disponible",
    //   value: kpis.saldoDisponible,
    //   Icon: PiggyBank,
    //   valueColor: kpis.saldoDisponible >= 0 ? "text-amber-700" : "text-rose-600",
    //   iconBg: "bg-amber-50 text-amber-600",
    //   sub: { text: "Disponible en cuentas" },
    // },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((c) => (
        <Card key={c.title} className="px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                {c.title}
              </div>
              <div
                className={cn("mt-1 truncate text-2xl font-bold tabular-nums", c.valueColor)}
                title={fmt(c.value)}
              >
                {fmt(c.value)}
              </div>
              {c.sub && (
                <div className="mt-2 flex items-center gap-1 text-[11px] text-slate-500">
                  {c.sub.positive === true && (
                    <ArrowUp className="h-3 w-3 text-emerald-600" />
                  )}
                  {c.sub.positive === false && (
                    <ArrowDown className="h-3 w-3 text-rose-600" />
                  )}
                  <span
                    className={cn(
                      c.sub.positive === true && "text-emerald-700",
                      c.sub.positive === false && "text-rose-700"
                    )}
                  >
                    {/* {c.sub.text} */}
                  </span>
                </div>
              )}
            </div>
            <div
              className={cn(
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-full",
                c.iconBg
              )}
            >
              <c.Icon className="h-5 w-5" />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
