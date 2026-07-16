import {
  ProjectedDashboardData,
  ProjectedMovement,
  ProjectedSummary,
} from "./types";
import { parseAmount, parseDate } from "./utils";
import { fetchSheetValues } from "./google-sheets-client";

/**
 * Lee la pestaña de pagos proyectados (mismo spreadsheet, otra pestaña).
 * El nombre/rango se controla con PROYECTADO_RANGE en .env.local.
 */
export async function fetchProyectadoRows(): Promise<string[][]> {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  const range = process.env.PROYECTADO_RANGE || "Proyecciones!A:S";

  if (!spreadsheetId)
    throw new Error("GOOGLE_SHEETS_SPREADSHEET_ID no configurada en .env.local");

  return fetchSheetValues(spreadsheetId, range);
}

/**
 * Detecta la fila de headers buscando "Fecha" en la primera columna.
 * Permite hasta 5 filas de "ruido" arriba (títulos, "Pagos proyectados", etc.).
 */
function findHeaderRowIndex(rows: string[][]): number {
  for (let i = 0; i < Math.min(rows.length, 8); i++) {
    const first = String(rows[i]?.[0] || "").trim().toLowerCase();
    if (first === "fecha") return i;
  }
  return 0;
}

/**
 * Posiciones (0-indexed) del formato simple A:J del flujo proyectado.
 *   A=0 Fecha
 *   B=1 Concepto
 *   C=2 Centro de Costo
 *   D=3 Edificio
 *   E=4 Status
 *   F=5 Ingresos
 *   G=6 Egresos
 *   H=7 Stand by
 *   I=8 Saldo en P. Bol
 *   J=9 Monto en USD
 */
const COL = {
  fecha: 0,
  concepto: 1,
  centroCosto: 2,
  edificio: 3,
  status: 4,
  ingresos: 5,
  egresos: 6,
  standBy: 7,
  saldoBs: 8,
  montoUsd: 9,
} as const;

/**
 * Posiciones (0-indexed) del formato recomendado A:S, igual al consolidado real.
 *   A=0 Fecha
 *   F=5 Referencia
 *   K=10 Concepto P&L
 *   L=11 Desc P&L
 *   M=12 Débitos / Egresos
 *   N=13 Créditos / Ingresos
 *   O=14 Saldo
 *   Q=16 Débito USD
 *   R=17 Crédito USD
 *   S=18 Saldo USD
 *   T=19 TC por fila (opcional)
 *   U=20 TC global si T1 contiene "TC" (opcional)
 */
const REAL_FORMAT_COL = {
  fecha: 0,
  referencia: 5,
  conceptoPL: 10,
  descPL: 11,
  debitos: 12,
  creditos: 13,
  saldo: 14,
  debitoUsd: 16,
  creditoUsd: 17,
  saldoUsd: 18,
  tipoCambio: 19,
  tipoCambioValue: 20,
} as const;

function looksLikeRealFormat(row: string[]): boolean {
  return (
    row.length > REAL_FORMAT_COL.creditos &&
    (
      String(row[REAL_FORMAT_COL.conceptoPL] ?? "").trim() !== "" ||
      parseAmount(row[REAL_FORMAT_COL.debitos]) !== 0 ||
      parseAmount(row[REAL_FORMAT_COL.creditos]) !== 0
    )
  );
}

