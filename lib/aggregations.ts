import {
  CategorySummary,
  DailyBalance,
  DashboardData,
  Insight,
  KpiSummary,
  MonthlyFlow,
  Movement,
} from "./types";
import { dateKey, monthKey, monthLabel, formatCurrency } from "./utils";

export function buildDashboard(movements: Movement[]): DashboardData {
  const valid = movements.filter((m) => m.fecha !== null);

  const kpis = buildKpis(valid);
  const dailyBalances = buildDailyBalances(valid);
  const monthlyFlows = buildMonthlyFlows(valid);
  const categories = buildCategories(valid, monthlyFlows);
  const insights = buildInsights(kpis, monthlyFlows, categories);

  const cuentas = Array.from(new Set(valid.map((m) => m.oficina).filter(Boolean)));

  return {
    kpis,
    dailyBalances,
    monthlyFlows,
    categories,
    movements: valid,
    insights,
    meta: {
      fechaInicio: dailyBalances[0]?.date ?? null,
      fechaFin: dailyBalances[dailyBalances.length - 1]?.date ?? null,
      cuentas,
    },
  };
}

/**
 * Tipo de cambio del row: USD por Bs en el momento de ese movimiento.
 * Lo calculamos como saldoUsd / saldoBs. Si saldoBs es 0 (movimiento inicial,
 * división por cero), retornamos 0 — el caller debe manejarlo.
 */
function rateAt(m: Movement): number {
  if (!m.saldo || !m.saldoUsd) return 0;
  return m.saldoUsd / m.saldo;
}

function buildKpis(movements: Movement[]): KpiSummary {
  let ingresos = 0;
  let egresos = 0;
  let ingresosUsd = 0;
  let egresosUsd = 0;

  for (const m of movements) {
    ingresos += m.creditos;
    egresos += m.debitos;
    // Para USD usamos el tipo de cambio AL MOMENTO de cada movimiento
    // (porque el rate cambia mes a mes). Esto da una conversión más fiel
    // que aplicar un rate "promedio" a las sumas en Bs.
    const r = rateAt(m);
    if (r > 0) {
      ingresosUsd += m.creditos * r;
      egresosUsd += m.debitos * r;
    }
  }
  const netFlow = ingresos - egresos;
  const netFlowUsd = ingresosUsd - egresosUsd;

  // Saldo inicial = saldo de la primera fila MENOS su movimiento neto
  // (porque el "Saldo" suele ser POST-movimiento)
  const first = movements[0];
  const last = movements[movements.length - 1];
  const saldoInicial = first ? first.saldo - first.monto : 0;
  const saldoFinal = last ? last.saldo : saldoInicial + netFlow;

  // Saldos USD: usamos los valores running de la columna S directamente.
  // saldoInicialUsd = saldo USD del primer mov - su movimiento en USD.
  // El "movimiento USD" del primer row se estima con su propio rate.
  const firstRate = first ? rateAt(first) : 0;
  const saldoInicialUsd = first
    ? first.saldoUsd - first.monto * firstRate
    : 0;
  const saldoFinalUsd = last ? last.saldoUsd : saldoInicialUsd + netFlowUsd;

  // Meses únicos
  const months = new Set<string>();
  for (const m of movements) {
    if (m.fecha) months.add(monthKey(m.fecha));
  }
  const numMeses = Math.max(months.size, 1);

  return {
    ingresosTotales: ingresos,
    egresosTotales: egresos,
    netFlow,
    saldoInicial,
    saldoFinal,
    promedioMensualIngresos: ingresos / numMeses,
    promedioMensualEgresos: egresos / numMeses,
    promedioMensualNet: netFlow / numMeses,
    ingresosTotalesUsd: ingresosUsd,
    egresosTotalesUsd: egresosUsd,
    netFlowUsd,
    saldoInicialUsd,
    saldoFinalUsd,
    promedioMensualIngresosUsd: ingresosUsd / numMeses,
    promedioMensualEgresosUsd: egresosUsd / numMeses,
    promedioMensualNetUsd: netFlowUsd / numMeses,
    numMeses,
    numMovimientos: movements.length,
  };
}

