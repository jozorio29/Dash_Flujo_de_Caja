import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { canEditPL, plRequest, PLStoreError, readPL } from '@/lib/pl-store';
import { readSummaryRows } from '@/lib/pl-summary-store';
import { validateSummary, type SummaryRow } from '@/lib/pl-summary';
export const dynamic='force-dynamic';
const error=(message:string,status=400)=>NextResponse.json({error:message},{status});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function GET() {
  const session=await getServerSession(authOptions);
  if(!session?.user?.email)return error('No autorizado.',401);
  try { return NextResponse.json(await readSummaryRows()); }
  catch { return error('No se pudo cargar el resumen. Intenta actualizar.',503); }
}
export async function POST(request:Request) {
  const session=await getServerSession(authOptions);
  if(!session?.user?.email)return error('No autorizado.',401);
  if(!canEditPL(session.user.email))return error('No tienes permiso para editar el P&L.',403);
  if(request.headers.get('origin')!==new URL(request.url).origin)return error('Origen no autorizado.',403);
  if(!request.headers.get('content-type')?.startsWith('application/json'))return error('Se requiere JSON.');
  const raw=await request.text();if(raw.length>1500000)return error('Solicitud demasiado grande.',413);
  let body;
  try { body=JSON.parse(raw); } catch { return error('JSON inválido.'); }
  if(!body || !['save','delete'].includes(body.action) || !body.row || typeof body.row.id!=='string' || !uuid.test(body.row.id) || (body.previous!==null && (typeof body.previous!=='string' || !Number.isFinite(Date.parse(body.previous)))))return error('Fila o versión inválida.');
  try {
    const existing=await readSummaryRows();
    if(!existing.enabled)return error('Falta habilitar las filas de resumen en Supabase.',409);
    const found=existing.rows.find(r=>r.id===body.row.id);
    if((found?.updated_at ?? null)!==body.previous)return error('La fila cambió. Actualiza antes de guardar.',409);
    let row:Partial<SummaryRow>={id:body.row.id};
    if(body.action==='save') {
      if(!Number.isInteger(body.year) || body.year<2000 || body.year>2100 || !['USD','BOB'].includes(body.currency))return error('Período inválido.');
      row={id:body.row.id,name:typeof body.row.name==='string'?body.row.name.trim():body.row.name,format:body.row.format,tokens:body.row.tokens,sort_order:body.row.sort_order,cells:body.row.cells ?? found?.cells ?? null,monthly_only:found?.monthly_only ?? (found ? false : true)};
      if(row.cells != null && !existing.monthlyEnabled)return error('Ejecuta 20261028_pl_summary_cells.sql para habilitar las celdas mensuales.',409);
      const data=await readPL(body.year,body.currency);
      try { validateSummary([...existing.rows.filter(r=>r.id!==row.id),row as SummaryRow],data); }
      catch(e) { return error(e instanceof Error?e.message:'Fórmula inválida.'); }
    } else {
      if(!found)return error('La fila no existe.',404);
      if(existing.rows.some(r=>r.id!==row.id && r.tokens.some(t=>t.kind==='reference' && t.type==='summary' && t.id===row.id)))return error('Otra fila utiliza este resultado. Modifica esa fórmula antes de eliminarlo.',409);
    }
    const rows=await plRequest<SummaryRow[]>(row.cells != null ? 'rpc/mutate_pl_summary_cells' : 'rpc/mutate_pl_summary','',{method:'POST',body:JSON.stringify({p_action:body.action,p_row:row,p_previous:body.previous,p_actor:session.user.email})});
    return NextResponse.json({rows,enabled:true});
  } catch(e) {
    if(e instanceof PLStoreError && [400,409].includes(e.status))return error('No se guardó: otra fila cambió o la fórmula crea una dependencia inválida. Actualiza y revisa sus referencias.',409);
    return error('No se pudo guardar el resumen. Revisa la conexión y su configuración en Supabase.',503);
  }
}
