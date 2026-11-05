import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { buildStatement } from "@/lib/pl-base-sheet";
import { canEditPLBase, plBaseConfig, readPLBaseGrid, savePLBaseCell, type CellEdit } from "@/lib/pl-base-store";

export const dynamic = "force-dynamic";

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });
const missingConfig = () =>
  fail("Falta configurar PL_BASE_SPREADSHEET_ID (ID del Google Sheet del P&L) en el servidor.", 503);

/** Estado de Resultados leído del Google Sheet de la contadora. */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return fail("No autorizado.", 401);
  if (!plBaseConfig()) return missingConfig();
  try {
    const statement = buildStatement(await readPLBaseGrid());
    return NextResponse.json({ ...statement, canEdit: canEditPLBase(session.user.email) });
  } catch (error) {
    console.error("Estado de Resultados (Sheets) API error:", error);
    return fail((error as Error)?.message || "No se pudo leer el P&L del Google Sheet.", 500);
  }
}

/** Guarda una celda en el Google Sheet (solo editores autorizados). */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return fail("No autorizado.", 401);
  if (!canEditPLBase(session.user.email)) return fail("No tienes permiso para editar el Estado de Resultados.", 403);
  if (request.headers.get("origin") !== new URL(request.url).origin) return fail("Origen no autorizado.", 403);
  if (!plBaseConfig()) return missingConfig();

  let body: Partial<CellEdit>;
  try {
    body = await request.json();
  } catch {
    return fail("Solicitud inválida.", 400);
  }
  const valid =
    Number.isInteger(body.row) &&
    typeof body.address === "string" &&
    /^[A-Z]{1,3}\d{1,5}$/.test(body.address) &&
    typeof body.label === "string" &&
    typeof body.input === "string" &&
    (body.formula === null || typeof body.formula === "string") &&
    (body.value === null || typeof body.value === "number");
  if (!valid) return fail("Solicitud inválida.", 400);

  try {
    const result = await savePLBaseCell(body as CellEdit, session.user.email);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = (error as Error)?.message || "No se pudo guardar en el Google Sheet.";
    console.error("Estado de Resultados (Sheets) guardar:", error);
    // Errores de validación o de concurrencia: los muestra la pantalla tal cual.
    const status = /Google Sheets API error|autenticar/.test(message) ? 502 : 409;
    return fail(message, status);
  }
}
