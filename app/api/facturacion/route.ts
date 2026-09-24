import { NextResponse } from "next/server";
import { getFacturacionData } from "@/lib/sheets-facturacion";

export async function GET() {
  try {
    const data = await getFacturacionData();
    return NextResponse.json({ data });
  } catch (error: any) {
    console.error("Facturacion API error:", error);
    return NextResponse.json(
      { error: "Error al cargar los datos de Facturación" },
      { status: 500 }
    );
  }
}
