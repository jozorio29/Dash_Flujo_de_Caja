"use client";

import { SeriesDashboard } from "./series-dashboard";

const TITULOS: Record<string, { line: string; pie: string }> = {
  servicio: { line: "Facturación de Servicios", pie: "Distribución Servicios" },
  alquiler: { line: "Evolución de Alquileres", pie: "Distribución Alquileres" },
};

export function FacturacionView() {
  return (
    <SeriesDashboard
      title="Facturación"
      subtitle="Módulo de ingresos P&L"
      endpoint="/api/facturacion"
      loadingText="Cargando facturación…"
      unidad="moneda"
      groupTitles={(g) => TITULOS[g.id] ?? { line: `Evolución ${g.label}`, pie: `Distribución ${g.label}` }}
    />
  );
}
