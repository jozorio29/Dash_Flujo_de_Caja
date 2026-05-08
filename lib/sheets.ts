import { Movement, MovementType } from "./types";
import { parseAmount, parseDate } from "./utils";

interface SheetsResponse {
  range: string;
  majorDimension: string;
  values: string[][];
}

/**
 * Lee el rango configurado del Google Sheet vía REST + API key.
 * No requiere OAuth porque el sheet debe estar compartido como público (lectura).
 */
export async function fetchSheetRows(): Promise<string[][]> {
  const apiKey = process.env.GOOGLE_SHEETS_API_KEY;
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  const range = process.env.GOOGLE_SHEETS_RANGE || "Hoja 1!A:N";

  if (!apiKey) throw new Error("GOOGLE_SHEETS_API_KEY no configurada en .env.local");
  if (!spreadsheetId) throw new Error("GOOGLE_SHEETS_SPREADSHEET_ID no configurada en .env.local");

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
    range
  )}?key=${apiKey}&valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=FORMATTED_STRING`;

  const res = await fetch(url, { next: { revalidate: 60 } });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Google Sheets API error ${res.status}: ${body}`);
  }
  const data: SheetsResponse = await res.json();
  return data.values || [];
}

/**
 * Detecta la fila de headers buscando "Fecha" en la primera columna.
 * Acepta hasta 5 filas de "ruido" arriba (TOTALES, títulos, etc.).
 */
function findHeaderRowIndex(rows: string[][]): number {
  for (let i = 0; i < Math.min(rows.length, 5); i++) {
    const first = String(rows[i]?.[0] || "").trim().toLowerCase();
    if (first === "fecha") return i;
  }
  return 0;
}

/**
 * Posiciones (0-indexed) en el Google Sheet de las columnas que SÍ usamos.
 * Las columnas B, E, G, H (Hora, Descripción, Cód. Trans., ITF) y O (Adicionales)
 * existen en el sheet pero las ignoramos por completo.
 *
 *   A=0  Fecha
 *   B=1  (Hora)        ← ignorada
 *   C=2  Mes
 *   D=3  Oficina
 *   E=4  (Descripción) ← ignorada
 *   F=5  Referencia
 *   G=6  (Cód. Trans.) ← ignorada
 *   H=7  (ITF)         ← ignorada
 *   I=8  Tipo
 *   J=9  Concepto P&L
 *   K=10 Desc P&L
 *   L=11 Débitos
 *   M=12 Créditos
 *   N=13 Saldo
 */
const COLUMN_INDEX = {
  fecha: 0,
  mes: 2,
  oficina: 3,
  referencia: 5,
  tipo: 8,
  conceptoPL: 9,
  descPL: 10,
  debitos: 11,
  creditos: 12,
  saldo: 13,
} as const;

/**
 * Convierte las filas crudas en Movement[] tipados.
 */
export function parseMovements(rows: string[][]): Movement[] {
  if (!rows.length) return [];
  const headerIdx = findHeaderRowIndex(rows);
  const dataRows = rows.slice(headerIdx + 1);

  const movements: Movement[] = [];
  for (const row of dataRows) {
    if (!row || row.length === 0) continue;

    const fechaRaw = String(row[COLUMN_INDEX.fecha] ?? "").trim();
    const debitos = parseAmount(row[COLUMN_INDEX.debitos]);
    const creditos = parseAmount(row[COLUMN_INDEX.creditos]);

    // ⚠️ CRÍTICO: solo procesar filas con FECHA VÁLIDA.
    // Esto evita sumar filas de TOTALES, subtotales, encabezados de mes,
    // separadores, o cualquier fila resumen que tenga valores en L/M
    // pero no represente un movimiento real.
    const parsedFecha = parseDate(row[COLUMN_INDEX.fecha] as any);
    if (!parsedFecha) continue;

    // Doble seguro: saltar etiquetas "TOTAL", "TOTALES", "SUBTOTAL", etc.
    // que pudieran haber pasado el filtro de fecha.
    if (/^(total|subtotal|saldo)/i.test(fechaRaw)) continue;
    const cualquierTotalEnRow = row.some((v) => /^(total|subtotal)/i.test(String(v ?? "").trim()));
    if (cualquierTotalEnRow && (!fechaRaw || isNaN(parsedFecha.getTime()))) continue;

    const tipoRaw = String(row[COLUMN_INDEX.tipo] ?? "").trim().toUpperCase();
    let tipo: MovementType = "OTRO";
    if (tipoRaw.startsWith("INGR")) tipo = "INGRESO";
    else if (tipoRaw.startsWith("EGR")) tipo = "EGRESO";
    else if (creditos > 0 && debitos === 0) tipo = "INGRESO";
    else if (debitos > 0 && creditos === 0) tipo = "EGRESO";

    const conceptoPL = String(row[COLUMN_INDEX.conceptoPL] ?? "").trim();
    const descPL = String(row[COLUMN_INDEX.descPL] ?? "").trim();
    const categoria = conceptoPL || descPL || "Otros";

    movements.push({
      fecha: parsedFecha,
      fechaRaw,
      mes: String(row[COLUMN_INDEX.mes] ?? "").trim(),
      oficina: String(row[COLUMN_INDEX.oficina] ?? "").trim(),
      referencia: String(row[COLUMN_INDEX.referencia] ?? "").trim(),
      tipo,
      conceptoPL,
      descPL,
      debitos,
      creditos,
      saldo: parseAmount(row[COLUMN_INDEX.saldo]),
      monto: creditos - debitos,
      categoria,
    });
  }

  // Ordenar por fecha ascendente
  movements.sort((a, b) => {
    const ta = a.fecha?.getTime() ?? 0;
    const tb = b.fecha?.getTime() ?? 0;
    return ta - tb;
  });

  return movements;
}

export async function getMovements(): Promise<Movement[]> {
  const rows = await fetchSheetRows();
  return parseMovements(rows);
}
