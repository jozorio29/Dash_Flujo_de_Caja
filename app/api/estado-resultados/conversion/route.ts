import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { readPL } from '@/lib/pl-store';
import { readExchangeRates } from '@/lib/pl-exchange-store';
import { convertedPL } from '@/lib/pl-exchange';
export const dynamic='force-dynamic';
export async function GET(request:Request){
  const session=await getServerSession(authOptions);if(!session?.user?.email)return NextResponse.json({error:'No autorizado.'},{status:401});
  const year=Number(new URL(request.url).searchParams.get('year'));if(!Number.isInteger(year)||year<2000||year>2100)return NextResponse.json({error:'Año inválido.'},{status:400});
  try{
    const [data,fx]=await Promise.all([readPL(year,'BOB'),readExchangeRates(year)]);
    return NextResponse.json(convertedPL({...data,canEdit:false},fx.rates));
  }catch{return NextResponse.json({error:'No se pudo convertir el P&L. Revisa la conexión e intenta actualizar.'},{status:503});}
}
