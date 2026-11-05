import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { buildStatement } from "@/lib/pl-base-sheet";
import { plBaseConfig, readPLBaseGrid } from "@/lib/pl-base-store";

export const dynamic = "force-dynamic";

/** Estado de Resultados leído del Google Sheet de la contadora (solo lectura). */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  if (!plBaseConfig()) {
    return NextResponse.json(
      { error: "Falta configurar PL_BASE_SPREADSHEET_ID (ID del Google Sheet del P&L) en el servidor." },
      { status: 503 }
    );
  }
  try {
    return NextResponse.json(buildStatement(await readPLBaseGrid()));
  } catch (error) {
    console.error("Estado de Resultados (Sheets) API error:", error);
    return NextResponse.json(
      { error: (error as Error)?.message || "No se pudo leer el P&L del Google Sheet." },
      { status: 500 }
    );
  }
}