function buildDailyBalances(movements: Movement[]): DailyBalance[] {
  const byDate = new Map<string, { saldo: number; ingresos: number; egresos: number }>();
  for (const m of movements) {
    if (!m.fecha) continue;
    const key = dateKey(m.fecha);
    const cur = byDate.get(key) ?? { saldo: 0, ingresos: 0, egresos: 0 };
    cur.saldo = m.saldo; // último saldo del día
    cur.ingresos += m.creditos;
    cur.egresos += m.debitos;
    byDate.set(key, cur);
  }
  return Array.from(byDate.entries())
    .map(([date, v]) => ({ date, ...v }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function buildMonthlyFlows(movements: Movement[]): MonthlyFlow[] {
  const byMonth = new Map<string, { ingresos: number; egresos: number }>();
  for (const m of movements) {
    if (!m.fecha) continue;
    const key = monthKey(m.fecha);
    const cur = byMonth.get(key) ?? { ingresos: 0, egresos: 0 };
    cur.ingresos += m.creditos;
    cur.egresos += m.debitos;
    byMonth.set(key, cur);
  }
  return Array.from(byMonth.entries())
    .map(([month, v]) => ({
      month,
      label: monthLabel(month),
      ingresos: v.ingresos,
      egresos: v.egresos,
      netFlow: v.ingresos - v.egresos,
    }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

function buildCategories(
  movements: Movement[],
  monthly: MonthlyFlow[]
): CategorySummary[] {
  // Solo egresos
  const egresos = movements.filter((m) => m.debitos > 0);
  const totalEgresos = egresos.reduce((a, b) => a + b.debitos, 0);
  const months = monthly.map((m) => m.month);

  // Agrupar por categoría
  const byCat = new Map<string, { total: number; perMonth: Map<string, number> }>();
  for (const m of egresos) {
    if (!m.fecha) continue;
    const cat = m.categoria || "Otros";
    const cur = byCat.get(cat) ?? { total: 0, perMonth: new Map() };
    cur.total += m.debitos;
    const mk = monthKey(m.fecha);
    cur.perMonth.set(mk, (cur.perMonth.get(mk) ?? 0) + m.debitos);
    byCat.set(cat, cur);
  }

  const numMeses = Math.max(months.length, 1);
  const summaries: CategorySummary[] = Array.from(byCat.entries()).map(
    ([categoria, v]) => {
      const evolucion = months.map((mk) => ({
        month: mk,
        value: v.perMonth.get(mk) ?? 0,
      }));
      const promedioMensual = v.total / numMeses;
      // Variación: cómo se comparó el último mes vs el promedio
      const ultimo = evolucion[evolucion.length - 1]?.value ?? 0;
      const variacionVsPromedio =
        promedioMensual === 0 ? 0 : (ultimo - promedioMensual) / promedioMensual;
      return {
        categoria,
        totalEgresos: v.total,
        porcentajeTotal: totalEgresos === 0 ? 0 : v.total / totalEgresos,
        promedioMensual,
        evolucion,
        variacionVsPromedio,
      };
    }
  );

  // Ordenar por total descendente; agrupar las pequeñas en "Otros" si hay muchas
  summaries.sort((a, b) => b.totalEgresos - a.totalEgresos);

  const TOP = 6;
  if (summaries.length <= TOP + 1) return summaries;

  const top = summaries.slice(0, TOP);
  const rest = summaries.slice(TOP);
  const otros: CategorySummary = {
    categoria: "Otros gastos",
    totalEgresos: rest.reduce((a, b) => a + b.totalEgresos, 0),
    porcentajeTotal: rest.reduce((a, b) => a + b.porcentajeTotal, 0),
    promedioMensual: rest.reduce((a, b) => a + b.promedioMensual, 0),
    evolucion: months.map((mk, i) => ({
      month: mk,
      value: rest.reduce((a, b) => a + (b.evolucion[i]?.value ?? 0), 0),
    })),
    variacionVsPromedio:
      rest.reduce((a, b) => a + b.variacionVsPromedio, 0) / Math.max(rest.length, 1),
  };
  return [...top, otros];
}

function buildInsights(
  kpis: KpiSummary,
  monthly: MonthlyFlow[],
  categories: CategorySummary[]
): Insight[] {
  const insights: Insight[] = [];

  // 1. Net flow del periodo
  if (kpis.netFlow < 0) {
    insights.push({
      type: "warning",
      title: "Más egresos que ingresos",
      description: `En el período analizado, los egresos superan los ingresos en ${formatCurrency(
        Math.abs(kpis.netFlow)
      )}.`,
      icon: "trending-down",
    });
  } else if (kpis.netFlow > 0) {
    insights.push({
      type: "success",
      title: "Superávit en el período",
      description: `Se generó un superávit de ${formatCurrency(
        kpis.netFlow
      )} en el período analizado.`,
      icon: "trending-up",
    });
  }

  // 2. Mejor mes
  if (monthly.length > 0) {
    const best = [...monthly].sort((a, b) => b.netFlow - a.netFlow)[0];
    insights.push({
      type: "success",
      title: `Mejor mes: ${best.label}`,
      description: `${best.label} presenta el mejor flujo neto del período: ${formatCurrency(
        best.netFlow
      )}.`,
      icon: "trending-up",
    });
  }

  // 3. Categoría líder en egresos
  if (categories.length > 0) {
    const top = categories[0];
    insights.push({
      type: "info",
      title: `${top.categoria} lidera egresos`,
      description: `Representa el ${(top.porcentajeTotal * 100).toFixed(
        1
      )}% del total de egresos en el período.`,
      icon: "pie",
    });
  }

  return insights;
}
