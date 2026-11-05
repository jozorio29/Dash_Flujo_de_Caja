import type { GridCell } from "./google-sheets-client";
import type { IndicadorColumn, PLRow, SeriesColumn, SeriesGroup } from "./pl-sheet";

/**
 * Lógica pura (sin red) para interpretar el P&L horizontal de la contadora
 * ("EUROPE SUC. BOLIVIA real USD"):
 *
 *   - Columna B: nombre de cada fila (sección, grupo, cuenta, total).
 *   - Una fila de encabezado con fechas (ene-25 … dic-25, TOTALES 2025, …).
 *     Cada año es un bloque de 12 meses + su columna de total. Los años nuevos
 *     se agregan a la derecha y se detectan solos.
 *   - Los totales y grupos los calcula el propio Sheet con fórmulas: aquí solo
 *     se leen, nunca se suman.
 *
 * Las filas se ubican por su nombre, no por su número, para que insertar filas
 * en el Sheet no rompa nada.
 */

export const LABEL_COL = 1; // B

const MONTH_NAMES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

export function plain(text: string): string {
  return text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();
}

function label(row: GridCell[] | undefined): string {
  return String(row?.[LABEL_COL]?.formattedValue ?? "").replace(/\s+/g, " ").trim();
}

function num(cell: GridCell | undefined): number | null {
  const v = cell?.effectiveValue?.numberValue;
  return typeof v === "number" && isFinite(v) ? v : null;
}

/** Letra de columna (0 → A, 27 → AB). */
export function columnLetter(index: number): string {
  let s = "";
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  }
  return s;
}

// ─── Bloques de años ──────────────────────────────────────────────────────────

export interface YearBlock {
  year: number;
  /** Índice de columna de cada mes (posición 0 = enero). -1 si falta. */
  months: number[];
  /** Columna "TOTALES …" del año, o -1. */
  totalCol: number;
}

/** Serial de fecha de Sheets (días desde 30/12/1899) → año y mes. */
function serialToYearMonth(serial: number): { year: number; month: number } {
  const date = new Date(Math.round((serial - 25569) * 86400000));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 };
}

function isDateSerial(value: number | null): value is number {
  return value !== null && value > 36500 && value < 73000; // años 2000–2099
}

/** Primera fila con al menos 6 fechas: es el encabezado de meses. */
export function findHeaderRow(grid: GridCell[][]): number {
  for (let r = 0; r < Math.min(grid.length, 20); r++) {
    if ((grid[r] || []).filter((c) => isDateSerial(num(c))).length >= 6) return r;
  }
  return -1;
}

export function findYearBlocks(grid: GridCell[][], headerRow: number): YearBlock[] {
  const header = grid[headerRow] || [];
  const blocks = new Map<number, YearBlock>();
  let last: YearBlock | null = null;
  header.forEach((cell, col) => {
    const value = num(cell);
    if (isDateSerial(value)) {
      const { year, month } = serialToYearMonth(value);
      let block = blocks.get(year);
      if (!block) {
        block = { year, months: Array(12).fill(-1), totalCol: -1 };
        blocks.set(year, block);
      }
      if (block.months[month - 1] === -1) block.months[month - 1] = col;
      last = block;
      return;
    }
    const text = plain(String(cell?.formattedValue ?? ""));
    if (last && last.totalCol === -1 && text.startsWith("total")) last.totalCol = col;
  });
  return [...blocks.values()].sort((a, b) => a.year - b.year);
}

/** Número de fila (0-based) cuyo nombre empieza con el texto dado. */
export function findRowIndex(grid: GridCell[][], prefix: string, from = 0, to = grid.length): number {
  const p = plain(prefix);
  for (let r = from; r < Math.min(to, grid.length); r++) {
    if (plain(label(grid[r])).startsWith(p)) return r;
  }
  return -1;
}

// ─── Series mensuales (Facturación, Horas, Indicadores) ───────────────────────

