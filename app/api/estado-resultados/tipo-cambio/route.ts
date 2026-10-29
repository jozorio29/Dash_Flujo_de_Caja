import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { canEditPL, plRequest, PLStoreError } from '@/lib/pl-store';
import { readExchangeRates } from '@/lib/pl-exchange-store';
import { normalizeExchangeRate } from '@/lib/pl-exchange';
export const dynamic='force-dynamic';
const error=(error:string,status=400)=>NextResponse.json({error},{status});
const validYear=(y:unknown)=>Number.isInteger(y)&&Number(y)>=2000&&Number(y)<=2100;
export async function GET(request:Request){
  const session=await getServerSession(authOptions);if(!session?.user?.email)return error('No autorizado.',401);
  const year=Number(new URL(request.url).searchParams.get('year'));if(!validYear(year))return error('Año inválido.');
  try{return NextResponse.json({...await readExchangeRates(year),canEdit:canEditPL(session.user.email)});}catch{return error('No se pudieron cargar los tipos de cambio.',503);}
}
export async function POST(request:Request){
  const session=await getServerSession(authOptions);if(!session?.user?.email)return error('No autorizado.',401);
  if(!canEditPL(session.user.email))return error('No tienes permiso para editar.',403);
  if(request.headers.get('origin')!==new URL(request.url).origin)return error('Origen no autorizado.',403);
  if(!request.headers.get('content-type')?.startsWith('application/json'))return error('Se requiere JSON.');
  const raw=await request.text();if(raw.length>6000)return error('Solicitud demasiado grande.',413);
  let body;try{body=JSON.parse(raw);}catch{return error('JSON inválido.');}
  if(!body||!validYear(body.year)||!Array.isArray(body.changes)||!body.changes.length||body.changes.length>12)return error('Período o cambios inválidos.');
  const months=new Set<number>();const changes=[];
  try{for(const cell of body.changes){
    if(!cell||!Number.isInteger(cell.month)||cell.month<1||cell.month>12||months.has(cell.month)||(cell.previous!==null&&(typeof cell.previous!=='string'||!Number.isFinite(Date.parse(cell.previous)))))throw new Error('Mes o versión inválidos.');
    months.add(cell.month);changes.push({month:cell.month,rate:cell.rate===null?null:normalizeExchangeRate(cell.rate),previous:cell.previous});
  }}catch(e){return error((e as Error).message);}
  try{await plRequest('rpc/save_pl_exchange_rates','',{method:'POST',body:JSON.stringify({p_year:body.year,p_changes:changes,p_actor:session.user.email})});return NextResponse.json(await readExchangeRates(body.year));}
  catch(e){if(e instanceof PLStoreError&&e.status===409)return error('Otro usuario modificó las cotizaciones. Cierra y vuelve a abrir el modal para actualizar.',409);if(e instanceof PLStoreError&&e.status===404)return error('Ejecuta 20261029_pl_exchange_rates.sql en Supabase.',409);return error('No se pudieron guardar los tipos de cambio.',503);}
}
