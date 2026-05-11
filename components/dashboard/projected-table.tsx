"use client";

import { useMemo, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ProjectedMovement } from "@/lib/types";
import { formatCurrency, cn, monthKey, monthLabel } from "@/lib/utils";
import { Search, ChevronDown, ChevronUp } from "lucide-react";

interface Props {
  movements: ProjectedMovement[];
  statuses: string[];
  centrosCosto: string[];
  edificios: string[];
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

const STATUS_STYLES: Record<string, string> = {
  pendiente: "bg-amber-100 text-amber-800 ring-amber-200",
  pagado: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  confirmado: "bg-blue-100 text-blue-800 ring-blue-200",
  cancelado: "bg-rose-100 text-rose-800 ring-rose-200",
};

function statusBadge(status: string): string {
  const key = status.trim().toLowerCase();
  return STATUS_STYLES[key] ?? "bg-slate-100 text-slate-700 ring-slate-200";
}

function formatDate(d: Date | null): string {
  if (!d) return "—";
  return d.toLocaleDateString("es-PE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function ProjectedTable({
  movements,
  statuses,
  centrosCosto,
  edificios,
}: Props) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [centroFilter, setCentroFilter] = useState<string>("all");
  const [edificioFilter, setEdificioFilter] = useState<string>("all");
  const [monthFilter, setMonthFilter] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("fecha");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  // Lista única de meses (yyyy-mm) presentes en los movimientos, ordenada cronológicamente.
  const months = useMemo(() => {
    const set = new Set<string>();
    for (const m of movements) {
      if (m.fecha) set.add(monthKey(m.fecha));
    }
    return Array.from(set).sort();
  }, [movements]);

  const filtered = useMemo(() => {
    let out = movements;
    if (monthFilter !== "all") {
      out = out.filter((m) => m.fecha && monthKey(m.fecha) === monthFilter);
    }
    if (statusFilter !== "all") {
      out = out.filter((m) => m.status === statusFilter);
    }
    if (centroFilter !== "all") {
      out = out.filter((m) => m.centroCosto === centroFilter);
    }
    if (edificioFilter !== "all") {
      out = out.filter((m) => m.edificio === edificioFilter);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      out = out.filter(
        (m) =>
          m.concepto.toLowerCase().includes(q) ||
          m.centroCosto.toLowerCase().includes(q) ||
          m.edificio.toLowerCase().includes(q) ||
          m.status.toLowerCase().includes(q)
      );
    }
    // sort
    const dir = sortDir === "asc" ? 1 : -1;
    out = [...out].sort((a, b) => {
      const va = a[sortKey];
      const vb = b[sortKey];
      if (va instanceof Date || vb instanceof Date) {
        const ta = (va as Date | null)?.getTime() ?? 0;
        const tb = (vb as Date | null)?.getTime() ?? 0;
        return (ta - tb) * dir;
      }
      if (typeof va === "number" && typeof vb === "number") {
        return (va - vb) * dir;
      }
      return String(va).localeCompare(String(vb)) * dir;
    });
    return out;
  }, [movements, search, statusFilter, centroFilter, edificioFilter, monthFilter, sortKey, sortDir]);

