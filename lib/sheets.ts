import { Movement, MovementType } from "./types";
import { parseAmount, parseDate } from "./utils";
import { fetchSheetValues } from "./google-sheets-client";

/**
 * Lee el rango configurado del Google Sheet.
 * Para hojas restringidas usa la cuenta de servicio configurada en el servidor.
 */
export async function fetchSheetRows(): Promise<string[][]> {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  const range = process.env.GOOGLE_SHEETS_RANGE || "Hoja 1!A:S";

  if (!spreadsheetId) throw new Error("GOOGLE_SHEETS_SPREADSHEET_ID no configurada en .env.local");

  return fetchSheetValues(spreadsheetId, range);
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
 * Las columnas E, G, H, P, Q, R existen pero las ignoramos.
 *
 *   A=0  Fecha
 *   B=1  Hora
 *   C=2  Mes
 *   D=3  Oficina
 *   E=4  (Descripción) ← ignorada
 *   F=5  Referencia
 *   G=6  (Cód. Trans.) ← ignorada
 *   H=7  (ITF)         ← ignorada
 *   I=8  Tipo
 *   J=9  Concepto P&L
 *   K=10 Desc P&L
 *   L=11 Detalle P&L
 *   M=12 Débitos (Bs)
 *   N=13 Créditos (Bs)
 *   O=14 Saldo (Bs)
 *   S=18 Saldo (USD)
 */
const COLUMN_INDEX = {
  fecha: 0,
  hora: 1,
  mes: 2,
  oficina: 3,
  referencia: 5,
  tipo: 8,
  conceptoPL: 9,
  descPL: 10,
  detallePL: 11,
  debitos: 12,
  creditos: 13,
  saldo: 14,
  saldoUsd: 18,
} as const;

function parseTimeMs(raw: string | number | null | undefined): number {
  if (raw === null || raw === undefined || raw === "") return 0;

  if (typeof raw === "number") {
    const normalized = raw >= 1 ? raw % 1 : raw;
    if (normalized >= 0 && normalized < 1) {
      return Math.round(normalized * 24 * 60 * 60 * 1000);
    }
    return 0;
  }

  const s = String(raw).trim();
  if (!s) return 0;

  const match = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(a\.?\s*m\.?|p\.?\s*m\.?|am|pm)?$/i);
  if (!match) return 0;

  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const seconds = match[3] ? parseInt(match[3], 10) : 0;
  const meridiem = match[4]?.toLowerCase().replace(/[\s.]/g, "");

  if (meridiem === "pm" && hours < 12) hours += 12;
  if (meridiem === "am" && hours === 12) hours = 0;
  if (hours > 23 || minutes > 59 || seconds > 59) return 0;

  return ((hours * 60 + minutes) * 60 + seconds) * 1000;
}

function movementTimeMs(fecha: Date, horaRaw: string | number | null | undefined): number {
  return fecha.getTime() + parseTimeMs(horaRaw);
}

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
    const horaRaw = String(row[COLUMN_INDEX.hora] ?? "").trim();
    const debitos = parseAmount(row[COLUMN_INDEX.debitos]);
    const creditos = parseAmount(row[COLUMN_INDEX.creditos]);

    // ⚠️ CRÍTICO: solo procesar filas con FECHA VÁLIDA.
    // Esto evita sumar filas de TOTALES, subtotales, encabezados de mes,
    // separadores, o cualquier fila resumen que tenga valores en M/N
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
    const detallePL = String(row[COLUMN_INDEX.detallePL] ?? "").trim();
    const categoria = conceptoPL || descPL || "Otros";

    movements.push({
      fecha: parsedFecha,
      fechaRaw,
      horaRaw,
      fechaHoraMs: movementTimeMs(parsedFecha, row[COLUMN_INDEX.hora] as any),
      mes: String(row[COLUMN_INDEX.mes] ?? "").trim(),
      oficina: String(row[COLUMN_INDEX.oficina] ?? "").trim(),
      referencia: String(row[COLUMN_INDEX.referencia] ?? "").trim(),
      tipo,
      conceptoPL,
      descPL,
      detallePL,
      debitos,
      creditos,
      saldo: parseAmount(row[COLUMN_INDEX.saldo]),
      saldoUsd: parseAmount(row[COLUMN_INDEX.saldoUsd]),
      monto: creditos - debitos,
      categoria,
    });
  }

  // Ordenar por fecha y hora ascendente.
  movements.sort((a, b) => {
    const ta = a.fechaHoraMs || a.fecha?.getTime() || 0;
    const tb = b.fechaHoraMs || b.fecha?.getTime() || 0;
    return ta - tb;
  });

  return movements;
}

export async function getMovements(): Promise<Movement[]> {
  const rows = await fetchSheetRows();
  return parseMovements(rows);
}
