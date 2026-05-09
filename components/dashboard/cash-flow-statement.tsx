"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, cn } from "@/lib/utils";
import { ArrowUpRight, ArrowDownRight, Wallet } from "lucide-react";

export interface CashFlowLine {
  categoria: string;
  monto: number;
  porcentaje: number; // % del total de su grupo (ingresos o egresos)
}

interface Props {
  fechaInicio: string | null;
  fechaFin: string | null;
  saldoInicial: number;
  saldoFinal: number;
  ingresos: CashFlowLine[];
  egresos: CashFlowLine[];
  totalIngresos: number;
  totalEgresos: number;
}

function formatPeriodo(start: string | null, end: string | null) {
  if (!start || !end) return "—";
  const s = new Date(start).toLocaleDateString("es-PE");
  const e = new Date(end).toLocaleDateString("es-PE");
  return `${s} → ${e}`;
}

export function CashFlowStatement({
  fechaInicio,
  fechaFin,
  saldoInicial,
  saldoFinal,
  ingresos,
  egresos,
  totalIngresos,
  totalEgresos,
}: Props) {
  const netFlow = totalIngresos - totalEgresos;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Estado de Flujo de Efectivo</CardTitle>
        <p className="mt-1 text-xs font-normal text-slate-500">
          Período {formatPeriodo(fechaInicio, fechaFin)}
        </p>
      </CardHeader>
      <CardContent>
        <table className="w-full text-sm">
          <tbody className="divide-y divide-slate-100">
            {/* SALDO INICIAL */}
            <tr className="bg-slate-50/50">
              <td className="py-3 pr-4 font-semibold uppercase tracking-wider text-[11px] text-slate-700">
                Saldo Inicial
              </td>
              <td className="py-3 pr-4" />
              <td className="py-3 pr-4 text-right tabular-nums text-base font-semibold text-slate-900">
                {formatCurrency(saldoInicial)}
              </td>
            </tr>

            {/* INGRESOS section header */}
            <tr>
              <td className="pt-5 pb-2 pr-4" colSpan={3}>
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-50 text-blue-600">
                    <ArrowUpRight className="h-4 w-4" />
                  </div>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-blue-700">
                    Entradas de Efectivo
                  </span>
                </div>
              </td>
            </tr>
            {ingresos.length === 0 && (
              <tr>
                <td className="py-2 pr-4 pl-9 italic text-slate-400" colSpan={3}>
                  Sin ingresos en el período
                </td>
              </tr>
            )}
            {ingresos.map((line) => (
              <tr key={`ing-${line.categoria}`} className="hover:bg-slate-50/60">
                <td className="py-1.5 pl-9 pr-4 text-slate-700">{line.categoria}</td>
                <td className="py-1.5 pr-4 text-right tabular-nums text-xs text-slate-400">
                  {(line.porcentaje * 100).toFixed(1)}%
                </td>
                <td className="py-1.5 pr-4 text-right tabular-nums text-blue-700">
                  {formatCurrency(line.monto)}
                </td>
              </tr>
            ))}
            {/* Total Ingresos */}
            <tr className="border-t border-slate-200 bg-blue-50/40">
              <td className="py-2 pl-9 pr-4 font-semibold text-blue-800">
                Total Ingresos
              </td>
              <td className="py-2 pr-4" />
              <td className="py-2 pr-4 text-right tabular-nums text-base font-bold text-blue-700">
                + {formatCurrency(totalIngresos)}
              </td>
            </tr>

            {/* EGRESOS section header */}
            <tr>
              <td className="pt-5 pb-2 pr-4" colSpan={3}>
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-md bg-rose-50 text-rose-600">
                    <ArrowDownRight className="h-4 w-4" />
                  </div>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-rose-700">
                    Salidas de Efectivo
                  </span>
                </div>
              </td>
            </tr>
            {egresos.length === 0 && (
              <tr>
                <td className="py-2 pr-4 pl-9 italic text-slate-400" colSpan={3}>
                  Sin egresos en el período
                </td>
              </tr>
            )}
            {egresos.map((line) => (
              <tr key={`egr-${line.categoria}`} className="hover:bg-slate-50/60">
                <td className="py-1.5 pl-9 pr-4 text-slate-700">{line.categoria}</td>
                <td className="py-1.5 pr-4 text-right tabular-nums text-xs text-slate-400">
                  {(line.porcentaje * 100).toFixed(1)}%
                </td>
                <td className="py-1.5 pr-4 text-right tabular-nums text-rose-600">
                  ({formatCurrency(line.monto)})
                </td>
              </tr>
            ))}
            <tr className="border-t border-slate-200 bg-rose-50/40">
              <td className="py-2 pl-9 pr-4 font-semibold text-rose-800">
                Total Egresos
              </td>
              <td className="py-2 pr-4" />
              <td className="py-2 pr-4 text-right tabular-nums text-base font-bold text-rose-700">
                ({formatCurrency(totalEgresos)})
              </td>
            </tr>

            {/* FLUJO NETO */}
            <tr className="border-y-2 border-slate-300 bg-slate-50">
              <td className="py-3 pr-4 font-semibold uppercase tracking-wider text-[11px] text-slate-700">
                Flujo Neto del Período
              </td>
              <td className="py-3 pr-4" />
              <td
                className={cn(
                  "py-3 pr-4 text-right tabular-nums text-base font-bold",
                  netFlow >= 0 ? "text-emerald-700" : "text-rose-600"
                )}
              >
                {netFlow >= 0 ? "+" : ""}
                {formatCurrency(netFlow)}
              </td>
            </tr>

            {/* SALDO FINAL */}
            <tr className="bg-slate-900 text-white">
              <td className="py-3 pr-4 pl-3 font-semibold uppercase tracking-wider text-[11px]">
                <div className="flex items-center gap-2">
                  <Wallet className="h-4 w-4" />
                  Saldo Final
                </div>
              </td>
              <td className="py-3 pr-4" />
              <td className="py-3 pr-4 text-right tabular-nums text-lg font-bold">
                {formatCurrency(saldoFinal)}
              </td>
            </tr>
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