/** sheetIndex = índice de fila (0-based) en este Sheet horizontal. */
interface SeriesSpec {
  key: string;
  sheetIndex: number;
}

/** Una fila por mes con los valores de las filas pedidas, igual que la hoja P&L vertical. */
export function monthlyRows(grid: GridCell[][], blocks: YearBlock[], specs: SeriesSpec[]): PLRow[] {
  const tcRow = findRowIndex(grid, "TC PARALELO");
  const data: PLRow[] = [];
  for (const block of blocks) {
    block.months.forEach((col, m) => {
      if (col < 0) return;
      const tc = tcRow >= 0 ? num(grid[tcRow]?.[col]) : null;
      const row: PLRow = {
        ano: block.year,
        mes: MONTH_NAMES[m],
        fecha: `${block.year}-${String(m + 1).padStart(2, "0")}-01`,
        tc: tc && tc > 0 ? tc : 1,
      };
      for (const spec of specs) row[spec.key] = num(grid[spec.sheetIndex]?.[col]) ?? 0;
      data.push(row);
    });
  }
  return data.sort((a, b) => a.fecha.localeCompare(b.fecha));
}

/** Facturación: las cuentas entre "TC PARALELO" y "Total Ingresos Operativos". */
export function facturacionSpecs(grid: GridCell[][]): SeriesColumn[] {
  const tcRow = findRowIndex(grid, "TC PARALELO");
  const totalRow = findRowIndex(grid, "Total Ingresos Operativos", Math.max(tcRow, 0));
  if (tcRow < 0 || totalRow < 0) {
    throw new Error('No se encontraron las filas "TC PARALELO" y "Total Ingresos Operativos" en el P&L.');
  }
  const columns: SeriesColumn[] = [];
  for (let r = tcRow + 1; r < totalRow; r++) {
    const name = label(grid[r]);
    if (!name) continue;
    columns.push({
      key: `row_${r + 1}`,
      label: name,
      group: plain(name).includes("alquiler") ? "alquiler" : "servicio",
      sheetIndex: r,
    });
  }
  return columns;
}

/** Horas: filas que empiezan con "HORAS FACTURADAS"; el resto del texto es el servicio. */
export function horasSpecs(grid: GridCell[][]): { columns: SeriesColumn[]; groups: SeriesGroup[] } {
  const columns: SeriesColumn[] = [];
  const groups: SeriesGroup[] = [];
  grid.forEach((row, r) => {
    const name = label(row);
    if (!plain(name).startsWith("horas facturadas")) return;
    const servicio = name.slice("HORAS FACTURADAS".length).replace(/^[\s:–-]+/, "").trim();
    const groupLabel = servicio ? servicio.split(" ")[0] : "General";
    const groupId = plain(groupLabel);
    if (!groups.some((g) => g.id === groupId)) groups.push({ id: groupId, label: groupLabel });
    columns.push({ key: `row_${r + 1}`, label: servicio || name, group: groupId, sheetIndex: r });
  });
  return { columns, groups };
}

function indicador(row: number, name: string): IndicadorColumn {
  const p = plain(name);
  return {
    key: `row_${row + 1}`,
    label: name,
    sheetIndex: row,
    tipo: name.includes("%") ? "porcentaje" : "monto",
    inverso: /costo|egreso|gasto/.test(p),
  };
}

/**
 * Indicadores: los tres totales de sección y, del bloque de resultados del
 * final, todo lo que viene después de "TOTAL INGRESOS" hasta "MARGEN NETO %"
 * (TOTAL EGRESOS, EBITDA, EBITDA %, UTILIDAD NETA, …). Si la contadora agrega
 * un indicador en ese bloque, aparece solo.
 */
