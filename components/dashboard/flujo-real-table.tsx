"use client";

import { Card } from "@/components/ui/card";
import { cn, formatCurrency } from "@/lib/utils";
import type { Moneda } from "./header";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";

const MESES = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];
const ZERO_MARK = "—";

export interface FlujoRow {
  label: string;
  /** Monto por cada uno de los 12 meses del año (índice 0 = ENE) */
  values: number[];
  total: number;
  children?: FlujoRow[];
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
  title?: string;
}

export function FlujoRealTable({ data, moneda, title }: Props) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();
  const isUsd = moneda === "USD";
  const fmt = (v: number) =>
    isUsd
      ? formatCurrency(v, { symbol: "$", decimals: 2 })
      : formatCurrency(v, { symbol: "" }); // sin símbolo dentro de la matriz para reducir ruido

  const formulaFmt = (v: number) =>
    isUsd
      ? formatCurrency(v, { symbol: "$", decimals: 2 })
      : formatCurrency(v, { symbol: "Bs " });

  const sumFormula = (label: string, values: number[], result: number) => {
    const parts = values.filter((v) => v !== 0).map(formulaFmt);
    return `${label}: ${parts.length ? parts.join(" + ") : "0"} = ${formulaFmt(result)}`;
  };

  const economicFormula = (monthIdx: number) =>
    `Flujo económico ${MESES[monthIdx]}: Total Ingresos ${formulaFmt(
      data.totalIngresosPorMes[monthIdx] ?? 0,
    )} - Total Egresos ${formulaFmt(data.totalEgresosPorMes[monthIdx] ?? 0)} = ${formulaFmt(
      data.flujoEconomicoPorMes[monthIdx] ?? 0,
    )}`;

  const saldoFinalFormula = (monthIdx: number) =>
    `Saldo final ${MESES[monthIdx]}: Saldo inicial ${formulaFmt(
      data.saldoInicialPorMes[monthIdx] ?? 0,
    )} + Flujo económico ${formulaFmt(
      data.flujoEconomicoPorMes[monthIdx] ?? 0,
    )} + Financiamiento ${formulaFmt(
      data.totalFinanciamientoPorMes[monthIdx] ?? 0,
    )} = ${formulaFmt(data.saldoFinalPorMes[monthIdx] ?? 0)}`;

  const isFutureMonth = (monthIdx: number) =>
    data.year > currentYear || (data.year === currentYear && monthIdx > currentMonth);

  /** Render de celda numérica: guion tenue si es 0, color solo para señales. */
  const cell = (v: number, tone: "ingreso" | "egreso" | "neutral" = "neutral", bold = false) => {
    if (v === 0) return <span className="text-slate-300">{ZERO_MARK}</span>;
    const color =
      v < 0
        ? "text-rose-600"
        : "text-slate-800";
    return <span className={cn("tabular-nums", color, bold && "font-semibold")}>{fmt(v)}</span>;
  };

  const headerCellClass =
    "border-b border-slate-300 px-3 py-2 text-center text-[11px] font-semibold uppercase tracking-wider text-slate-500";
  const monthBorderClass = "border-r border-slate-100";
  const totalCellClass =
    "sticky right-0 z-10 border-l-2 border-slate-300 bg-slate-50 px-3 text-right shadow-[-8px_0_12px_-12px_rgba(15,23,42,0.45)]";

  function toggleRow(key: string) {
    setExpandedRows((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  function renderRows(rows: FlujoRow[], tone: "ingreso" | "egreso", keyPrefix: string) {
    return rows.flatMap((row) => {
      const key = `${keyPrefix}-${row.label}`;
      const isExpanded = expandedRows.has(key);
      const children = row.children ?? [];
      const out = [
        <DataRow
          key={key}
          row={row}
          tone={tone}
          cell={cell}
          formulaTitle={(row) => sumFormula(`${row.label} anual`, row.values, row.total)}
          expanded={isExpanded}
          onToggle={children.length > 0 ? () => toggleRow(key) : undefined}
          isFutureMonth={isFutureMonth}
        />,
      ];

      if (isExpanded) {
        out.push(
          ...children.map((child) => (
            <DataRow
              key={`${key}-${child.label}`}
              row={child}
              tone={tone}
              cell={cell}
              formulaTitle={(row) => sumFormula(`${row.label} anual`, row.values, row.total)}
              depth={1}
              isFutureMonth={isFutureMonth}
            />
          )),
        );
      }

      return out;
    });
  }

  return (
    <Card className="overflow-hidden border-slate-200 shadow-sm">
      <div className="border-b border-slate-200 bg-white px-6 py-4">
        <h2 className="text-xl font-semibold tracking-tight text-slate-900">
          {title ?? `Flujo de caja — ${data.year}`}
        </h2>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1180px] border-collapse text-sm">
          <thead>
            <tr className="bg-slate-50">
              <th className="sticky left-0 z-20 border-b border-r border-slate-300 bg-slate-50 px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-600 shadow-[8px_0_12px_-12px_rgba(15,23,42,0.45)]">
                Concepto
              </th>
              {MESES.map((m, i) => (
                <th
                  key={m}
                  className={cn(
                    headerCellClass,
                    monthBorderClass,
                    isFutureMonth(i) && "bg-slate-50/70 text-slate-300",
                  )}
                >
                  {m}
                </th>
              ))}
              <th className="sticky right-0 z-20 border-b border-l-2 border-slate-300 bg-slate-100 px-3 py-2 text-center text-[11px] font-bold uppercase tracking-wider text-slate-700 shadow-[-8px_0_12px_-12px_rgba(15,23,42,0.45)]">
                Total
              </th>
            </tr>
          </thead>

          <tbody>
            {/* ── SALDO INICIAL ── */}
            <tr className="bg-white hover:bg-slate-50/60">
              <td className="sticky left-0 z-10 border-b border-r border-slate-200 bg-white px-4 py-2 font-semibold text-slate-800 shadow-[8px_0_12px_-12px_rgba(15,23,42,0.45)]">
                Saldo inicial
              </td>
              {data.saldoInicialPorMes.map((v, i) => (
                <td
                  key={i}
                  className={cn(
                    "border-b border-slate-100 px-3 py-2 text-right",
                    monthBorderClass,
                    isFutureMonth(i) && "bg-slate-50/40",
                  )}
                >
                  {cell(v, "neutral", true)}
                </td>
              ))}
              <td className={cn(totalCellClass, "border-b py-2 text-slate-300")}>
                {ZERO_MARK}
              </td>
            </tr>

            {/* ── INGRESOS ── */}
            <SectionHeader label="Ingresos" tone="ingreso" colSpan={MESES.length + 2} />
            {data.ingresos.length === 0 ? (
              <EmptyRow colSpan={MESES.length + 2} text="Sin ingresos este año" />
            ) : (
              renderRows(data.ingresos, "ingreso", "ing")
            )}
            <SubtotalRow
              label="Total Ingresos"
              perMes={data.totalIngresosPorMes}
              total={data.totalIngresosAnual}
              tone="ingreso"
              cell={cell}
              formulaTitle={(monthIdx, value) =>
                monthIdx === null
                  ? sumFormula("Total Ingresos anual", data.totalIngresosPorMes, value)
                  : sumFormula(
                      `Total Ingresos ${MESES[monthIdx]}`,
                      data.ingresos.map((row) => row.values[monthIdx] ?? 0),
                      value,
                    )
              }
              isFutureMonth={isFutureMonth}
            />

            {/* ── EGRESOS ── */}
            <SectionHeader label="Egresos" tone="egreso" colSpan={MESES.length + 2} />
            {data.egresos.length === 0 ? (
              <EmptyRow colSpan={MESES.length + 2} text="Sin egresos este año" />
            ) : (
              renderRows(data.egresos, "egreso", "egr")
            )}
            <SubtotalRow
              label="Total Egresos"
              perMes={data.totalEgresosPorMes}
              total={data.totalEgresosAnual}
              tone="egreso"
              cell={cell}
              formulaTitle={(monthIdx, value) =>
                monthIdx === null
                  ? sumFormula("Total Egresos anual", data.totalEgresosPorMes, value)
                  : sumFormula(
                      `Total Egresos ${MESES[monthIdx]}`,
                      data.egresos.map((row) => row.values[monthIdx] ?? 0),
                      value,
                    )
              }
              isFutureMonth={isFutureMonth}
            />

            {/* ── FLUJO DE CAJA ECONÓMICO (BANDA VERDE) ── */}
            <tr className="border-y-2 border-slate-300 bg-slate-50 font-semibold">
              <td className="sticky left-0 z-10 border-r border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 shadow-[8px_0_12px_-12px_rgba(15,23,42,0.45)]">
                Flujo de caja económico
              </td>
              {data.flujoEconomicoPorMes.map((v, i) => (
                <td
                  key={i}
                  className={cn(
                    "px-3 py-3 text-right",
                    monthBorderClass,
                    isFutureMonth(i) && "bg-slate-50/70",
                  )}
                  title={economicFormula(i)}
                >
                  {cell(v, "neutral", true)}
                </td>
              ))}
              <td
                className={cn(totalCellClass, "py-3")}
                title={`Flujo económico anual: Total Ingresos ${formulaFmt(
                  data.totalIngresosAnual,
                )} - Total Egresos ${formulaFmt(data.totalEgresosAnual)} = ${formulaFmt(
                  data.flujoEconomicoAnual,
                )}`}
              >
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
                    formulaTitle={(row) => sumFormula(`${row.label} anual`, row.values, row.total)}
                    expanded={expandedRows.has(`fin-${row.label}`)}
                    isFutureMonth={isFutureMonth}
                    onToggle={
                      row.children?.length
                        ? () => toggleRow(`fin-${row.label}`)
                        : undefined
                    }
                  />
                ))}
                {data.financiamiento.flatMap((row) =>
                  expandedRows.has(`fin-${row.label}`)
                    ? (row.children ?? []).map((child) => (
                        <DataRow
                          key={`fin-${row.label}-${child.label}`}
                          row={child}
                          tone={child.total >= 0 ? "ingreso" : "egreso"}
                          cell={cell}
                          formulaTitle={(row) => sumFormula(`${row.label} anual`, row.values, row.total)}
                          depth={1}
                          isFutureMonth={isFutureMonth}
                        />
                      ))
                    : [],
                )}
                <SubtotalRow
                  label="Total Financiamiento"
                  perMes={data.totalFinanciamientoPorMes}
                  total={data.totalFinanciamientoAnual}
                  tone="financiamiento"
                  cell={cell}
                  formulaTitle={(monthIdx, value) =>
                    monthIdx === null
                      ? sumFormula("Total Financiamiento anual", data.totalFinanciamientoPorMes, value)
                      : sumFormula(
                          `Total Financiamiento ${MESES[monthIdx]}`,
                          data.financiamiento.map((row) => row.values[monthIdx] ?? 0),
                          value,
                        )
                  }
                  isFutureMonth={isFutureMonth}
                />
              </>
            )}

            {/* ── SALDO FINAL DE MES (FILA NEGRA) ── */}
            <tr className="bg-slate-900 font-semibold text-white">
              <td className="sticky left-0 z-10 border-r border-slate-700 bg-slate-900 px-4 py-3 text-[11px] uppercase tracking-wider shadow-[8px_0_12px_-12px_rgba(15,23,42,0.45)]">
                Saldo final de mes
              </td>
              {data.saldoFinalPorMes.map((v, i) => (
                <td
                  key={i}
                  className={cn(
                    "px-3 py-3 text-right tabular-nums",
                    monthBorderClass,
                    isFutureMonth(i) && "bg-slate-800/80 text-slate-400",
                  )}
                  title={saldoFinalFormula(i)}
                >
                  {v === 0 ? <span className="text-slate-500">{ZERO_MARK}</span> : fmt(v)}
                </td>
              ))}
              <td
                className="sticky right-0 z-10 border-l-2 border-slate-600 bg-slate-800 px-3 py-3 text-right tabular-nums shadow-[-8px_0_12px_-12px_rgba(15,23,42,0.45)]"
                title="Total del año: último saldo final disponible, no es una suma mensual"
              >
                {/* Total del año = último saldo (no es una suma) */}
                {(data.saldoFinalPorMes[data.saldoFinalPorMes.length - 1] ?? 0) === 0
                  ? ZERO_MARK
                  : fmt(data.saldoFinalPorMes[data.saldoFinalPorMes.length - 1] ?? 0)}
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
  const dot = tone === "ingreso" ? "bg-blue-500" : tone === "egreso" ? "bg-rose-500" : "bg-amber-500";
  return (
    <tr className="bg-white">
      <td
        className="sticky left-0 z-10 border-y border-r border-slate-200 bg-white px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500 shadow-[8px_0_12px_-12px_rgba(15,23,42,0.45)]"
        colSpan={colSpan}
      >
        <span className="inline-flex items-center gap-2">
          <span className={cn("h-1.5 w-1.5 rounded-full", dot)} />
          {label}
        </span>
      </td>
    </tr>
  );
}

