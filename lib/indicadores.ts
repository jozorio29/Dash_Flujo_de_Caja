/**
 * Cálculos de los tableros de Indicadores (lógica pura, usada en el cliente).
 *
 * - Montos: se suman los meses del período (convertidos con el TC de cada mes).
 * - Porcentajes (vienen como fracción, 0,46 = 46 %): en un mes es el valor del
 *   mes; en un acumulado se promedian ponderando por los ingresos de cada mes.
 *   Para márgenes sobre ingresos (EBITDA %, Margen neto %) eso da exactamente
 *   Σ utilidad / Σ ingresos.
 */

export type Modo = "mes" | "ytd";
export type Comparacion = "anterior" | "anio";
export type Moneda = "USD" | "BOB";

export interface IndicadorCol {
  key: string;
  label: string;
  tipo: "monto" | "porcentaje";
  inverso: boolean;
}

export interface IndicadorRow {
  ano: number;
  fecha: string; // YYYY-MM-01
  tc: number;
  [key: string]: number | string;
}

export interface KPI {
  col: IndicadorCol;
  actual: number | null;
  anterior: number | null;
  /** Montos: variación % · Porcentajes: diferencia en puntos porcentuales */
  delta: number | null;
  /** true = la variación es buena (considera los indicadores inversos) */
  favorable: boolean | null;
}

/** "YYYY-MM" del mes anterior. */
export function prevMonth(periodo: string): string {
  const [y, m] = periodo.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

/** "YYYY-MM" del mismo mes del año anterior. */
export function prevYear(periodo: string): string {
  const [y, m] = periodo.split("-");
  return `${Number(y) - 1}-${m}`;
}

/** Período contra el que se compara. El acumulado siempre se compara contra el año anterior. */
export function comparisonEnd(periodo: string, modo: Modo, comparar: Comparacion): string {
  return modo === "mes" && comparar === "anterior" ? prevMonth(periodo) : prevYear(periodo);
}

/** Filas del período: el mes, o de enero hasta el mes (acumulado del año). */
export function periodRows<T extends IndicadorRow>(rows: T[], periodo: string, modo: Modo): T[] {
  if (modo === "mes") return rows.filter((r) => r.fecha.startsWith(periodo));
  const year = periodo.slice(0, 4);
  return rows.filter((r) => r.fecha.startsWith(year) && r.fecha.slice(0, 7) <= periodo);
}

function num(row: IndicadorRow, key: string): number {
  const v = row[key];
  return typeof v === "number" && isFinite(v) ? v : 0;
}

export function aggregate(
  rows: IndicadorRow[],
  col: IndicadorCol,
  moneda: Moneda,
  weightKey: string | null
): number | null {
  if (rows.length === 0) return null;
  const fx = (r: IndicadorRow) => (moneda === "BOB" ? r.tc : 1);

  if (col.tipo === "monto") {
    return rows.reduce((acc, r) => acc + num(r, col.key) * fx(r), 0);
  }

  if (rows.length === 1) return num(rows[0], col.key);
  if (weightKey) {
    const wTotal = rows.reduce((acc, r) => acc + num(r, weightKey) * fx(r), 0);
    if (wTotal !== 0) {
      return rows.reduce((acc, r) => acc + num(r, col.key) * num(r, weightKey) * fx(r), 0) / wTotal;
    }
  }
  return rows.reduce((acc, r) => acc + num(r, col.key), 0) / rows.length;
}

export function delta(col: IndicadorCol, actual: number | null, anterior: number | null): number | null {
  if (actual === null || anterior === null) return null;
  if (col.tipo === "porcentaje") return (actual - anterior) * 100;
  if (anterior === 0) return null;
  return ((actual - anterior) / Math.abs(anterior)) * 100;
}

/** Columna de ingresos usada para ponderar los porcentajes en un acumulado. */
export function findWeightKey(cols: IndicadorCol[]): string | null {
  return cols.find((c) => c.tipo === "monto" && /ingreso/i.test(c.label))?.key ?? null;
}

export function computeKPIs(
  rows: IndicadorRow[],
  cols: IndicadorCol[],
  opts: { periodo: string; modo: Modo; comparar: Comparacion; moneda: Moneda }
): KPI[] {
  const weightKey = findWeightKey(cols);
  const cur = periodRows(rows, opts.periodo, opts.modo);
  const prev = periodRows(rows, comparisonEnd(opts.periodo, opts.modo, opts.comparar), opts.modo);

  return cols.map((col) => {
    const actual = aggregate(cur, col, opts.moneda, weightKey);
    const anterior = aggregate(prev, col, opts.moneda, weightKey);
    const d = delta(col, actual, anterior);
    return {
      col,
      actual,
      anterior,
      delta: d,
      favorable: d === null || d === 0 ? null : col.inverso ? d < 0 : d > 0,
    };
  });
}

/** Último mes con datos que no sea futuro (respecto de `hoy`, "YYYY-MM"). */
export function defaultPeriodo(rows: IndicadorRow[], cols: IndicadorCol[], hoy: string): string | null {
  const conDatos = rows.filter(
    (r) => r.fecha.slice(0, 7) <= hoy && cols.some((c) => num(r, c.key) !== 0)
  );
  const lista = conDatos.length ? conDatos : rows;
  return lista.length ? lista[lista.length - 1].fecha.slice(0, 7) : null;
}
