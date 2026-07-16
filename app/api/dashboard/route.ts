import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getMovements } from "@/lib/sheets";
import { buildDashboard } from "@/lib/aggregations";

// Sin cache en el server: cada request lee el sheet fresco.
// Esto habilita el comportamiento "tiempo real" del cliente (polling cada 30s,
// refresh on focus, botón manual). Google Sheets API permite 300 reads/min
// gratis — incluso con varios usuarios concurrentes estamos lejos del límite.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  try {
    const movements = await getMovements();
    const data = buildDashboard(movements);
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    console.error("[/api/dashboard]", err);
    return NextResponse.json(
      {
        error: message,
        hint:
          "Para una hoja restringida, comparte la planilla como Lector con GOOGLE_SERVICE_ACCOUNT_EMAIL.",
      },
      { status: 500 }
    );
  }
}
