import { normalizeAmount } from './pl-model';

type Fraction = { n: bigint; d: bigint };
const ONE = BigInt(1);
const ZERO = BigInt(0);
function fraction(n: bigint, d = ONE): Fraction {
  if (d === ZERO) throw new Error('No se puede dividir entre cero.');
  if (d < ZERO) { n = -n; d = -d; }
  let a = n < ZERO ? -n : n, b = d;
  while (b !== ZERO) { const rest = a % b; a = b; b = rest; }
  return { n: n / a, d: d / a };
}

/** Arithmetic with an optional reference resolver; never executes JavaScript. */
export function evaluateFormula(input: string, resolve?: (reference: string) => string): string {
  const source = input.trim();
  if (!source.startsWith('=')) throw new Error('La fórmula debe comenzar con =.');
  if (source.length > 500) throw new Error('La fórmula admite hasta 500 caracteres.');
  let index = 1;
  function peek() { while (/\s/.test(source[index] || '') && index < source.length) index++; return source[index]; }
  function primary(): Fraction {
    const token = peek();
    let value: Fraction;
    if (token === '(') {
      index++; value = expression();
      if (peek() !== ')') throw new Error('Falta cerrar un paréntesis.');
      index++;
    } else if (token === '@' || /[A-Za-z]/.test(token || '')) {
      const match = source.slice(index).match(/^(?:@\[[0-9a-f-]{36}:(?:[1-9]|1[0-2])\]|[A-Za-z]+[1-9]\d*)/i);
      if (!match || !resolve) throw new Error('Referencia de celda no válida.');
      index += match[0].length;
      const resolved = normalizeAmount(resolve(match[0]));
      const [whole, decimals = ''] = resolved.replace('-', '').split('.');
      value = fraction(BigInt(whole + decimals) * (resolved.startsWith('-') ? -ONE : ONE), BigInt(10) ** BigInt(decimals.length));
    } else {
      const match = source.slice(index).match(/^\d+(?:[.,]\d+)?/);
      if (!match) throw new Error('Se esperaba un número o un paréntesis. Usa +, -, *, / y %.');
      const number = match[0].replace(',', '.');
      const [whole, decimals = ''] = number.split('.');
      if (whole.length > 14 || decimals.length > 6) throw new Error('Cada número admite hasta 14 enteros y 6 decimales.');
      index += match[0].length;
      value = fraction(BigInt(whole + decimals), BigInt(10) ** BigInt(decimals.length));
    }
    while (peek() === '%') { index++; value = fraction(value.n, value.d * BigInt(100)); }
    return value;
  }
  function unary(): Fraction {
    const token = peek();
    if (token === '+' || token === '-') { index++; const value = unary(); return { ...value, n: token === '-' ? -value.n : value.n }; }
    return primary();
  }
  function product(): Fraction {
    let value = unary();
    while (peek() === '*' || peek() === '/') {
      const operator = source[index++]; const right = unary();
      value = operator === '*' ? fraction(value.n * right.n, value.d * right.d) : fraction(value.n * right.d, value.d * right.n);
    }
    return value;
  }
  function expression(): Fraction {
    let value = product();
    while (peek() === '+' || peek() === '-') {
      const operator = source[index++]; const right = product();
      value = fraction(value.n * right.d + (operator === '+' ? right.n : -right.n) * value.d, value.d * right.d);
    }
    return value;
  }
  const result = expression();
  if (peek() !== undefined) throw new Error('Hay un símbolo no válido en la fórmula.');
  const scaled = (result.n < ZERO ? -result.n : result.n) * BigInt(1000000);
  let units = scaled / result.d;
  if ((scaled % result.d) * BigInt(2) >= result.d) units++;
  const digits = units.toString().padStart(7, '0');
  return normalizeAmount(`${result.n < ZERO ? '-' : ''}${digits.slice(0, -6)}.${digits.slice(-6)}`);
}

export function parseCellInput(input: string): { amount: string | null; formula: string | null } {
  const value = input.trim();
  if (!value) return { amount: null, formula: null };
  if (value.startsWith('=')) return { amount: evaluateFormula(value), formula: value };
  return { amount: normalizeAmount(value), formula: null };
}
