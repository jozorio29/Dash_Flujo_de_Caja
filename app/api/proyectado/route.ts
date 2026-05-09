import { NextResponse } from "next/server";
import { getProjectedDashboard } from "@/lib/sheets-proyectado";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const data = await getProjectedDashboard();
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    console.error("[/api/proyectado]", err);
    return NextResponse.json(
      {
        error: message,
        hint: "Revisa que la pestaña 'Flujo' exista y que PROYECTADO_RANGE en .env.local apunte a ella.",
      },
      { status: 500 }
    );
  }
}