export function parseProjectedMovements(rows: string[][]): ProjectedMovement[] {
  if (!rows.length) return [];
  const headerIdx = findHeaderRowIndex(rows);
  const headerRow = rows[headerIdx] ?? [];
  const globalTipoCambio =
    /^tc$/i.test(String(headerRow[REAL_FORMAT_COL.tipoCambio] ?? "").trim())
      ? parseAmount(headerRow[REAL_FORMAT_COL.tipoCambioValue])
      : parseAmount(headerRow[REAL_FORMAT_COL.tipoCambio]);
  const dataRows = rows.slice(headerIdx + 1);

  const out: ProjectedMovement[] = [];
  for (const row of dataRows) {
    if (!row || row.length === 0) continue;

    if (looksLikeRealFormat(row)) {
      const fechaRaw = String(row[REAL_FORMAT_COL.fecha] ?? "").trim();
      const parsedFecha = parseDate(row[REAL_FORMAT_COL.fecha] as any);
      const conceptoPL = String(row[REAL_FORMAT_COL.conceptoPL] ?? "").trim();
      const descPL = String(row[REAL_FORMAT_COL.descPL] ?? "").trim();
      const debitos = parseAmount(row[REAL_FORMAT_COL.debitos]);
      const creditos = parseAmount(row[REAL_FORMAT_COL.creditos]);
      const saldo = parseAmount(row[REAL_FORMAT_COL.saldo]);
      const tipoCambio =
        parseAmount(row[REAL_FORMAT_COL.tipoCambio]) ||
        parseAmount(row[REAL_FORMAT_COL.tipoCambioValue]) ||
        globalTipoCambio;
      const debitoUsd =
        parseAmount(row[REAL_FORMAT_COL.debitoUsd]) ||
        (tipoCambio > 0 ? debitos / tipoCambio : 0);
      const creditoUsd =
        parseAmount(row[REAL_FORMAT_COL.creditoUsd]) ||
        (tipoCambio > 0 ? creditos / tipoCambio : 0);
      const saldoUsd = parseAmount(row[REAL_FORMAT_COL.saldoUsd]);

      if (!parsedFecha && debitos === 0 && creditos === 0) continue;
      if (/^(total|subtotal|saldo)/i.test(fechaRaw)) continue;
      if (!parsedFecha) continue;

      const concepto = conceptoPL || descPL || String(row[REAL_FORMAT_COL.referencia] ?? "").trim();
      const detalle = descPL || concepto;

      out.push({
        fecha: parsedFecha,
        fechaRaw,
        concepto,
        conceptoPL: concepto,
        descPL: detalle,
        detallePL: detalle,
        centroCosto: "",
        edificio: "",
        status: "",
        ingresos: creditos,
        egresos: debitos,
        standBy: 0,
        saldoBs: saldo,
        debitoUsd,
        creditoUsd,
        saldoUsd,
        tipoCambio,
        montoUsd: saldoUsd || creditoUsd - debitoUsd,
      });
      continue;
    }

    const concepto = String(row[COL.concepto] ?? "").trim();
    const ingresos = parseAmount(row[COL.ingresos]);
    const egresos = parseAmount(row[COL.egresos]);
    const standBy = parseAmount(row[COL.standBy]);
    const saldoBs = parseAmount(row[COL.saldoBs]);
    const montoUsd = parseAmount(row[COL.montoUsd]);
    const fechaRaw = String(row[COL.fecha] ?? "").trim();
    const parsedFecha = parseDate(row[COL.fecha] as any);

    // Saltar filas separadoras tipo "Pagos proyectados" (sin fecha y sin montos)
    if (
      (!parsedFecha || !concepto) &&
      ingresos === 0 &&
      egresos === 0 &&
      standBy === 0 &&
      saldoBs === 0 &&
      montoUsd === 0
    ) {
      continue;
    }

    // Saltar etiquetas TOTAL/SUBTOTAL en la fila
    if (/^(total|subtotal|saldo)/i.test(fechaRaw)) continue;
    if (/^(total|subtotal)/i.test(concepto)) continue;

    // Si no hay fecha pero tiene montos (raro), igual saltamos para no contaminar
    if (!parsedFecha) continue;

    out.push({
      fecha: parsedFecha,
      fechaRaw,
      concepto,
      conceptoPL: concepto,
      descPL: concepto,
      detallePL: concepto,
      centroCosto: String(row[COL.centroCosto] ?? "").trim(),
      edificio: String(row[COL.edificio] ?? "").trim(),
      status: String(row[COL.status] ?? "").trim(),
      ingresos,
      egresos,
      standBy,
      saldoBs,
      debitoUsd: montoUsd < 0 ? Math.abs(montoUsd) : 0,
      creditoUsd: montoUsd > 0 ? montoUsd : 0,
      saldoUsd: 0,
      tipoCambio: 0,
      montoUsd,
    });
  }

  out.sort((a, b) => {
    const ta = a.fecha?.getTime() ?? 0;
    const tb = b.fecha?.getTime() ?? 0;
    return ta - tb;
  });

  return out;
}

export function buildProjectedSummary(
  movements: ProjectedMovement[]
): ProjectedSummary {
  let totalIngresos = 0;
  let totalEgresos = 0;
  let totalStandBy = 0;
  for (const m of movements) {
    totalIngresos += m.ingresos;
    totalEgresos += m.egresos;
    totalStandBy += m.standBy;
  }
  const last = movements[movements.length - 1];
  const first = movements[0];

  const isoDay = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  return {
    totalIngresos,
    totalEgresos,
    totalStandBy,
    netFlow: totalIngresos - totalEgresos,
    saldoFinalBs: last?.saldoBs ?? 0,
    saldoFinalUsd: last?.montoUsd ?? 0,
    numMovimientos: movements.length,
    fechaInicio: first?.fecha ? isoDay(first.fecha) : null,
    fechaFin: last?.fecha ? isoDay(last.fecha) : null,
  };
}

export function buildProjectedDashboard(
  movements: ProjectedMovement[]
): ProjectedDashboardData {
  const summary = buildProjectedSummary(movements);
  const statuses = Array.from(
    new Set(movements.map((m) => m.status).filter(Boolean))
  ).sort();
  const centrosCosto = Array.from(
    new Set(movements.map((m) => m.centroCosto).filter(Boolean))
  ).sort();
  const edificios = Array.from(
    new Set(movements.map((m) => m.edificio).filter(Boolean))
  ).sort();
  return {
    movements,
    summary,
    meta: { statuses, centrosCosto, edificios },
  };
}

export async function getProjectedDashboard(): Promise<ProjectedDashboardData> {
  const rows = await fetchProyectadoRows();
  const movements = parseProjectedMovements(rows);
  return buildProjectedDashboard(movements);
}
