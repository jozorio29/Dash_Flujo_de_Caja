export interface PLSection { id: string; code: string; name: string; sort_order: number }
export interface PLGroup { id: string; section_id: string; parent_id: string | null; code: string; name: string; sort_order: number }
export interface PLAccount { id: string; group_id: string; code: string; name: string; active: boolean; sort_order: number }
export interface PLValue { id: string; account_id: string; year: number; month: number; currency: string; amount: string; formula?: string | null; formulaError?: string; updated_at: string }
export interface PLData { sections: PLSection[]; groups: PLGroup[]; accounts: PLAccount[]; values: PLValue[]; canEdit: boolean; formulasEnabled?: boolean }

// Decimal strings preserve all six decimal places supported by numeric(20,6).
export function normalizeAmount(input: string): string {
  const value = input.trim().replace(',', '.');
  if (!/^-?\d{1,14}(\.\d{1,6})?$/.test(value)) throw new Error('Usa un número sin separadores de miles y hasta 6 decimales.');
  const [whole, fraction = ''] = value.replace('-', '').split('.');
  const units = BigInt(whole) * BigInt(1000000) + BigInt(fraction.padEnd(6, '0'));
  return fromUnits(value.startsWith('-') ? -units : units);
}
function fromUnits(value: bigint): string {
  const negative = value < BigInt(0);
  const raw = (negative ? -value : value).toString().padStart(7, '0');
  const fraction = raw.slice(-6).replace(/0+$/, '');
  return `${negative ? '-' : ''}${raw.slice(0, -6)}${fraction ? '.' + fraction : ''}`;
}
export function sumAmounts(values: string[]): string | null {
  if (!values.length) return null;
  return fromUnits(values.reduce((sum, value) => {
    const [whole, fraction = ''] = value.replace('-', '').split('.');
    const units = BigInt(whole) * BigInt(1000000) + BigInt(fraction.padEnd(6, '0'));
    return sum + (value.startsWith('-') ? -units : units);
  }, BigInt(0)));
}
export function displayAmount(value: string | null): string {
  if (value === null) return '';
  const [whole, fraction] = value.split('.');
  return whole.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + (fraction ? ',' + fraction : '');
}
