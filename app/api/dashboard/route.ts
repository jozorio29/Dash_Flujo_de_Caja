import { NextResponse } from "next/server";
import { getMovements } from "@/lib/sheets";
import { buildDashboard } from "@/lib/aggregations";

// Cachea 60 segundos en el servidor; el sheet no cambia tan rápido
export const revalidate = 60;

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
