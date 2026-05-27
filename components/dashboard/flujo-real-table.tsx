"use client";

import { Card } from "@/components/ui/card";
import { cn, formatCurrency } from "@/lib/utils";
import type { Moneda } from "./header";

const MESES = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];

export interface FlujoRow {
  label: string;
  /** Monto por cada uno de los 12 meses del año (índice 0 = ENE) */
  values: number[];
  total: number;
}

export interface FlujoRealData {
  year: number;
  /** Saldo de caja al INICIO de cada mes (12 valores). Idx 0 = saldo al 1 ENE. */
  saldoInicialPorMes: number[];
  ingresos: FlujoRow[];
  egresos: FlujoRow[];
  financiamiento: FlujoRow[];
  totalIngresosPorMes: number[];
  totalEgresosPorMes: number[];
  totalFinanciamientoPorMes: number[];
  /** Flujo de caja económico = Ingresos - Egresos (sin financiamiento) por mes */
  flujoEconomicoPorMes: number[];
  /** Saldo final por mes = saldo inicial + económico + financiamiento */
  saldoFinalPorMes: number[];
  totalIngresosAnual: number;
  totalEgresosAnual: number;
  totalFinanciamientoAnual: number;
  flujoEconomicoAnual: number;
}

interface Props {
  data: FlujoRealData;
  moneda: Moneda;
}

