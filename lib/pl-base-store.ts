import "server-only";
import { appendSheetRow, ensureSheet, fetchSheetGrid, writeSheetCell, type GridCell } from "./google-sheets-client";
import {
  buildStatement,
  editableText,
  findEditableCell,
  LABEL_COL,
  LOG_HEADERS,
  LOG_SHEET,
  logRow,
  validateCellInput,
} from "./pl-base-sheet";

/**
 * Origen del P&L de la contadora (Google Sheet horizontal).
 * PL_BASE_SPREADSHEET_ID: ID del documento ("🇧🇴 P&L SUC. BOLIVIA …").
 * PL_BASE_SHEET_NAME:     pestaña (por defecto "EUROPE SUC. BOLIVIA real USD").
 * PL_BASE_EDITOR_EMAILS:  correos que pueden editar desde el portal, separados
 *                         por coma. Mientras no se defina, edita cualquier
 *                         usuario con sesión.
 */
export function plBaseConfig(): { spreadsheetId: string; sheetName: string } | null {
  const spreadsheetId = process.env.PL_BASE_SPREADSHEET_ID?.trim();
  if (!spreadsheetId) return null;
  const sheetName = process.env.PL_BASE_SHEET_NAME?.trim() || "EUROPE SUC. BOLIVIA real USD";
  return { spreadsheetId, sheetName };
}

export function canEditPLBase(email: string): boolean {
  const editors = (process.env.PL_BASE_EDITOR_EMAILS || "")
    .split(",")
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
  if (editors.length === 0) return true;
  return editors.includes(email.trim().toLowerCase());
}

function quotedSheet(name: string) {
  return `'${name.replace(/'/g, "''")}'`;
}

export async function readPLBaseGrid(): Promise<GridCell[][]> {
  const config = plBaseConfig();
  if (!config) throw new Error("Falta configurar PL_BASE_SPREADSHEET_ID en el servidor.");
  const sheet = quotedSheet(config.sheetName);
  // Valores y fórmulas de toda la hoja + formato (negrita, fondo) solo de la columna B.
  const [grid, labels] = await Promise.all([
    fetchSheetGrid(config.spreadsheetId, sheet),
    fetchSheetGrid(config.spreadsheetId, `${sheet}!B:B`, { withFormat: true }),
  ]);
  labels.forEach((row, r) => {
    const format = row[0]?.effectiveFormat;
    if (!format) return;
    grid[r] = grid[r] || [];
    grid[r][LABEL_COL] = { ...grid[r][LABEL_COL], effectiveFormat: format };
  });
  return grid;
}

export interface CellEdit {
  row: number;
  address: string;
  label: string;
  formula: string | null;
  value: number | null;
  input: string;
  /** Zona horaria del navegador de quien edita (solo para mostrar la fecha del registro). */
  timeZone?: string;
}

/**
 * Guarda una celda en el Sheet: relee el Sheet, verifica que la fila y la celda
 * sigan como el usuario las vio, escribe el valor y registra el cambio en la
 * hoja oculta "Log Portal". Devuelve un aviso si el registro falló.
 */
export async function savePLBaseCell(edit: CellEdit, email: string): Promise<{ logWarning?: string }> {
  const config = plBaseConfig();
  if (!config) throw new Error("Falta configurar PL_BASE_SPREADSHEET_ID en el servidor.");
  const input = validateCellInput(edit.input);
  const statement = buildStatement(await readPLBaseGrid());
  const { row, cell, year, month } = findEditableCell(statement, edit);

  await writeSheetCell(config.spreadsheetId, `${quotedSheet(config.sheetName)}!${cell.address}`, input);

  // El importe ya quedó guardado: si el registro falla, se avisa sin deshacer.
  try {
    await ensureSheet(config.spreadsheetId, LOG_SHEET, { hidden: true, headers: LOG_HEADERS });
    await appendSheetRow(
      config.spreadsheetId,
      LOG_SHEET,
      logRow(
        { email, address: cell.address, row: row.row, year, month, before: editableText(cell), after: input },
        new Date(),
        edit.timeZone
      )
    );
    return {};
  } catch (error) {
    console.error("No se pudo registrar el cambio en Log Portal:", error);
    return { logWarning: "El valor se guardó, pero no se pudo registrar en la hoja Log Portal." };
  }
}
