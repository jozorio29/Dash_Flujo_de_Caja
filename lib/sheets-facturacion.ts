import { fetchSheetValues } from "./google-sheets-client";
import {
  FACTURACION_GROUPS,
  findTCIndex,
  normalizeHeader,
  parsePLRows,
  selectFacturacionColumns,
  selectHorasColumns,
  selectIndicadoresColumns,
  type IndicadorColumn,
  type PLRow,
  type SeriesColumn,
  type SeriesGroup,
} from "./pl-sheet";

export interface SeriesResult {
  columns: SeriesColumn[];
  groups: SeriesGroup[];
  data: PLRow[];
}

export interface IndicadoresResult {
  columns: IndicadorColumn[];
  data: PLRow[];
}

/** Lee la pestaña P&L completa (sin límite de columnas). */
async function readPL(): Promise<{ rows: unknown[][]; headers: string[] } | null> {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  if (!spreadsheetId) return null;
  const rows = await fetchSheetValues(spreadsheetId, "P&L");
  if (!rows || rows.length < 2) return null;
  return { rows, headers: rows[0].map(normalizeHeader) };
}

function requireTC(headers: string[]): number {
  const tcIdx = findTCIndex(headers);
  if (tcIdx === null) {
    // Sin TC no sabemos dónde termina la facturación: mejor fallar que mostrar
    // columnas de otras secciones como ingresos.
    throw new Error('No se encontró la columna "TC PARALELO" en los encabezados de la hoja P&L');
  }
  return tcIdx;
}

/** Facturación: columnas desde C hasta antes de TC PARALELO. */
export async function getFacturacionData(): Promise<SeriesResult> {
  const sheet = await readPL();
  if (!sheet) return { columns: [], groups: FACTURACION_GROUPS, data: [] };
  const tcIdx = requireTC(sheet.headers);
  const columns = selectFacturacionColumns(sheet.headers, tcIdx);
  return { columns, groups: FACTURACION_GROUPS, data: parsePLRows(sheet.rows, columns, tcIdx) };
}

/** Horas: columnas "HORAS FACTURADAS …" ubicadas después de TC PARALELO. */
export async function getHorasData(): Promise<SeriesResult> {
  const sheet = await readPL();
  if (!sheet) return { columns: [], groups: [], data: [] };
  const tcIdx = requireTC(sheet.headers);
  const { columns, groups } = selectHorasColumns(sheet.headers, tcIdx);
  return { columns, groups, data: parsePLRows(sheet.rows, columns, tcIdx) };
}

/** Indicadores: desde "Total Ingresos Operativos" en adelante. */
export async function getIndicadoresData(): Promise<IndicadoresResult> {
  const sheet = await readPL();
  if (!sheet) return { columns: [], data: [] };
  const columns = selectIndicadoresColumns(sheet.headers);
  if (columns.length === 0) {
    throw new Error('No se encontró la columna "Total Ingresos Operativos" en la hoja P&L');
  }
  return { columns, data: parsePLRows(sheet.rows, columns, findTCIndex(sheet.headers)) };
}