export function FlujoRealTable({ data, moneda }: Props) {
  const isUsd = moneda === "USD";
  const fmt = (v: number) =>
    isUsd
      ? formatCurrency(v, { symbol: "$", decimals: 2 })
      : formatCurrency(v, { symbol: "" }); // sin símbolo dentro de la matriz para reducir ruido

  /** Render de celda numérica: vacío si es 0, color según signo. */
  const cell = (v: number, tone: "ingreso" | "egreso" | "neutral" = "neutral", bold = false) => {
    if (v === 0) return <span className="text-slate-300">0</span>;
    const color =
      tone === "ingreso"
        ? "text-blue-700"
        : tone === "egreso"
        ? "text-rose-600"
        : v < 0
        ? "text-rose-600"
        : "text-slate-800";
    return <span className={cn("tabular-nums", color, bold && "font-semibold")}>{fmt(v)}</span>;
  };

  const headerCellClass =
    "border-b border-slate-300 px-3 py-2 text-center text-[11px] font-semibold uppercase tracking-wider text-slate-600";
  const monthBorderClass = "border-r border-slate-100 last:border-r-0";

  return (
    <Card className="overflow-hidden">
      {/* Título grande estilo Excel */}
      <div className="border-b border-slate-200 bg-gradient-to-b from-blue-50/40 to-white px-6 py-4 text-center">
        <h2 className="text-2xl font-bold tracking-tight text-blue-700">
          Flujo de caja — {data.year}
        </h2>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-slate-50">
              <th className="sticky left-0 z-10 border-b border-r border-slate-300 bg-slate-50 px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                Concepto
              </th>
              {MESES.map((m) => (
                <th key={m} className={cn(headerCellClass, monthBorderClass)}>
                  {m}
                </th>
              ))}
              <th className="border-b border-l-2 border-slate-300 bg-slate-100 px-3 py-2 text-center text-[11px] font-bold uppercase tracking-wider text-slate-700">
                Total
              </th>
            </tr>
          </thead>

          <tbody>
            {/* ── SALDO INICIAL ── */}
            <tr className="bg-sky-50/40">
              <td className="sticky left-0 z-10 border-b border-r border-slate-200 bg-sky-50/40 px-4 py-2 font-semibold text-slate-800">
                Saldo inicial
              </td>
              {data.saldoInicialPorMes.map((v, i) => (
                <td key={i} className={cn("border-b border-slate-100 px-3 py-2 text-right", monthBorderClass)}>
                  {cell(v, "neutral", true)}
                </td>
              ))}
              <td className="border-b border-l-2 border-slate-300 bg-slate-50 px-3 py-2 text-right text-slate-400">
                —
              </td>
            </tr>

            {/* ── INGRESOS ── */}
            <SectionHeader label="Ingresos" tone="ingreso" colSpan={MESES.length + 2} />
            {data.ingresos.length === 0 ? (
              <EmptyRow colSpan={MESES.length + 2} text="Sin ingresos este año" />
            ) : (
              data.ingresos.map((row) => (
                <DataRow key={`ing-${row.label}`} row={row} tone="ingreso" cell={cell} />
              ))
            )}
            <SubtotalRow
              label="Total Ingresos"
              perMes={data.totalIngresosPorMes}
              total={data.totalIngresosAnual}
              tone="ingreso"
              cell={cell}
            />

            {/* ── EGRESOS ── */}
            <SectionHeader label="Egresos" tone="egreso" colSpan={MESES.length + 2} />
            {data.egresos.length === 0 ? (
              <EmptyRow colSpan={MESES.length + 2} text="Sin egresos este año" />
            ) : (
              data.egresos.map((row) => (
                <DataRow key={`egr-${row.label}`} row={row} tone="egreso" cell={cell} />
              ))
            )}
            <SubtotalRow
              label="Total Egresos"
              perMes={data.totalEgresosPorMes}
              total={data.totalEgresosAnual}
              tone="egreso"
              cell={cell}
            />

            {/* ── FLUJO DE CAJA ECONÓMICO (BANDA VERDE) ── */}
            <tr className="border-y-2 border-emerald-300 bg-emerald-50 font-semibold">
              <td className="sticky left-0 z-10 border-r border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-800">
                Flujo de caja económico
              </td>
              {data.flujoEconomicoPorMes.map((v, i) => (
                <td key={i} className={cn("px-3 py-3 text-right", monthBorderClass)}>
                  {cell(v, "neutral", true)}
                </td>
              ))}
              <td className="border-l-2 border-emerald-300 bg-emerald-100/60 px-3 py-3 text-right">
                {cell(data.flujoEconomicoAnual, "neutral", true)}
              </td>
            </tr>

            {/* ── FINANCIAMIENTO (solo si hay datos) ── */}
            {data.financiamiento.length > 0 && (
              <>
                <SectionHeader label="Financiamiento" tone="financiamiento" colSpan={MESES.length + 2} />
                {data.financiamiento.map((row) => (
                  <DataRow
                    key={`fin-${row.label}`}
                    row={row}
                    tone={row.total >= 0 ? "ingreso" : "egreso"}
                    cell={cell}
                  />
                ))}
                <SubtotalRow
                  label="Total Financiamiento"
                  perMes={data.totalFinanciamientoPorMes}
                  total={data.totalFinanciamientoAnual}
                  tone="financiamiento"
                  cell={cell}
                />
              </>
            )}

            {/* ── SALDO FINAL DE MES (FILA NEGRA) ── */}
            <tr className="bg-slate-900 font-semibold text-white">
              <td className="sticky left-0 z-10 border-r border-slate-700 bg-slate-900 px-4 py-3 text-[11px] uppercase tracking-wider">
                Saldo final de mes
              </td>
              {data.saldoFinalPorMes.map((v, i) => (
                <td key={i} className={cn("px-3 py-3 text-right tabular-nums", monthBorderClass)}>
                  {fmt(v)}
                </td>
              ))}
              <td className="border-l-2 border-slate-600 bg-slate-800 px-3 py-3 text-right tabular-nums">
                {/* Total del año = último saldo (no es una suma) */}
                {fmt(data.saldoFinalPorMes[data.saldoFinalPorMes.length - 1] ?? 0)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ─── Sub-componentes auxiliares ──────────────────────────────────────────────

function SectionHeader({
  label,
  tone,
  colSpan,
}: {
  label: string;
  tone: "ingreso" | "egreso" | "financiamiento";
  colSpan: number;
}) {
  const bg = tone === "ingreso" ? "bg-blue-50" : tone === "egreso" ? "bg-rose-50" : "bg-amber-50";
  const text =
    tone === "ingreso" ? "text-blue-700" : tone === "egreso" ? "text-rose-700" : "text-amber-700";
  return (
    <tr className={bg}>
      <td
        className={cn("sticky left-0 z-10 border-y border-r border-slate-200 px-4 py-2 text-[11px] font-bold uppercase tracking-wider", bg, text)}
        colSpan={colSpan}
      >
        {label}
      </td>
    </tr>
  );
}

function DataRow({
  row,
  tone,
  cell,
}: {
  row: FlujoRow;
  tone: "ingreso" | "egreso";
  cell: (v: number, t?: "ingreso" | "egreso" | "neutral", b?: boolean) => React.ReactNode;
}) {
  return (
    <tr className="bg-white hover:bg-slate-50/60">
      <td
        className="sticky left-0 z-10 border-b border-r border-slate-100 bg-white px-4 py-1.5 pl-8 text-slate-700"
        title={row.label}
      >
        <div className="max-w-[260px] truncate">{row.label}</div>
      </td>
      {row.values.map((v, j) => (
        <td key={j} className="border-b border-r border-slate-100 px-3 py-1.5 text-right last:border-r-0">
          {cell(v, tone)}
        </td>
      ))}
      <td className="border-b border-l-2 border-slate-300 bg-slate-50/40 px-3 py-1.5 text-right">
        {cell(row.total, tone, true)}
      </td>
    </tr>
  );
}

function SubtotalRow({
  label,
  perMes,
  total,
  tone,
  cell,
}: {
  label: string;
  perMes: number[];
  total: number;
  tone: "ingreso" | "egreso" | "financiamiento";
  cell: (v: number, t?: "ingreso" | "egreso" | "neutral", b?: boolean) => React.ReactNode;
}) {
  const bg = tone === "ingreso" ? "bg-blue-50/80" : tone === "egreso" ? "bg-rose-50/80" : "bg-amber-50/80";
  const text =
    tone === "ingreso" ? "text-blue-800" : tone === "egreso" ? "text-rose-800" : "text-amber-800";
  const border =
    tone === "ingreso" ? "border-blue-200" : tone === "egreso" ? "border-rose-200" : "border-amber-200";
  const totalBg =
    tone === "ingreso" ? "bg-blue-100/60" : tone === "egreso" ? "bg-rose-100/60" : "bg-amber-100/60";
  const cellTone = tone === "financiamiento" ? "neutral" : tone;
  return (
    <tr className={cn("border-y font-semibold", border, bg)}>
      <td className={cn("sticky left-0 z-10 border-r px-4 py-2 pl-8", border, bg, text)}>{label}</td>
      {perMes.map((v, j) => (
        <td key={j} className="border-r border-slate-100 px-3 py-2 text-right last:border-r-0">
          {cell(v, cellTone, true)}
        </td>
      ))}
      <td className={cn("border-l-2 border-slate-300 px-3 py-2 text-right", totalBg)}>
        {cell(total, cellTone, true)}
      </td>
    </tr>
  );
}

function EmptyRow({ colSpan, text }: { colSpan: number; text: string }) {
  return (
    <tr>
      <td className="border-b border-slate-100 bg-white px-4 py-2 pl-8 italic text-slate-400" colSpan={colSpan}>
        {text}
      </td>
    </tr>
  );
}
