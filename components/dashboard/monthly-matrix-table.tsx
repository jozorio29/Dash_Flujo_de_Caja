"use client";

import { Card } from "@/components/ui/card";
import { cn, formatCurrency, monthLabel } from "@/lib/utils";
import type { Moneda } from "./header";

export interface MatrixRow {
  /** Etiqueta de la fila (nombre de la categoría) */
  label: string;
  /** Monto por mes (en el mismo orden que `months`). */
  values: number[];
  /** Total fila (= sum de values). */
  total: number;
}

export interface MatrixData {
  /** Meses (yyyy-mm) en orden cronológico ascendente. */
  months: string[];
  ingresos: MatrixRow[];
  egresos: MatrixRow[];
  totalIngresosPorMes: number[];
  totalEgresosPorMes: number[];
  flujoNetoPorMes: number[];
  saldoAcumuladoPorMes: number[];
  totalIngresosGlobal: number;
  totalEgresosGlobal: number;
  flujoNetoGlobal: number;
  saldoFinal: number;
}

interface Props {
  matrix: MatrixData;
  moneda: Moneda;
}

export function MonthlyMatrixTable({ matrix, moneda }: Props) {
  const isUsd = moneda === "USD";
  const fmt = (v: number) =>
    isUsd
      ? formatCurrency(v, { symbol: "$", decimals: 2 })
      : formatCurrency(v, { symbol: "Bs " });

  // Estilo de celda numérica (en blanco si es 0 para que la tabla "respire")
  const cell = (v: number, sign: "+" | "-" | "neutral" = "neutral", bold = false) => {
    if (v === 0) return <span className="text-slate-300">—</span>;
    const color =
      sign === "+"
        ? "text-blue-700"
        : sign === "-"
        ? "text-rose-600"
        : v < 0
        ? "text-rose-600"
        : "text-slate-800";
    return <span className={cn("tabular-nums", color, bold && "font-semibold")}>{fmt(v)}</span>;
  };

  if (matrix.months.length === 0) {
    return (
      <Card className="p-8 text-center text-slate-500">
        Sin movimientos en el período seleccionado para generar la matriz mensual.
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-slate-50">
              <th className="sticky left-0 z-10 border-b border-r border-slate-200 bg-slate-50 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                Concepto
              </th>
              {matrix.months.map((mk) => (
                <th
                  key={mk}
                  className="border-b border-slate-200 px-3 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-600 whitespace-nowrap"
                >
                  {monthLabel(mk)}
                </th>
              ))}
              <th className="border-b border-l border-slate-200 bg-slate-100 px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-700">
                Total
              </th>
            </tr>
          </thead>

          <tbody>
            {/* ── INGRESOS ── */}
            <tr className="bg-blue-50/60">
              <td
                className="sticky left-0 z-10 border-b border-r border-blue-100 bg-blue-50/60 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-blue-700"
                colSpan={matrix.months.length + 2}
              >
                Ingresos
              </td>
            </tr>
            {matrix.ingresos.length === 0 && (
              <tr>
                <td
                  className="sticky left-0 z-10 border-b border-r border-slate-100 bg-white px-4 py-2 pl-9 italic text-slate-400"
                  colSpan={matrix.months.length + 2}
                >
                  Sin ingresos en el período
                </td>
              </tr>
            )}
            {matrix.ingresos.map((row, i) => (
              <tr key={`ing-${row.label}`} className={i % 2 === 0 ? "bg-white" : "bg-slate-50/30"}>
                <td
                  className={cn(
                    "sticky left-0 z-10 border-b border-r border-slate-100 px-4 py-1.5 pl-9 text-slate-700",
                    i % 2 === 0 ? "bg-white" : "bg-slate-50/30"
                  )}
                  title={row.label}
                >
                  <div className="max-w-[260px] truncate">{row.label}</div>
                </td>
                {row.values.map((v, j) => (
                  <td key={j} className="border-b border-slate-100 px-3 py-1.5 text-right">
                    {cell(v, "+")}
                  </td>
                ))}
                <td className="border-b border-l border-slate-100 bg-slate-50/60 px-4 py-1.5 text-right">
                  {cell(row.total, "+", true)}
                </td>
              </tr>
            ))}
            {/* Subtotal Ingresos */}
            <tr className="border-y border-blue-200 bg-blue-50/80 font-semibold">
              <td className="sticky left-0 z-10 border-r border-blue-200 bg-blue-50/80 px-4 py-2 pl-9 text-blue-800">
                Total Ingresos
              </td>
              {matrix.totalIngresosPorMes.map((v, j) => (
                <td key={j} className="px-3 py-2 text-right">
                  {cell(v, "+", true)}
                </td>
              ))}
              <td className="border-l border-blue-200 bg-blue-100/60 px-4 py-2 text-right">
                {cell(matrix.totalIngresosGlobal, "+", true)}
              </td>
            </tr>

            {/* ── EGRESOS ── */}
            <tr className="bg-rose-50/60">
              <td
                className="sticky left-0 z-10 border-y border-r border-rose-100 bg-rose-50/60 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-rose-700"
                colSpan={matrix.months.length + 2}
              >
                Egresos
              </td>
            </tr>
            {matrix.egresos.length === 0 && (
              <tr>
                <td
                  className="sticky left-0 z-10 border-b border-r border-slate-100 bg-white px-4 py-2 pl-9 italic text-slate-400"
                  colSpan={matrix.months.length + 2}
                >
                  Sin egresos en el período
                </td>
              </tr>
            )}
            {matrix.egresos.map((row, i) => (
              <tr key={`egr-${row.label}`} className={i % 2 === 0 ? "bg-white" : "bg-slate-50/30"}>
                <td
                  className={cn(
                    "sticky left-0 z-10 border-b border-r border-slate-100 px-4 py-1.5 pl-9 text-slate-700",
                    i % 2 === 0 ? "bg-white" : "bg-slate-50/30"
                  )}
                  title={row.label}
                >
                  <div className="max-w-[260px] truncate">{row.label}</div>
                </td>
                {row.values.map((v, j) => (
                  <td key={j} className="border-b border-slate-100 px-3 py-1.5 text-right">
                    {cell(v, "-")}
                  </td>
                ))}
                <td className="border-b border-l border-slate-100 bg-slate-50/60 px-4 py-1.5 text-right">
                  {cell(row.total, "-", true)}
                </td>
              </tr>
            ))}
            {/* Subtotal Egresos */}
            <tr className="border-y border-rose-200 bg-rose-50/80 font-semibold">
              <td className="sticky left-0 z-10 border-r border-rose-200 bg-rose-50/80 px-4 py-2 pl-9 text-rose-800">
                Total Egresos
              </td>
              {matrix.totalEgresosPorMes.map((v, j) => (
                <td key={j} className="px-3 py-2 text-right">
                  {cell(v, "-", true)}
                </td>
              ))}
              <td className="border-l border-rose-200 bg-rose-100/60 px-4 py-2 text-right">
                {cell(matrix.totalEgresosGlobal, "-", true)}
              </td>
            </tr>

            {/* ── FLUJO NETO ── */}
            <tr className="border-y-2 border-slate-300 bg-slate-50 font-semibold">
              <td className="sticky left-0 z-10 border-r border-slate-300 bg-slate-50 px-4 py-3 text-[11px] uppercase tracking-wider text-slate-700">
                Flujo Neto
              </td>
              {matrix.flujoNetoPorMes.map((v, j) => (
                <td key={j} className="px-3 py-3 text-right">
                  {cell(v, "neutral", true)}
                </td>
              ))}
              <td className="border-l border-slate-300 bg-slate-100 px-4 py-3 text-right">
                {cell(matrix.flujoNetoGlobal, "neutral", true)}
              </td>
            </tr>

            {/* ── SALDO ACUMULADO ── */}
            <tr className="bg-slate-900 font-semibold text-white">
              <td className="sticky left-0 z-10 border-r border-slate-700 bg-slate-900 px-4 py-3 text-[11px] uppercase tracking-wider">
                Saldo Acumulado
              </td>
              {matrix.saldoAcumuladoPorMes.map((v, j) => (
                <td key={j} className="px-3 py-3 text-right tabular-nums">
                  {fmt(v)}
                </td>
              ))}
              <td className="border-l border-slate-700 bg-slate-800 px-4 py-3 text-right tabular-nums">
                {fmt(matrix.saldoFinal)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </Card>
  );
}
