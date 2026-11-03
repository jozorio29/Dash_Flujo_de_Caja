import { parseAmount } from "./utils";

/**
 * Lógica pura (sin red) para interpretar la pestaña "P&L" del Google Sheet.
 *
 * Estructura esperada de la hoja:
 *   - Fila 1: encabezados.
 *   - Columna A = año, columna B = mes (nombre en español). Una fila por mes.
 *   - C … (antes de TC PARALELO)      → facturación (servicios y alquileres)
 *   - TC PARALELO                      → tipo de cambio del mes
 *   - Después de TC: bloques por servicio que empiezan con "HORAS FACTURADAS …"
 *   - Más adelante: indicadores, desde "Total Ingresos Operativos".
 *
 * Todo se detecta por el nombre del encabezado, no por la letra de la columna,
 * para que agregar columnas en el sheet no requiera tocar código.
 */

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface SeriesColumn {
  /** Clave usada en los datos (ej. "col_2") */
  key: string;
  /** Nombre a mostrar */
  label: string;
  /** Id del grupo al que pertenece (servicio / alquiler / país…) */
  group: string;
  /** Índice de columna en el sheet (0-based desde A) */
  sheetIndex: number;
}

export interface SeriesGroup {
  id: string;
  label: string;
}

export type IndicadorTipo = "monto" | "porcentaje";

export interface IndicadorColumn {
  key: string;
  label: string;
  sheetIndex: number;
  tipo: IndicadorTipo;
  /** true si un aumento es malo (costos, egresos, gastos) */
  inverso: boolean;
}

export interface PLRow {
  ano: number;
  mes: string;
  /** "YYYY-MM-01": se arma como texto para no depender de zonas horarias */
  fecha: string;
  tc: number;
  [key: string]: number | string;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const MESES: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7,
  agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
  ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6, jul: 7, ago: 8,
  sep: 9, sept: 9, set: 9, oct: 10, nov: 11, dic: 12,
};

/** Columna A = año, columna B = mes. Los datos empiezan en C (índice 2). */
export const DATA_START = 2;

// ─── Helpers de encabezados ───────────────────────────────────────────────────

/** Colapsa saltos de línea (Alt+Enter) y espacios múltiples. */
export function normalizeHeader(h: unknown): string {
  return String(h ?? "").replace(/\s+/g, " ").trim();
}

function plain(h: string): string {
  return h.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function isTCHeader(header: string): boolean {
  const h = plain(header);
  return (
    h === "tc" ||
    h === "t.c." ||
    h.startsWith("tc ") ||
    h.startsWith("t.c.") ||
    h.includes("tipo de cambio") ||
    h.includes("tipo cambio")
  );
}

/** Índice absoluto de la columna TC PARALELO (a partir de C), o null. */
export function findTCIndex(headers: string[]): number | null {
  for (let i = DATA_START; i < headers.length; i++) {
    if (isTCHeader(headers[i])) return i;
  }
  return null;
}

// ─── Selección de columnas por módulo ─────────────────────────────────────────

export const FACTURACION_GROUPS: SeriesGroup[] = [
  { id: "servicio", label: "Servicios" },
  { id: "alquiler", label: "Alquileres" },
];

/** Facturación: todo lo que hay desde C hasta antes de TC PARALELO. */
export function selectFacturacionColumns(headers: string[], tcIdx: number): SeriesColumn[] {
  const columns: SeriesColumn[] = [];
  for (let i = DATA_START; i < tcIdx; i++) {
    const label = headers[i];
    if (!label) continue;
    columns.push({
      key: `col_${i}`,
      label,
      group: plain(label).includes("alquiler") ? "alquiler" : "servicio",
      sheetIndex: i,
    });
  }
  return columns;
}

const HORAS_PREFIX = "horas facturadas";

/**
 * Horas: columnas después de TC PARALELO cuyo encabezado empieza con
 * "HORAS FACTURADAS". El resto del texto es el servicio ("Bolivia e-sim") y
 * su primera palabra es el grupo/país ("Bolivia").
 */
export function selectHorasColumns(
  headers: string[],
  tcIdx: number
): { columns: SeriesColumn[]; groups: SeriesGroup[] } {
  const columns: SeriesColumn[] = [];
  const groups: SeriesGroup[] = [];

  for (let i = tcIdx + 1; i < headers.length; i++) {
    const header = headers[i];
    if (!plain(header).startsWith(HORAS_PREFIX)) continue;

    const servicio = header.slice(HORAS_PREFIX.length).replace(/^[\s:–-]+/, "").trim();
    const label = servicio || header;
    const groupLabel = servicio ? servicio.split(" ")[0] : "General";
    const groupId = plain(groupLabel);
    if (!groups.some((g) => g.id === groupId)) groups.push({ id: groupId, label: groupLabel });

    columns.push({ key: `col_${i}`, label, group: groupId, sheetIndex: i });
  }
  return { columns, groups };
}

const INDICADORES_START = "total ingresos operativos";

/** Último indicador del bloque: "ROE % (Rentabilidad sobre Capital)". */
const INDICADORES_END = "roe";

/**
 * Indicadores: desde "Total Ingresos Operativos" hasta "ROE %" inclusive.
 * Las columnas que se agreguen en medio se toman solas. Si no hay ROE, corta
 * en la primera columna sin encabezado. Los encabezados con "%" son
 * porcentajes (en el sheet vienen como fracción: 0,46 = 46 %).
 */
export function selectIndicadoresColumns(headers: string[]): IndicadorColumn[] {
  const start = headers.findIndex((h, i) => i >= DATA_START && plain(h).startsWith(INDICADORES_START));
  if (start < 0) return [];

  const columns: IndicadorColumn[] = [];
  for (let i = start; i < headers.length; i++) {
    const label = headers[i];
    if (!label) {
      if (headers.slice(i).some((h) => plain(h).startsWith(INDICADORES_END))) continue;
      break;
    }
    const p = plain(label);
    columns.push({
      key: `col_${i}`,
      label,
      sheetIndex: i,
      tipo: label.includes("%") ? "porcentaje" : "monto",
      inverso: /costo|egreso|gasto/.test(p),
    });
    if (p.startsWith(INDICADORES_END)) break;
  }
  return columns;
}

// ─── Filas ────────────────────────────────────────────────────────────────────

/** Convierte las filas del sheet en filas mensuales con los valores pedidos. */
export function parsePLRows(
  rows: unknown[][],
  columns: { key: string; sheetIndex: number }[],
  tcIdx: number | null
): PLRow[] {
  const data: PLRow[] = [];

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row[0] == null || row[1] == null) continue;

    const ano = parseInt(String(row[0]).trim(), 10);
    const mesStr = plain(String(row[1]).trim());
    const mesNum = MESES[mesStr];
    if (isNaN(ano) || !mesNum) continue;

    const tc = tcIdx !== null ? parseAmount(row[tcIdx] as string | number) || 1 : 1;
    const dataRow: PLRow = {
      ano,
      mes: mesStr,
      fecha: `${ano}-${String(mesNum).padStart(2, "0")}-01`,
      tc,
    };
    for (const col of columns) {
      dataRow[col.key] = parseAmount(row[col.sheetIndex] as string | number);
    }
    data.push(dataRow);
  }

  return data.sort((a, b) => a.fecha.localeCompare(b.fecha));
}
