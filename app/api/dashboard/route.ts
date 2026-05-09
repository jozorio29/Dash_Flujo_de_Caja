import { NextResponse } from "next/server";
import { getMovements } from "@/lib/sheets";
import { buildDashboard } from "@/lib/aggregations";

// Sin cache en el server: cada request lee el sheet fresco.
// Esto habilita el comportamiento "tiempo real" del cliente (polling cada 30s,
// refresh on focus, botón manual). Google Sheets API permite 300 reads/min
// gratis — incluso con varios usuarios concurrentes estamos lejos del límite.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const movements = await getMovements();
    const data = buildDashboard(movements);
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    console.error("[/api/dashboard]", err);
    return NextResponse.json(
      { error: message, hint: "Revisa GOOGLE_SHEETS_API_KEY y que el sheet esté compartido públicamente." },
      { status: 500 }
    );
  }
}
