import { NextResponse } from "next/server";
import { getFacturacionData } from "@/lib/sheets-facturacion";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await getFacturacionData()); // { columns, groups, data }
  } catch (error: any) {
    console.error("Facturacion API error:", error);
    return NextResponse.json(
      { error: error?.message || "Error al cargar los datos de Facturación" },
      { status: 500 }
    );
  }
}