export function indicadoresSpecs(grid: GridCell[][]): IndicadorColumn[] {
  const columns: IndicadorColumn[] = [];
  for (const total of ["Total Ingresos Operativos", "Total Costos de Servicios", "Total Egresos Operativos"]) {
    const r = findRowIndex(grid, total);
    if (r >= 0) columns.push(indicador(r, label(grid[r])));
  }
  const start = findRowIndex(grid, "TOTAL INGRESOS", findRowIndex(grid, "TOTAL APORTES") + 1);
  const end = findRowIndex(grid, "MARGEN NETO", Math.max(start, 0));
  if (start >= 0 && end >= 0) {
    for (let r = start + 1; r <= end; r++) {
      const name = label(grid[r]);
      if (name) columns.push(indicador(r, plain(name) === "total egresos" ? "TOTAL EGRESOS (costos + egresos operativos)" : name));
    }
  }
  if (columns.length === 0) throw new Error('No se encontró "Total Ingresos Operativos" en el P&L.');
  return columns;
}

// ─── Estado de Resultados (vista de tabla) ────────────────────────────────────

export type StatementKind = "section" | "group" | "account" | "detail" | "info" | "total" | "result";

export interface StatementCell {
  /** Texto tal como lo muestra el Sheet ("4.558", "29%", "-") */
  text: string;
  value: number | null;
  formula: string | null;
  /** Dirección A1 de la celda en el Sheet ("Q15") */
  address: string;
}

export interface StatementRow {
  /** Número de fila en el Sheet (1-based) */
  row: number;
  kind: StatementKind;
  label: string;
  level: number;
  /** Por año: 12 meses + total anual */
  cells: Record<number, StatementCell[]>;
}

export interface Statement {
  years: number[];
  rows: StatementRow[];
}

const SECTION_TITLES = [
  "aporte de socios",
  "ingresos operativos",
  "costos de servicios",
  "egresos operativos",
  "egresos en impuestos",
  "depreciacion y amortizacion",
];
const HOURS_ROW = /^(horas facturadas|horas trabajadas|indice de productividad|personal facturado)/;

function luminance(cell: GridCell | undefined): number {
  const c = cell?.effectiveFormat?.backgroundColor;
  if (!c) return 1;
  return 0.299 * (c.red ?? 0) + 0.587 * (c.green ?? 0) + 0.114 * (c.blue ?? 0);
}

function isBold(cell: GridCell | undefined): boolean {
  return Boolean(cell?.effectiveFormat?.textFormat?.bold);
}

function rowCells(grid: GridCell[][], r: number, blocks: YearBlock[]): Record<number, StatementCell[]> {
  const cells: Record<number, StatementCell[]> = {};
  for (const block of blocks) {
    cells[block.year] = [...block.months, block.totalCol].map((col) => {
      const cell = col >= 0 ? grid[r]?.[col] : undefined;
      return {
        text: String(cell?.formattedValue ?? "").trim(),
        value: num(cell),
        formula: cell?.userEnteredValue?.formulaValue ?? null,
        address: col >= 0 ? `${columnLetter(col)}${r + 1}` : "",
      };
    });
  }
  return cells;
}

/** "=C6+C7", "=SUM(C52:C58)", "=+Q162+Q278": solo suma referencias de celdas. */
export function isSumFormula(formula: string): boolean {
  const f = formula.toUpperCase().replace(/\s+/g, "").replace(/SUM\(/g, "").replace(/\)/g, "");
  return /^=\+?\$?[A-Z]{1,3}\$?\d+([:+]\$?[A-Z]{1,3}\$?\d+)*$/.test(f);
}

function monthFormulas(grid: GridCell[][], r: number, blocks: YearBlock[]): string[] {
  return blocks.flatMap((b) =>
    b.months.map((col) => (col >= 0 ? grid[r]?.[col]?.userEnteredValue?.formulaValue : undefined)).filter((f): f is string => Boolean(f))
  );
}

function hasMonthNumbers(grid: GridCell[][], r: number, blocks: YearBlock[]): boolean {
  return blocks.some((b) => b.months.some((col) => col >= 0 && !isDateSerial(num(grid[r]?.[col])) && num(grid[r]?.[col]) !== null));
}

