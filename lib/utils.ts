import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formatea un número como moneda. Por defecto muestra estilo "12.345.678"
 * (separador de miles con punto, sin decimales) tal como aparece en el sheet.
 */
export function formatCurrency(
  value: number,
  options: { decimals?: number; symbol?: string; compact?: boolean } = {}
): string {
  const { decimals = 0, symbol = "$", compact = false } = options;

  if (compact) {
    const abs = Math.abs(value);
    if (abs >= 1_000_000) {
      return `${value < 0 ? "-" : ""}${symbol}${(abs / 1_000_000).toFixed(1)}M`;
    }
    if (abs >= 1_000) {
      return `${value < 0 ? "-" : ""}${symbol}${(abs / 1_000).toFixed(1)}K`;
    }
  }

  const formatted = new Intl.NumberFormat("es-PE", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(Math.abs(value));

  const sign = value < 0 ? "-" : "";
  return `${sign}${symbol}${formatted}`;
}

export function formatNumber(value: number, decimals = 0): string {
  return new Intl.NumberFormat("es-PE", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatPercent(value: number, decimals = 1): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

/**
 * Convierte un string como "3.165.547" o "1,234.56" a número.
 * Maneja formatos europeos (1.234,56), latinoamericanos (1,234.56) y planos.
 */
export function parseAmount(raw: string | number | null | undefined): number {
  if (raw === null || raw === undefined || raw === "") return 0;
  if (typeof raw === "number") return raw;

  let s = String(raw).trim();
  if (!s) return 0;

  // Quitar símbolos de moneda y espacios
  s = s.replace(/[^\d.,\-]/g, "");
  if (!s) return 0;

  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");

  // Si tiene ambos, el último es decimal
  if (lastComma >= 0 && lastDot >= 0) {
    if (lastComma > lastDot) {
      // formato europeo: 1.234,56
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      // formato US: 1,234.56
      s = s.replace(/,/g, "");
    }
  } else if (lastComma >= 0) {
    // solo comas: si después de la coma hay 1-2 dígitos, es decimal; si no, miles
    const after = s.length - lastComma - 1;
    if (after === 1 || after === 2) {
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      s = s.replace(/,/g, "");
    }
  } else if (lastDot >= 0) {
    // solo puntos: idem
    const after = s.length - lastDot - 1;
    if (after === 1 || after === 2) {
      // decimal con punto
    } else {
      s = s.replace(/\./g, "");
    }
  }

  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

/**
 * Parsea fechas en formato dd/mm/yyyy, yyyy-mm-dd, ISO, o serial number de Google Sheets.
 * Google Sheets usa serial dates: días desde 1899-12-30 (ej: 45292 = 2024-01-01).
 */
export function parseDate(raw: string | number | null | undefined): Date | null {
  if (raw === null || raw === undefined || raw === "") return null;

  // Google Sheets serial date (cuando viene UNFORMATTED_VALUE como número)
  if (typeof raw === "number" && raw > 0 && raw < 100000) {
    // Serial epoch: 1899-12-30 (incluye el bug de Lotus 1-2-3 sobre 1900)
    const epoch = new Date(Date.UTC(1899, 11, 30));
    const ms = raw * 24 * 60 * 60 * 1000;
    const d = new Date(epoch.getTime() + ms);
    return isNaN(d.getTime()) ? null : d;
  }

  const s = String(raw).trim();
  if (!s) return null;

  // dd/mm/yyyy o dd-mm-yyyy
  const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (dmy) {
    const day = parseInt(dmy[1], 10);
    const month = parseInt(dmy[2], 10) - 1;
    let year = parseInt(dmy[3], 10);
    if (year < 100) year += 2000;
    const d = new Date(year, month, day);
    return isNaN(d.getTime()) ? null : d;
  }

  // Si es un número en string ("45292"), intenta como serial
  if (/^\d+(\.\d+)?$/.test(s)) {
    const n = parseFloat(s);
    if (n > 0 && n < 100000) {
      return parseDate(n);
    }
  }

  // yyyy-mm-dd o ISO
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

export function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  const months = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  return `${months[m - 1]} ${y}`;
}
