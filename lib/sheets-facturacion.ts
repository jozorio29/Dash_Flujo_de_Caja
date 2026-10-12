import { fetchSheetValues } from "./google-sheets-client";
import { parseAmount } from "./utils";

// ─── Tipos exportados ─────────────────────────────────────────────────────────

export type ColumnCategoria = "servicio" | "alquiler";

export interface FacturacionColumn {
  /** Clave sanitizada usada como key en los datos (ej. "col_2") */
  key: string;
  /** Nombre original del header en el sheet */
  label: string;
  /** Categoría derivada dinámicamente del header */
  categoria: ColumnCategoria;
  /** Índice de columna en el sheet (0-based desde A) */
  sheetIndex: number;
}

export interface FacturacionRow {
  ano: number;
  mes: string;
  tc: number;
  fecha: Date;
  /** Valores numéricos indexados por column.key */
  [key: string]: number | string | Date;
}

export interface FacturacionResult {
  columns: FacturacionColumn[];
  data: FacturacionRow[];
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const MESES: Record<string, number> = {
  enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5,
  julio: 6, agosto: 7, septiembre: 8, octubre: 9, noviembre: 10, diciembre: 11,
};

/** Columna A = año, columna B = mes. Los datos empiezan en C (índice 2). */
const DATA_START = 2;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Detecta el índice (0-based dentro del arreglo dataHeaders) de la columna TC.
 * Coincide con headers como "TC", "T.C.", o que contengan "tipo de cambio".
 */
function findTCRelIdx(dataHeaders: string[]): number | null {
  for (let i = 0; i < dataHeaders.length; i++) {
    const h = dataHeaders[i].trim().toLowerCase();
    if (h === "tc" || h === "t.c." || h.includes("tipo de cambio")) {
      return i;
    }
  }
  return null;
}

/**
 * Determina la categoría de cada columna de datos.
 * Regla: desde la primera columna cuyo header contenga "alquiler",
 * esa y todas las siguientes son "alquiler". Las anteriores son "servicio".
 */
function buildCategorias(dataHeaders: string[], tcRelIdx: number | null): ColumnCategoria[] {
  let alquilerStarted = false;
  return dataHeaders.map((h, i) => {
    if (i === tcRelIdx) return "servicio"; // placeholder; la columna TC se excluye después
    if (!alquilerStarted && h.toLowerCase().includes("alquiler")) {
      alquilerStarted = true;
    }
    return alquilerStarted ? "alquiler" : "servicio";
  });
}

// ─── Función principal ────────────────────────────────────────────────────────

export async function getFacturacionData(): Promise<FacturacionResult> {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  if (!spreadsheetId) return { columns: [], data: [] };

  // Leer rango amplio hasta Z para soportar futuras columnas sin tocar el código
  const rows = await fetchSheetValues(spreadsheetId, "P&L!A:Z");
  if (!rows || rows.length < 2) return { columns: [], data: [] };

  // ── Fila 0: headers ──────────────────────────────────────────────────────
  const headerRow: string[] = rows[0].map((h: any) => String(h ?? "").trim());

  // Determinar el último índice con header no vacío
  let lastHeaderIdx = headerRow.length - 1;
  while (lastHeaderIdx >= DATA_START && !headerRow[lastHeaderIdx]) lastHeaderIdx--;

  const dataHeaders = headerRow.slice(DATA_START, lastHeaderIdx + 1);

  // Detectar columna TC dentro del rango de datos
  const tcRelIdx = findTCRelIdx(dataHeaders);
  const tcAbsIdx = tcRelIdx !== null ? DATA_START + tcRelIdx : null;

  // Asignar categorías
  const categorias = buildCategorias(dataHeaders, tcRelIdx);

  // Construir array de columnas (excluye TC y headers vacíos)
  const columns: FacturacionColumn[] = [];
  dataHeaders.forEach((label, relIdx) => {
    const absIdx = DATA_START + relIdx;
    if (absIdx === tcAbsIdx) return; // TC es especial, no es columna de datos
    if (!label) return;              // ignorar celdas vacías

    columns.push({
      key: `col_${absIdx}`,
      label,
      categoria: categorias[relIdx],
      sheetIndex: absIdx,
    });
  });

  // ── Filas de datos ───────────────────────────────────────────────────────
  const data: FacturacionRow[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !row[0] || !row[1]) continue;

    const anoStr = String(row[0]).trim();
    const mesStr = String(row[1]).trim().toLowerCase();

    const ano = parseInt(anoStr, 10);
    if (isNaN(ano)) continue;

    const mesIndex = MESES[mesStr];
    if (mesIndex === undefined) continue;

    const fecha = new Date(ano, mesIndex, 1);
    const tc = tcAbsIdx !== null ? (parseAmount(row[tcAbsIdx]) || 1) : 1;

    const dataRow: FacturacionRow = { ano, mes: mesStr, tc, fecha };

    columns.forEach((col) => {
      dataRow[col.key] = parseAmount(row[col.sheetIndex]) ?? 0;
    });

    data.push(dataRow);
  }

  // Ordenar por fecha ascendente
  data.sort((a, b) => (a.fecha as Date).getTime() - (b.fecha as Date).getTime());

  return { columns, data };
}