function displayLabel(label: string): string {
  return label
    .replace(/\bInversion\b/g, "Inversión")
    .replace(/\bEnergia\b/g, "Energía")
    .replace(/\bNomina\b/g, "Nómina")
    .replace(/\bAnalisis\b/g, "Análisis");
}

function DataRow({
  row,
  tone,
  cell,
  formulaTitle,
  expanded,
  onToggle,
  depth = 0,
  isFutureMonth,
}: {
  row: FlujoRow;
  tone: "ingreso" | "egreso";
  cell: (v: number, t?: "ingreso" | "egreso" | "neutral", b?: boolean) => React.ReactNode;
  formulaTitle?: (row: FlujoRow) => string;
  expanded?: boolean;
  onToggle?: () => void;
  depth?: number;
  isFutureMonth?: (monthIdx: number) => boolean;
}) {
  const hasChildren = Boolean(onToggle);
  const label = displayLabel(row.label);
  return (
    <tr className={cn(depth === 0 ? "odd:bg-white even:bg-slate-50/35" : "bg-slate-50/60", "hover:bg-slate-100/60")}>
      <td
        className={cn(
          "sticky left-0 z-10 border-b border-r border-slate-100 px-4 py-1.5 text-slate-600 shadow-[8px_0_12px_-12px_rgba(15,23,42,0.45)]",
          depth === 0 ? "bg-inherit pl-3" : "bg-slate-50/60 pl-12 text-slate-500",
        )}
        title={label}
      >
        <div className="flex max-w-[300px] items-center gap-2">
          {hasChildren ? (
            <button
              type="button"
              onClick={onToggle}
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded border border-slate-200 bg-white text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
              aria-label={expanded ? "Ocultar detalle" : "Mostrar detalle"}
              title={expanded ? "Ocultar detalle" : "Mostrar detalle"}
            >
              {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
          ) : (
            <span className="h-5 w-5 shrink-0" />
          )}
          <div className={cn("truncate", depth === 0 && hasChildren && "font-medium")}>
            {label}
          </div>
        </div>
      </td>
      {row.values.map((v, j) => (
        <td
          key={j}
          className={cn(
            "border-b border-r border-slate-100 px-3 py-1.5 text-right last:border-r-0",
            isFutureMonth?.(j) && "bg-slate-50/50",
          )}
        >
          {cell(v, tone)}
        </td>
      ))}
      <td
        className="sticky right-0 z-10 border-b border-l-2 border-slate-300 bg-slate-50 px-3 py-1.5 text-right shadow-[-8px_0_12px_-12px_rgba(15,23,42,0.45)]"
        title={formulaTitle?.(row)}
      >
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
  formulaTitle,
  isFutureMonth,
}: {
  label: string;
  perMes: number[];
  total: number;
  tone: "ingreso" | "egreso" | "financiamiento";
  cell: (v: number, t?: "ingreso" | "egreso" | "neutral", b?: boolean) => React.ReactNode;
  formulaTitle?: (monthIdx: number | null, value: number) => string;
  isFutureMonth?: (monthIdx: number) => boolean;
}) {
  const cellTone = tone === "financiamiento" ? "neutral" : tone;
  return (
    <tr className="border-y border-slate-200 bg-slate-50 font-semibold">
      <td className="sticky left-0 z-10 border-r border-slate-200 bg-slate-50 px-4 py-2 pl-8 text-slate-900 shadow-[8px_0_12px_-12px_rgba(15,23,42,0.45)]">
        {label}
      </td>
      {perMes.map((v, j) => (
        <td
          key={j}
          className={cn(
            "border-r border-slate-100 px-3 py-2 text-right last:border-r-0",
            isFutureMonth?.(j) && "bg-slate-50/70",
          )}
          title={formulaTitle?.(j, v)}
        >
          {cell(v, cellTone, true)}
        </td>
      ))}
      <td
        className="sticky right-0 z-10 border-l-2 border-slate-300 bg-slate-100 px-3 py-2 text-right shadow-[-8px_0_12px_-12px_rgba(15,23,42,0.45)]"
        title={formulaTitle?.(null, total)}
      >
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
