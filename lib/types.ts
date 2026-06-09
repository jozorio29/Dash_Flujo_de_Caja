/**
 * Tipos del dominio del dashboard de flujo de caja.
 *
 * Columnas del Google Sheet usadas (solo las que el usuario considera relevantes):
 *   A=Fecha | B=Hora | C=Mes | D=Oficina | F=Referencia | I=Tipo |
 *   J=Concepto P&L | K=Desc P&L | L=Detalle P&L | M=Débitos | N=Créditos |
 *   O=Saldo Bs | S=Saldo USD
 * Las columnas E (Descripción), G (Cód. Trans.), H (ITF), P, Q y R
 * NO se usan en el dashboard.
 */

export type MovementType = "INGRESO" | "EGRESO" | "OTRO";

export interface Movement {
  fecha: Date | null;
  fechaRaw: string;
  horaRaw: string;
  /** Fecha + hora normalizada para ordenar movimientos del mismo día. */
  fechaHoraMs: number;
  mes: string;
  oficina: string;
  referencia: string;
  tipo: MovementType;
  conceptoPL: string;
  descPL: string;
  detallePL: string;
  debitos: number;
  creditos: number;
  /** Saldo running en Bolivianos (post-movimiento). Columna N del sheet. */
  saldo: number;
  /** Saldo running en USD (post-movimiento). Columna O del sheet. */
  saldoUsd: number;
  /** Monto neto: créditos - débitos (positivo = ingreso, negativo = egreso) en Bs */
  monto: number;
  /** Categoría = Concepto P&L (fallback a Desc P&L o "Otros") */
  categoria: string;
}

export interface KpiSummary {
  // ── Bolivianos (Bs) ──
  ingresosTotales: number;
  egresosTotales: number;
  netFlow: number;
  saldoInicial: number;
  saldoFinal: number;
  promedioMensualIngresos: number;
  promedioMensualEgresos: number;
  promedioMensualNet: number;
  // ── USD (mismos KPIs convertidos a dólares) ──
  ingresosTotalesUsd: number;
  egresosTotalesUsd: number;
  netFlowUsd: number;
  saldoInicialUsd: number;
  saldoFinalUsd: number;
  promedioMensualIngresosUsd: number;
  promedioMensualEgresosUsd: number;
  promedioMensualNetUsd: number;
  // ── Meta ──
  numMeses: number;
  numMovimientos: number;
}

export interface DailyBalance {
  date: string; // ISO yyyy-mm-dd
  saldo: number;
  ingresos: number;
  egresos: number;
}

export interface MonthlyFlow {
  month: string; // yyyy-mm
  label: string; // "ene 2024"
  ingresos: number;
  egresos: number;
  netFlow: number;
  ingresosUsd: number;
  egresosUsd: number;
  netFlowUsd: number;
}

export interface CategorySummary {
  categoria: string;
  totalEgresos: number;
  totalEgresosUsd: number;
  porcentajeTotal: number;
  promedioMensual: number;
  promedioMensualUsd: number;
  evolucion: { month: string; value: number }[];
  evolucionUsd: { month: string; value: number }[];
  variacionVsPromedio: number; // -1 a +inf
}

export interface DashboardData {
  kpis: KpiSummary;
  dailyBalances: DailyBalance[];
  monthlyFlows: MonthlyFlow[];
  categories: CategorySummary[];
  movements: Movement[];
  insights: Insight[];
  meta: {
    fechaInicio: string | null;
    fechaFin: string | null;
    cuentas: string[];
  };
}

export interface Insight {
  type: "warning" | "success" | "info";
  title: string;
  description: string;
  icon: "trending-down" | "trending-up" | "alert" | "pie";
}

// ─── FLUJO DE CAJA PROYECTADO ────────────────────────────────────────────────
//
// Columnas de proyección soportadas:
//   Formato simple: A=Fecha | B=Concepto | C=Centro de Costo | D=Edificio |
//   E=Status | F=Ingresos | G=Egresos | H=Stand by | I=Saldo | J=USD
//
//   Formato recomendado A:S, igual al consolidado:
//   A=Fecha | F=Referencia | K=Concepto P&L | L=Desc P&L |
//   M=Débitos | N=Créditos | Q=Débito USD | R=Crédito USD |
//   S=Saldo USD | T/U=TC

export interface ProjectedMovement {
  fecha: Date | null;
  fechaRaw: string;
  concepto: string;
  conceptoPL: string;
  descPL: string;
  detallePL: string;
  centroCosto: string;
  edificio: string;
  status: string;
  ingresos: number;
  egresos: number;
  standBy: number;
  saldoBs: number;
  debitoUsd: number;
  creditoUsd: number;
  saldoUsd: number;
  tipoCambio: number;
  montoUsd: number;
}

export interface ProjectedSummary {
  totalIngresos: number;
  totalEgresos: number;
  totalStandBy: number;
  netFlow: number; // ingresos - egresos (sin stand by)
  saldoFinalBs: number;
  saldoFinalUsd: number;
  numMovimientos: number;
  fechaInicio: string | null;
  fechaFin: string | null;
}

export interface ProjectedDashboardData {
  movements: ProjectedMovement[];
  summary: ProjectedSummary;
  meta: {
    statuses: string[]; // valores únicos de Status
    centrosCosto: string[];
    edificios: string[];
  };
}

/** Punto del gráfico Real vs Proyectado (saldo en Bs por mes). */
export interface SaldoSeriesPoint {
  month: string; // yyyy-mm
  label: string; // "ene 2026"
  real: number | null; // saldo real al final del mes (null si es futuro)
  proyectado: number | null; // saldo proyectado al final del mes (null si es pasado)
}
