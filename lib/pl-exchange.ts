import { evaluateFormula } from './pl-formula';
import { normalizeAmount, sumAmounts, type PLData, type PLValue } from './pl-model';
export interface PLExchangeRate {year:number;month:number;rate:string;updated_at:string}
export function normalizeExchangeRate(input:unknown):string {
  if(typeof input!=='string')throw new Error('Tipo de cambio inválido.');
  const rate=normalizeAmount(input);
  if(Number(rate)<=0)throw new Error('El tipo de cambio debe ser mayor que cero.');
  return rate;
}
export function convertBOBToUSD(amount:string,rate:string):string {
  return evaluateFormula(`=(${normalizeAmount(amount)})/${normalizeExchangeRate(rate)}`);
}
export function convertedPL(data:PLData,rates:PLExchangeRate[]):PLData {
  const byMonth=Object.fromEntries(rates.map(r=>[r.month,r.rate]));
  const values:PLValue[]=data.values.flatMap(value=>{
    const rate=byMonth[value.month];if(!rate)return [];
    try{return [{...value,currency:'USD',amount:convertBOBToUSD(value.amount,rate)}];}
    catch(e){return [{...value,currency:'USD',formulaError:e instanceof Error?e.message:'No se pudo convertir.'}];}
  });
  return {...data,canEdit:false,values,conversion:{rates:byMonth,sourceValues:data.values}};
}

// Calculate summaries in source currency first: literal numbers and constants are BOB too.
export function convertSummaryResults(results:Map<string,import('./pl-summary').SummaryResult[]>,rows:import('./pl-summary').SummaryRow[],year:number,rates:Record<number,string>) {
  return new Map(rows.map(row=>{
    const source=results.get(row.id)??[];
    let hasPercent=false;
    const months=Array.from({length:12},(_,i)=>{
      const result=source[i]??{amount:null};
      const percent=(row.cells?.[`${year}:BOB:${i+1}`]?.format??row.format)==='percent';
      hasPercent ||= percent;
      if(result.error || result.amount===null || percent)return result;
      if(!rates[i+1])return {amount:null};
      try{return {amount:convertBOBToUSD(result.amount,rates[i+1])};}catch(e){return {amount:null,error:(e as Error).message};}
    });
    const error=months.find(r=>r.error)?.error;
    const annual=error?{amount:null,error}:{amount:hasPercent?null:sumAmounts(months.flatMap(r=>r.amount===null?[]:[r.amount]))};
    return [row.id,[...months,annual]];
  }));
}
