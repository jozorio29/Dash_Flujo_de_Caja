"use client";

import { SeriesDashboard } from "./series-dashboard";

export function HorasView() {
  return (
    <SeriesDashboard
      title="Horas"
      subtitle="Horas facturadas P&L"
      endpoint="/api/horas"
      loadingText="Cargando horas…"
      unidad="horas"
      groupTitles={(g) => ({ line: `Horas facturadas – ${g.label}`, pie: `Distribución ${g.label}` })}
    />
  );
}
