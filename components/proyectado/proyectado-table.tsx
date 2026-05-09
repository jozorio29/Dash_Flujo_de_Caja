"use client";

import { useMemo, useState } from "react";
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { ProjectedMovement } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { formatCurrency, cn } from "@/lib/utils";

interface Props {
  movements: ProjectedMovement[];
}

type SortKey =
  | "fecha"
  | "concepto"
  | "centroCosto"
  | "edificio"
  | "status"
  | "ingresos"
  | "egresos"
  | "standBy"
  | "saldoBs"
  | "montoUsd";

type SortDir = "asc" | "desc";

function getStatusStyle(status: string): { bg: string; text: string; dot: string } {
  const s = status.toLowerCase();
  if (s.includes("pendiente")) return { bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500" };
  if (s.includes("pagado")) return { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500" };
  if (s.includes("confirm")) return { bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-500" };
  if (s.includes("cancel") || s.includes("rechaz")) return { bg: "bg-rose-50", text: "text-rose-700", dot: "bg-rose-500" };
  if (s.includes("stand")) return { bg: "bg-slate-100", text: "text-slate-700", dot: "bg-slate-500" };
  if (s.includes("revisi") || s.includes("revis")) return { bg: "bg-violet-50", text: "text-violet-700", dot: "bg-violet-500" };
  return { bg: "bg-slate-100", text: "text-slate-700", dot: "bg-slate-400" };
}

function formatDate(d: Date | null): string {
  if (!d) return "—";
  return d.toLocaleDateString("es-PE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function HeaderCell({
  label,
  sortKey,
  currentSort,
  onSort,
  align = "left",
  className,
}: {
  label: string;
  sortKey: SortKey;
  currentSort: { key: SortKey; dir: SortDir };
  onSort: (k: SortKey) => void;
  align?: "left" | "right" | "center";
  className?: string;
}) {
  const active = currentSort.key === sortKey;
  return (
    <th
      className={cn(
        "border-b border-slate-200 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-500",
        align === "right" && "text-right",
        align === "center" && "text-center",
        className
      )}
    >
      <button
        onClick={() => onSort(sortKey)}
        className={cn(
          "inline-flex items-center gap-1 hover:text-slate-800",
          align === "right" && "flex-row-reverse",
          active && "text-slate-800"
        )}
      >
        {label}
        {!active && <ChevronsUpDown className="h-3 w-3 text-slate-300" />}
        {active && currentSort.dir === "asc" && <ChevronUp className="h-3 w-3" />}
        {active && currentSort.dir === "desc" && <ChevronDown className="h-3 w-3" />}
      </button>
    </th>
  );
}

export function ProyectadoTable({ movements }: Props) {
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({
    key: "fecha",
    dir: "asc",
  });

  const sorted = useMemo(() => {
    const arr = [...movements];
    arr.sort((a, b) => {
      let av: any = a[sort.key];
      let bv: any = b[sort.key];
      if (sort.key === "fecha") {
        av = a.fecha?.getTime() ?? 0;
        bv = b.fecha?.getTime() ?? 0;
      }
      if (typeof av === "string") av = av.toLowerCase();
      if (typeof bv === "string") bv = bv.toLowerCase();
      if (av < bv) return sort.dir === "asc" ? -1 : 1;
      if (av > bv) return sort.dir === "asc" ? 1 : -1;
      return 0;
    });
    return arr;
  }, [movements, sort]);

  function toggleSort(k: SortKey) {
    setSort((s) =>
      s.key === k
        ? { key: k, dir: s.dir === "asc" ? "desc" : "asc" }
        : { key: k, dir: "asc" }
    );
  }

  const totals = useMemo(() => {
    return {
      ingresos: movements.reduce((s, m) => s + m.ingresos, 0),
      egresos: movements.reduce((s, m) => s + m.egresos, 0),
      standBy: movements.reduce((s, m) => s + m.standBy, 0),
      saldoUsd: movements.reduce((s, m) => s + m.montoUsd, 0),
    };
  }, [movements]);

  if (movements.length === 0) {
    return (
      <Card className="p-8 text-center text-slate-500">
        Sin pagos proyectados que cumplan los filtros.
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <HeaderCell label="Fecha" sortKey="fecha" currentSort={sort} onSort={toggleSort} />
              <HeaderCell label="Concepto" sortKey="concepto" currentSort={sort} onSort={toggleSort} />
              <HeaderCell label="C. Costo" sortKey="centroCosto" currentSort={sort} onSort={toggleSort} />
              <HeaderCell label="Edificio" sortKey="edificio" currentSort={sort} onSort={toggleSort} />
              <HeaderCell label="Status" sortKey="status" currentSort={sort} onSort={toggleSort} />
              <HeaderCell label="Ingresos" sortKey="ingresos" currentSort={sort} onSort={toggleSort} align="right" />
              <HeaderCell label="Egresos" sortKey="egresos" currentSort={sort} onSort={toggleSort} align="right" />
              <HeaderCell label="Stand by" sortKey="standBy" currentSort={sort} onSort={toggleSort} align="right" />
              <HeaderCell label="Saldo (Bs)" sortKey="saldoBs" currentSort={sort} onSort={toggleSort} align="right" />
              <HeaderCell label="USD" sortKey="montoUsd" currentSort={sort} onSort={toggleSort} align="right" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((m, i) => {
              const sty = getStatusStyle(m.status);
              const saldoNeg = m.saldoBs < 0;
              return (
                <tr
                  key={i}
                  className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60"
                >
                  <td className="whitespace-nowrap px-3 py-2 text-slate-700 tabular-nums">
                    {formatDate(m.fecha)}
                  </td>
                  <td className="px-3 py-2 font-medium text-slate-800">
                    <div className="max-w-[280px] truncate" title={m.concepto}>
                      {m.concepto || "—"}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-slate-600">
                    <div className="max-w-[140px] truncate" title={m.centroCosto}>
                      {m.centroCosto || "—"}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-slate-600">
                    <div className="max-w-[140px] truncate" title={m.edificio}>
                      {m.edificio || "—"}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    {m.status ? (
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
                          sty.bg,
                          sty.text
                        )}
                      >
                        <span className={cn("h-1.5 w-1.5 rounded-full", sty.dot)} />
                        {m.status}
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-blue-700">
                    {m.ingresos > 0 ? formatCurrency(m.ingresos, { symbol: "Bs " }) : ""}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-rose-600">
                    {m.egresos > 0 ? formatCurrency(m.egresos, { symbol: "Bs " }) : ""}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-amber-700">
                    {m.standBy > 0 ? formatCurrency(m.standBy, { symbol: "Bs " }) : ""}
                  </td>
                  <td
                    className={cn(
                      "px-3 py-2 text-right tabular-nums",
                      saldoNeg ? "text-rose-600" : "text-slate-700"
                    )}
                  >
                    {formatCurrency(m.saldoBs, { symbol: "Bs " })}
                  </td>
                  <td
                    className={cn(
                      "px-3 py-2 text-right tabular-nums text-xs",
                      m.montoUsd < 0 ? "text-rose-500" : "text-slate-500"
                    )}
                  >
                    {formatCurrency(m.montoUsd, { symbol: "$", decimals: 2 })}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="bg-slate-50 font-semibold">
            <tr>
              <td className="px-3 py-3 text-slate-700" colSpan={5}>
                Totales del rango filtrado
              </td>
              <td className="px-3 py-3 text-right tabular-nums text-blue-700">
                {formatCurrency(totals.ingresos, { symbol: "Bs " })}
              </td>
              <td className="px-3 py-3 text-right tabular-nums text-rose-600">
                {formatCurrency(totals.egresos, { symbol: "Bs " })}
              </td>
              <td className="px-3 py-3 text-right tabular-nums text-amber-700">
                {formatCurrency(totals.standBy, { symbol: "Bs " })}
              </td>
              <td
                className={cn(
                  "px-3 py-3 text-right tabular-nums",
                  totals.ingresos - totals.egresos < 0 ? "text-rose-600" : "text-slate-900"
                )}
                title="Neto = Ingresos - Egresos (sin Stand by)"
              >
                {formatCurrency(totals.ingresos - totals.egresos, { symbol: "Bs " })}
              </td>
              <td className="px-3 py-3 text-right tabular-nums text-slate-500">
                {formatCurrency(totals.saldoUsd, { symbol: "$", decimals: 2 })}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </Card>
  );
}
