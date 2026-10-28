import 'server-only';
import { plRequest, PLStoreError } from './pl-store';
import type { SummaryRow } from './pl-summary';
export async function readSummaryRows():Promise<{rows:SummaryRow[];enabled:boolean;monthlyEnabled:boolean}> {
  try {
    const rows=await plRequest<SummaryRow[]>('pl_summary_rows','select=*&order=sort_order,id&limit=101');
    let monthlyEnabled=true;
    try { await plRequest('pl_summary_rows','select=cells&limit=0'); }
    catch(e) { if(e instanceof PLStoreError && [400,404].includes(e.status))monthlyEnabled=false;else throw e; }
    return {rows,enabled:true,monthlyEnabled};
  }
  catch(e) { if(e instanceof PLStoreError && e.status===404)return {rows:[],enabled:false,monthlyEnabled:false}; throw e; }
}
