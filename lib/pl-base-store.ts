import "server-only";
import { fetchSheetGrid, type GridCell } from "./google-sheets-client";
import { LABEL_COL } from "./pl-base-sheet";

/**
 * Origen del P&L de la contadora (Google Sheet horizontal).
 * PL_BASE_SPREADSHEET_ID: ID del documento ("🇧🇴 P&L SUC. BOLIVIA …").
 * PL_BASE_SHEET_NAME:     pestaña (por defecto "EUROPE SUC. BOLIVIA real USD").
 */
export function plBaseConfig(): { spreadsheetId: string; sheetName: string } | null {
  const spreadsheetId = process.env.PL_BASE_SPREADSHEET_ID?.trim();
  if (!spreadsheetId) return null;
  const sheetName = process.env.PL_BASE_SHEET_NAME?.trim() || "EUROPE SUC. BOLIVIA real USD";
  return { spreadsheetId, sheetName };
}

export async function readPLBaseGrid(): Promise<GridCell[][]> {
  const config = plBaseConfig();
  if (!config) throw new Error("Falta configurar PL_BASE_SPREADSHEET_ID en el servidor.");
  const sheet = `'${config.sheetName.replace(/'/g, "''")}'`;
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
