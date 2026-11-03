import { NextResponse } from "next/server";
import { getHorasData } from "@/lib/sheets-facturacion";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await getHorasData()); // { columns, groups, data }
  } catch (error: any) {
    console.error("Horas API error:", error);
    return NextResponse.json(
      { error: error?.message || "Error al cargar los datos de Horas" },
      { status: 500 }
    );
  }
}
