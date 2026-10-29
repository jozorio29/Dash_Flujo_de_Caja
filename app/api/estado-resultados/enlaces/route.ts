import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { canEditPL, plRequest, PLStoreError } from '@/lib/pl-store';
import { normalizeInvoiceURL, type PLCellLink } from '@/lib/pl-cell-links';
export const dynamic='force-dynamic';
const fail=(error:string,status=400)=>NextResponse.json({error},{status});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const period=(year:unknown,currency:unknown,kind:unknown)=>Number.isInteger(year)&&Number(year)>=2000&&Number(year)<=2100&&['USD','BOB'].includes(String(currency))&&['account','summary'].includes(String(kind));
export async function GET(request:Request) {
  const session=await getServerSession(authOptions);if(!session?.user?.email)return fail('No autorizado.',401);
  const params=new URL(request.url).searchParams;const year=Number(params.get('year')),currency=params.get('currency'),kind=params.get('kind');
  if(!period(year,currency,kind))return fail('Período inválido.');
  try {
    const links:PLCellLink[]=[];
    for(let offset=0;;offset+=500){
      const page=await plRequest<PLCellLink[]>('pl_cell_links',`select=id,account_id,summary_id,year,month,currency,url,updated_at&year=eq.${year}&currency=eq.${currency}&${kind==='account'?'account_id':'summary_id'}=not.is.null&order=id&limit=500&offset=${offset}`);
      links.push(...page);if(page.length<500)break;
    }
    return NextResponse.json({links,enabled:true});
  }catch(e){if(e instanceof PLStoreError&&e.status===404)return NextResponse.json({links:[],enabled:false});return fail('No se pudieron cargar los enlaces. Intenta actualizar.',503);}
}
export async function POST(request:Request) {
  const session=await getServerSession(authOptions);if(!session?.user?.email)return fail('No autorizado.',401);
  if(!canEditPL(session.user.email))return fail('No tienes permiso para editar enlaces.',403);
  if(request.headers.get('origin')!==new URL(request.url).origin)return fail('Origen no autorizado.',403);
  if(!request.headers.get('content-type')?.startsWith('application/json'))return fail('Se requiere JSON.');
  const raw=await request.text();if(raw.length>5000)return fail('Solicitud demasiado grande.',413);
  let body;try{body=JSON.parse(raw);}catch{return fail('JSON inválido.');}
  if(!body || !period(body.year,body.currency,body.kind) || !Number.isInteger(body.month) || body.month<1 || body.month>12 || typeof body.sourceId!=='string' || !uuid.test(body.sourceId) || (body.previous!==null && (typeof body.previous!=='string'||!Number.isFinite(Date.parse(body.previous)))))return fail('Celda o versión inválida.');
  let url:string|null;try{url=body.url===null?null:normalizeInvoiceURL(body.url);}catch(e){return fail((e as Error).message);}
  try {
    const links=await plRequest<PLCellLink[]>('rpc/mutate_pl_cell_link','',{method:'POST',body:JSON.stringify({p_kind:body.kind,p_source:body.sourceId,p_year:body.year,p_month:body.month,p_currency:body.currency,p_url:url,p_previous:body.previous,p_actor:session.user.email})});
    return NextResponse.json({link:links[0]??null});
  }catch(e){
    if(e instanceof PLStoreError&&e.status===409)return fail('El enlace cambió. Actualiza los enlaces antes de guardar.',409);
    if(e instanceof PLStoreError&&e.status===404)return fail('Ejecuta 20261029_pl_cell_links.sql en Supabase para habilitar los enlaces.',409);
    return fail('No se pudo guardar el enlace. Revisa la conexión y la configuración de Supabase.',503);
  }
}
