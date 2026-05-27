"use client";

import { Card } from "@/components/ui/card";
import { cn, formatCurrency } from "@/lib/utils";
import type { Moneda } from "./header";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";

const MESES = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];

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
            />
          )),
        );
      }

      return out;
    });
  }

  return (
    <Card className="overflow-hidden">
      {/* Título grande estilo Excel */}
      <div className="border-b border-slate-200 bg-gradient-to-b from-blue-50/40 to-white px-6 py-4 text-center">
        <h2 className="text-2xl font-bold tracking-tight text-blue-700">
          {title ?? `Flujo de caja — ${data.year}`}
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
            />

            {/* ── FLUJO DE CAJA ECONÓMICO (BANDA VERDE) ── */}
            <tr className="border-y-2 border-emerald-300 bg-emerald-50 font-semibold">
              <td className="sticky left-0 z-10 border-r border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-800">
                Flujo de caja económico
              </td>
              {data.flujoEconomicoPorMes.map((v, i) => (
                <td key={i} className={cn("px-3 py-3 text-right", monthBorderClass)} title={economicFormula(i)}>
                  {cell(v, "neutral", true)}
                </td>
              ))}
              <td
                className="border-l-2 border-emerald-300 bg-emerald-100/60 px-3 py-3 text-right"
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
                />
              </>
            )}

            {/* ── SALDO FINAL DE MES (FILA NEGRA) ── */}
            <tr className="bg-slate-900 font-semibold text-white">
              <td className="sticky left-0 z-10 border-r border-slate-700 bg-slate-900 px-4 py-3 text-[11px] uppercase tracking-wider">
                Saldo final de mes
              </td>
              {data.saldoFinalPorMes.map((v, i) => (
                <td
                  key={i}
                  className={cn("px-3 py-3 text-right tabular-nums", monthBorderClass)}
                  title={saldoFinalFormula(i)}
                >
                  {fmt(v)}
                </td>
              ))}
              <td
                className="border-l-2 border-slate-600 bg-slate-800 px-3 py-3 text-right tabular-nums"
                title="Total del año: último saldo final disponible, no es una suma mensual"
              >
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
  formulaTitle,
  expanded,
  onToggle,
  depth = 0,
}: {
  row: FlujoRow;
  tone: "ingreso" | "egreso";
  cell: (v: number, t?: "ingreso" | "egreso" | "neutral", b?: boolean) => React.ReactNode;
  formulaTitle?: (row: FlujoRow) => string;
  expanded?: boolean;
  onToggle?: () => void;
  depth?: number;
}) {
  const hasChildren = Boolean(onToggle);
  return (
    <tr className={cn(depth === 0 ? "bg-white" : "bg-slate-50/50", "hover:bg-slate-50/60")}>
      <td
        className={cn(
          "sticky left-0 z-10 border-b border-r border-slate-100 px-4 py-1.5 text-slate-700",
          depth === 0 ? "bg-white pl-3" : "bg-slate-50/50 pl-12 text-slate-600",
        )}
        title={row.label}
      >
        <div className="flex max-w-[300px] items-center gap-2">
          {hasChildren ? (
            <button
              type="button"
              onClick={onToggle}
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
              aria-label={expanded ? "Ocultar detalle" : "Mostrar detalle"}
              title={expanded ? "Ocultar detalle" : "Mostrar detalle"}
            >
              {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
          ) : (
            <span className="h-5 w-5 shrink-0" />
          )}
          <div className={cn("truncate", depth === 0 && hasChildren && "font-medium")}>
            {row.label}
          </div>
        </div>
      </td>
      {row.values.map((v, j) => (
        <td key={j} className="border-b border-r border-slate-100 px-3 py-1.5 text-right last:border-r-0">
          {cell(v, tone)}
        </td>
      ))}
      <td
        className="border-b border-l-2 border-slate-300 bg-slate-50/40 px-3 py-1.5 text-right"
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
}: {
  label: string;
  perMes: number[];
  total: number;
  tone: "ingreso" | "egreso" | "financiamiento";
  cell: (v: number, t?: "ingreso" | "egreso" | "neutral", b?: boolean) => React.ReactNode;
  formulaTitle?: (monthIdx: number | null, value: number) => string;
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
        <td
          key={j}
          className="border-r border-slate-100 px-3 py-2 text-right last:border-r-0"
          title={formulaTitle?.(j, v)}
        >
          {cell(v, cellTone, true)}
        </td>
      ))}
      <td
        className={cn("border-l-2 border-slate-300 px-3 py-2 text-right", totalBg)}
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
