import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getProjectedDashboard } from "@/lib/sheets-proyectado";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  try {
    const data = await getProjectedDashboard();
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    console.error("[/api/proyectado]", err);
    return NextResponse.json(
      {
        error: message,
        hint:
          "Revisa PROYECTADO_RANGE y comparte la planilla como Lector con GOOGLE_SERVICE_ACCOUNT_EMAIL.",
      },
      { status: 500 }
    );
  }
}