/**
 * Arma la tabla del Estado de Resultados. Deja fuera las horas (están en los
 * módulos de Facturación y Horas) y todo lo que sigue a "MARGEN NETO %"
 * (cotizaciones, notas, cuadros de inversión).
 */
export function buildStatement(grid: GridCell[][]): Statement {
  const headerRow = findHeaderRow(grid);
  if (headerRow < 0) throw new Error("No se encontró la fila de meses (ene-25, feb-25, …) en el P&L.");
  const blocks = findYearBlocks(grid, headerRow);
  const endRow = findRowIndex(grid, "MARGEN NETO", headerRow + 1);
  const last = endRow >= 0 ? endRow : grid.length - 1;

  const rows: StatementRow[] = [];
  let section = "";
  let groupLevel = 0;
  let inResults = false;

  for (let r = headerRow + 1; r <= last; r++) {
    const row = grid[r];
    const name = label(row);
    const p = plain(name);
    const b = row?.[LABEL_COL];
    const push = (kind: StatementKind, level: number, text = name) =>
      rows.push({ row: r + 1, kind, label: text, level, cells: kind === "section" ? {} : rowCells(grid, r, blocks) });

    const formulas = monthFormulas(grid, r, blocks);
    const sums = formulas.some(isSumFormula);

    if (!name) {
      // Total sin nombre (ej. "=C6+C7" bajo los aportes): solo si suma celdas.
      if (section && sums) {
        push("total", 0, `Total ${section.toLowerCase()}`);
        groupLevel = 0;
      }
      continue;
    }
    if (HOURS_ROW.test(p)) continue;

    if (p === "total aportes") {
      inResults = true;
      rows.push({ row: r + 1, kind: "section", label: "Resultados", level: 0, cells: {} });
    }
    if (inResults) {
      push("result", 0);
      continue;
    }
    // Sección: título conocido, o título en negrita con fondo oscuro y sin importes.
    const darkTitle = isBold(b) && luminance(b) < 0.45 && !p.startsWith("total") && !hasMonthNumbers(grid, r, blocks);
    if (SECTION_TITLES.includes(p) || darkTitle) {
      section = name;
      groupLevel = 0;
      push("section", 0);
      continue;
    }
    if (isBold(b) && p.startsWith("total")) {
      push("total", 0);
      groupLevel = 0;
      continue;
    }
    if (p.startsWith("tc ") || p === "tc") {
      push("info", 1);
      continue;
    }
    // Grupo: negrita con fondo gris y que suma filas (o un subtítulo vacío).
    if (isBold(b) && luminance(b) < 0.85 && (sums || formulas.length === 0)) {
      groupLevel = luminance(b) < 0.75 ? 1 : groupLevel >= 1 ? 2 : 1;
      push("group", groupLevel);
      continue;
    }
    if (!isBold(b) && (p.startsWith("total honorarios cobrados") || p.startsWith("% sobre"))) {
      push("detail", groupLevel + 2);
      continue;
    }
    push("account", groupLevel + 1);
  }

  return { years: blocks.map((b) => b.year), rows };
}

// ─── Edición ──────────────────────────────────────────────────────────────────

/** Tipos de fila que se cargan a mano. Totales, grupos, resultados y el TC los calcula el Sheet. */
export const EDITABLE_KINDS: StatementKind[] = ["account", "detail"];

/**
 * Valida lo que se escribe en una celda. El Sheet está en configuración
 * española: coma decimal y ";" entre argumentos de fórmulas.
 * Devuelve el texto a enviar ("" = vaciar la celda).
 */
