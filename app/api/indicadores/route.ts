import { NextResponse } from "next/server";
import { getIndicadoresData } from "@/lib/sheets-facturacion";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await getIndicadoresData()); // { columns, data }
  } catch (error: any) {
    console.error("Indicadores API error:", error);
    return NextResponse.json(
      { error: error?.message || "Error al cargar los Indicadores" },
      { status: 500 }
    );
  }
}
