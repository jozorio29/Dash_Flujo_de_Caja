import 'server-only';
import { plRequest, PLStoreError } from './pl-store';
import type { PLExchangeRate } from './pl-exchange';
export async function readExchangeRates(year:number) {
  try {return {enabled:true,rates:await plRequest<PLExchangeRate[]>('pl_exchange_rates',`select=year,month,rate::text,updated_at&year=eq.${year}&order=month`)};}
  catch(e){if(e instanceof PLStoreError&&e.status===404)return {enabled:false,rates:[] as PLExchangeRate[]};throw e;}
}