  const totals = useMemo(() => {
    let ing = 0,
      egr = 0,
      sb = 0;
    for (const m of filtered) {
      ing += m.ingresos;
      egr += m.egresos;
      sb += m.standBy;
    }
    return { ingresos: ing, egresos: egr, standBy: sb, net: ing - egr };
  }, [filtered]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function SortHeader({ k, label, align = "left" }: { k: SortKey; label: string; align?: "left" | "right" }) {
    const active = sortKey === k;
    return (
      <th
        className={cn(
          "cursor-pointer select-none py-2 pr-3 text-xs font-semibold uppercase tracking-wider text-slate-500 transition-colors hover:text-slate-700",
          align === "right" ? "text-right" : "text-left"
        )}
        onClick={() => toggleSort(k)}
      >
        <span
          className={cn(
            "inline-flex items-center gap-1",
            align === "right" && "flex-row-reverse"
          )}
        >
          {label}
          {active &&
            (sortDir === "asc" ? (
              <ChevronUp className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            ))}
        </span>
      </th>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pagos Proyectados</CardTitle>
        <p className="mt-1 text-xs font-normal text-slate-500">
          {filtered.length.toLocaleString("es-PE")} pagos en el filtro actual
          {filtered.length !== movements.length && ` (de ${movements.length} totales)`}
        </p>

        {/* Filtros */}
        <div className="mt-3 flex flex-wrap gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar concepto..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-56 rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-sm shadow-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <select
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm shadow-sm outline-none focus:border-blue-400"
          >
            <option value="all">Todos los meses</option>
            {months.map((mk) => (
              <option key={mk} value={mk}>
                {monthLabel(mk)}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm shadow-sm outline-none focus:border-blue-400"
          >
            <option value="all">Todos los status</option>
            {statuses.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          {centrosCosto.length > 0 && (
            <select
              value={centroFilter}
              onChange={(e) => setCentroFilter(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm shadow-sm outline-none focus:border-blue-400"
            >
              <option value="all">Todos los centros</option>
              {centrosCosto.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}

          {edificios.length > 0 && (
            <select
              value={edificioFilter}
              onChange={(e) => setEdificioFilter(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm shadow-sm outline-none focus:border-blue-400"
            >
              <option value="all">Todos los edificios</option>
              {edificios.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
          )}
        </div>
      </CardHeader>

      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <SortHeader k="fecha" label="Fecha" />
                <SortHeader k="concepto" label="Concepto" />
                <SortHeader k="centroCosto" label="Centro Costo" />
                <SortHeader k="edificio" label="Edificio" />
                <SortHeader k="status" label="Status" />
                <SortHeader k="ingresos" label="Ingresos" align="right" />
                <SortHeader k="egresos" label="Egresos" align="right" />
                <SortHeader k="standBy" label="Stand by" align="right" />
                <SortHeader k="saldoBs" label="Saldo Bs" align="right" />
                <SortHeader k="montoUsd" label="USD" align="right" />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-sm text-slate-500">
                    Sin resultados con los filtros actuales
                  </td>
                </tr>
              )}
              {filtered.map((m, i) => (
                <tr
                  key={`${m.fechaRaw}-${m.concepto}-${i}`}
                  className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60"
                >
                  <td className="py-2 pr-3 tabular-nums text-slate-700">
                    {formatDate(m.fecha)}
                  </td>
                  <td className="py-2 pr-3 font-medium text-slate-800">{m.concepto}</td>
                  <td className="py-2 pr-3 text-slate-600">{m.centroCosto || "—"}</td>
                  <td className="py-2 pr-3 text-slate-600">{m.edificio || "—"}</td>
                  <td className="py-2 pr-3">
                    {m.status ? (
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset",
                          statusBadge(m.status)
                        )}
                      >
                        {m.status}
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums text-emerald-700">
                    {m.ingresos > 0 ? formatCurrency(m.ingresos, { symbol: "" }) : ""}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums text-rose-600">
                    {m.egresos > 0 ? formatCurrency(m.egresos, { symbol: "" }) : ""}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums text-amber-700">
                    {m.standBy > 0 ? formatCurrency(m.standBy, { symbol: "" }) : ""}
                  </td>
                  <td
                    className={cn(
                      "py-2 pr-3 text-right tabular-nums font-medium",
                      m.saldoBs < 0 ? "text-rose-700" : "text-slate-800"
                    )}
                  >
                    {formatCurrency(m.saldoBs, { symbol: "" })}
                  </td>
                  <td
                    className={cn(
                      "py-2 pr-3 text-right tabular-nums",
                      m.montoUsd < 0 ? "text-rose-600" : "text-slate-600"
                    )}
                  >
                    {m.montoUsd !== 0 ? formatCurrency(m.montoUsd, { symbol: "$" }) : ""}
                  </td>
                </tr>
              ))}
            </tbody>
            {filtered.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-slate-300 bg-slate-50/80 font-semibold">
                  <td className="py-2 pr-3" colSpan={5}>
                    Totales del filtro
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums text-emerald-700">
                    {formatCurrency(totals.ingresos, { symbol: "" })}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums text-rose-600">
                    {formatCurrency(totals.egresos, { symbol: "" })}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums text-amber-700">
                    {formatCurrency(totals.standBy, { symbol: "" })}
                  </td>
                  <td
                    className={cn(
                      "py-2 pr-3 text-right tabular-nums",
                      totals.net < 0 ? "text-rose-700" : "text-emerald-700"
                    )}
                  >
                    Net {formatCurrency(totals.net, { symbol: "" })}
                  </td>
                  <td className="py-2 pr-3" />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
