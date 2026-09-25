import 'server-only';
import type { PLAccount, PLGroup, PLSection, PLValue } from './pl-model';
import { recalculateValues } from './pl-references';

export class PLStoreError extends Error {
  constructor(public status: number) { super('No se pudo completar la operación en Supabase.'); }
}
export async function plRequest<T>(table: string, query: string, init: RequestInit = {}): Promise<T> {
  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!base || !key) throw new Error('Falta configurar SUPABASE_URL o SUPABASE_SECRET_KEY en el servidor.');
  const url = new URL(base);
  if (url.protocol !== 'https:' || !url.hostname.endsWith('.supabase.co')) throw new Error('SUPABASE_URL no es una URL de proyecto válida.');
  const response = await fetch(new URL(`/rest/v1/${table}?${query}`, url), {
    ...init, cache: 'no-store', signal: AbortSignal.timeout(15000),
    headers: { apikey: key, 'Content-Type': 'application/json', ...init.headers },
  });
  if (!response.ok) throw new PLStoreError(response.status);
  const body = await response.text();
  return (body ? JSON.parse(body) : []) as T;
}
async function allRows<T>(table: string, query: string): Promise<T[]> {
  const result: T[] = [];
  for (let offset = 0; ; offset += 500) {
    const page = await plRequest<T[]>(table, `${query}&limit=500&offset=${offset}`);
    result.push(...page);
    if (page.length < 500) return result;
  }
}
export async function readPL(year: number, currency: string) {
  const formulasEnabled = await supportsPLFormulas();
  const [sections, groups, accounts, values] = await Promise.all([
    allRows<PLSection>('pl_sections', 'select=*&order=sort_order,id'),
    allRows<PLGroup>('pl_groups', 'select=*&order=sort_order,id'),
    allRows<PLAccount>('pl_accounts', 'select=*&order=sort_order,id'),
    allRows<PLValue>('pl_monthly_values', `select=id,account_id,year,month,currency,amount::text,updated_at${formulasEnabled ? ',formula' : ''}&year=eq.${year}&currency=eq.${currency}&order=id`),
  ]);
  return { sections, groups, accounts, values: recalculateValues({sections, groups, accounts, values}), formulasEnabled };
}
export async function supportsPLFormulas(): Promise<boolean> {
  try { await plRequest('pl_monthly_values', 'select=formula&limit=0'); return true; }
  catch (e) { if (e instanceof PLStoreError && e.status === 400) return false; throw e; }
}
export function canEditPL(email: string) {
  return (process.env.PL_EDITOR_EMAILS || '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean).includes(email.toLowerCase());
}
