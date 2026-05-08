/**
 * Tipos del dominio del dashboard de flujo de caja.
 *
 * Columnas del Google Sheet usadas (solo las que el usuario considera relevantes):
 *   A=Fecha | C=Mes | D=Oficina | F=Referencia | I=Tipo |
 *   J=Concepto P&L | K=Desc P&L | L=Débitos | M=Créditos | N=Saldo
 * Las columnas B (Hora), E (Descripción), G (Cód. Trans.), H (ITF) y O (Adicionales)
 * NO se usan en el dashboard.
 */

export type MovementType = "INGRESO" | "EGRESO" | "OTRO";

export interface Movement {
  fecha: Date | null;
  fechaRaw: string;
  mes: string;
  oficina: string;
  referencia: string;
  tipo: MovementType;
  conceptoPL: string;
  descPL: string;
  debitos: number;
  creditos: number;
  saldo: number;
  /** Monto neto: créditos - débitos (positivo = ingreso, negativo = egreso) */
  monto: number;
  /** Categoría = Concepto P&L (fallback a Desc P&L o "Otros") */
  categoria: string;
}

export interface KpiSummary {
  ingresosTotales: number;
  egresosTotales: number;
  netFlow: number;
  saldoInicial: number;
  saldoFinal: number;
  promedioMensualIngresos: number;
  promedioMensualEgresos: number;
  promedioMensualNet: number;
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
}

export interface CategorySummary {
  categoria: string;
  totalEgresos: number;
  porcentajeTotal: number;
  promedioMensual: number;
  evolucion: { month: string; value: number }[];
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