export function validateCellInput(raw: string): string {
  const input = raw.trim();
  if (input === "") return "";
  if (input.length > 1000) throw new Error("La fórmula es demasiado larga.");
  if (input.startsWith("=")) {
    if (/\bIMPORT(RANGE|XML|HTML|DATA|FEED)\s*\(/i.test(input)) {
      throw new Error("No se permiten fórmulas que importen datos externos.");
    }
    return input;
  }
  if (/^-?\d+(,\d+)?%?$/.test(input)) return input;
  if (/^-?\d+\.\d+$/.test(input)) throw new Error("Usa coma para los decimales, como en el Sheet (ej. 1234,50).");
  throw new Error("Escribe un número sin separador de miles (ej. 1234,50) o una fórmula que empiece con =.");
}

/** Texto para editar una celda: su fórmula o su número con coma decimal. */
export function editableText(cell: StatementCell): string {
  if (cell.formula) return cell.formula;
  if (cell.value === null) return "";
  return String(cell.value).replace(".", ",");
}

/**
 * Busca la celda a editar en el estado actual del Sheet y comprueba que siga
 * siendo la misma cuenta y que nadie la haya cambiado desde que se leyó.
 */
export function findEditableCell(
  statement: Statement,
  target: { row: number; address: string; label: string; formula: string | null; value: number | null }
): { row: StatementRow; cell: StatementCell; year: number; month: number } {
  const row = statement.rows.find((r) => r.row === target.row && r.kind !== "section");
  if (!row || plain(row.label) !== plain(target.label)) {
    throw new Error("Las filas del Sheet cambiaron (alguien insertó o movió filas). Actualiza e intenta de nuevo.");
  }
  if (!EDITABLE_KINDS.includes(row.kind)) throw new Error("Esta fila la calcula el Sheet y no se edita desde el portal.");
  for (const year of statement.years) {
    const m = row.cells[year].findIndex((c) => c.address === target.address);
    if (m === 12) throw new Error("El total anual lo calcula el Sheet.");
    if (m >= 0) {
      const cell = row.cells[year][m];
      const sameFormula = (cell.formula ?? null) === (target.formula ?? null);
      const sameValue =
        cell.value === target.value ||
        (cell.value !== null && target.value !== null && Math.abs(cell.value - target.value) < 1e-9);
      if (!sameFormula || (!cell.formula && !sameValue)) {
        throw new Error("Esta celda cambió en el Sheet desde que la abriste. Actualiza para ver el valor nuevo.");
      }
      return { row, cell, year, month: m + 1 };
    }
  }
  throw new Error("La celda no corresponde a un mes del P&L.");
}

// ─── Registro de cambios (hoja oculta "Log Portal") ───────────────────────────

export const LOG_SHEET = "Log Portal";
export const LOG_HEADERS = [
  "Fecha (hora del usuario)",
  "Zona horaria",
  "Usuario",
  "Celda",
  "Fila",
  "Mes",
  "Valor anterior",
  "Valor nuevo",
];

const LOG_MONTHS = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEPT", "OCT", "NOV", "DIC"];
const DEFAULT_TIME_ZONE = "America/La_Paz";

/** Zona horaria IANA enviada por el navegador ("America/Montevideo"); si no es válida, La Paz. */
export function safeTimeZone(zone: unknown): string {
  if (typeof zone !== "string" || zone.length > 64 || !/^[A-Za-z_]+(\/[A-Za-z0-9_+-]+)*$/.test(zone)) {
    return DEFAULT_TIME_ZONE;
  }
  try {
    new Intl.DateTimeFormat("es", { timeZone: zone });
    return zone;
  } catch {
    return DEFAULT_TIME_ZONE;
  }
}

/**
 * Una fila del registro. El momento lo pone el servidor; la zona horaria del
 * usuario solo define cómo se muestra. Los valores van como texto: una fórmula
 * se guarda tal cual, sin calcularse.
 */
export function logRow(
  edit: { email: string; address: string; row: number; year: number; month: number; before: string; after: string },
  when: Date,
  timeZone: string = DEFAULT_TIME_ZONE
): string[] {
  const zone = safeTimeZone(timeZone);
  const stamp = when.toLocaleString("es-BO", {
    timeZone: zone,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  return [
    stamp,
    zone,
    edit.email,
    edit.address,
    String(edit.row),
    `${LOG_MONTHS[edit.month - 1]}-${String(edit.year).slice(-2)}`,
    edit.before || "(vacío)",
    edit.after || "(vacío)",
  ];
}
