#!/usr/bin/env node
/**
 * Inspecciona la respuesta cruda de Google Sheets y compara los totales
 * que calcula el dashboard contra los datos del sheet.
 *
 * Uso: node scripts/inspect-sheet.mjs    (o `npm run inspect:sheet`)
 */

import fs from "node:fs";
import path from "node:path";

// 1) Cargar .env.local manualmente
const envPath = path.resolve(process.cwd(), ".env.local");
if (!fs.existsSync(envPath)) {
  console.error("❌ No existe .env.local. Cópialo desde .env.example primero.");
  process.exit(1);
}
const env = Object.fromEntries(
  fs
    .readFileSync(envPath, "utf-8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const idx = l.indexOf("=");
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()];
    })
);

const apiKey = env.GOOGLE_SHEETS_API_KEY;
const id = env.GOOGLE_SHEETS_SPREADSHEET_ID;
const range = env.GOOGLE_SHEETS_RANGE || "Hoja 1!A:N";

if (!apiKey || !id) {
  console.error("❌ Falta GOOGLE_SHEETS_API_KEY o GOOGLE_SHEETS_SPREADSHEET_ID en .env.local");
  process.exit(1);
}

// 2) Fetch al sheet
const url = `https://sheets.googleapis.com/v4/spreadsheets/${id}/values/${encodeURIComponent(
  range
)}?key=${apiKey}&valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=FORMATTED_STRING`;

console.log("📡 Consultando rango:", range);

const res = await fetch(url);
if (!res.ok) {
  console.error(`❌ HTTP ${res.status}:`, await res.text());
  process.exit(1);
}
const data = await res.json();
const rows = data.values || [];

console.log(`\n✅ ${rows.length} filas recibidas\n`);

// 3) Buscar header
const headerIdx = rows.findIndex(
  (r) => String(r?.[0] || "").trim().toLowerCase() === "fecha"
);
console.log(`🔍 Header detectado en fila ${headerIdx >= 0 ? headerIdx + 1 : "no encontrada"}`);
if (headerIdx >= 0) {
  console.log("   Columnas:", rows[headerIdx].map((c, i) => `${String.fromCharCode(65+i)}=${c}`).join(" | "));
}

// 4) Replicar la lógica de parseo del dashboard (lib/sheets.ts)
function parseAmount(raw) {
  if (raw === null || raw === undefined || raw === "") return 0;
  if (typeof raw === "number") return raw;
  let s = String(raw).trim().replace(/[^\d.,\-]/g, "");
  if (!s) return 0;
  const lastComma = s.lastIndexOf(","), lastDot = s.lastIndexOf(".");
  if (lastComma >= 0 && lastDot >= 0) {
    s = lastComma > lastDot ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  } else if (lastComma >= 0) {
    const after = s.length - lastComma - 1;
    s = (after === 1 || after === 2) ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  } else if (lastDot >= 0) {
    const after = s.length - lastDot - 1;
    if (!(after === 1 || after === 2)) s = s.replace(/\./g, "");
  }
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

function parseDate(raw) {
  if (raw === null || raw === undefined || raw === "") return null;
  if (typeof raw === "number" && raw > 0 && raw < 100000) {
    const epoch = new Date(Date.UTC(1899, 11, 30));
    const d = new Date(epoch.getTime() + raw * 86400000);
    return isNaN(d.getTime()) ? null : d;
  }
  const s = String(raw).trim();
  if (!s) return null;
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (m) {
    let y = parseInt(m[3], 10);
    if (y < 100) y += 2000;
    const d = new Date(y, parseInt(m[2], 10) - 1, parseInt(m[1], 10));
    return isNaN(d.getTime()) ? null : d;
  }
  if (/^\d+(\.\d+)?$/.test(s)) {
    const n = parseFloat(s);
    if (n > 0 && n < 100000) return parseDate(n);
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

// 5) Iterar filas data y separar parseadas vs descartadas
const dataRows = headerIdx >= 0 ? rows.slice(headerIdx + 1) : rows;
let totalIngresos = 0, totalEgresos = 0, parseadas = 0;
const descartadas = [];

for (const row of dataRows) {
  if (!row || row.length === 0) continue;
  const debitos = parseAmount(row[11]);   // L
  const creditos = parseAmount(row[12]);  // M
  const parsedFecha = parseDate(row[0]);
  const fechaRaw = String(row[0] ?? "").trim();

  if (!parsedFecha) {
    if (debitos !== 0 || creditos !== 0) {
      descartadas.push({ row, motivo: "sin fecha válida", debitos, creditos });
    }
    continue;
  }
  if (/^(total|subtotal|saldo)/i.test(fechaRaw)) {
    descartadas.push({ row, motivo: "etiqueta en col A", debitos, creditos });
    continue;
  }
  totalEgresos += debitos;
  totalIngresos += creditos;
  parseadas++;
}

console.log(`\n📊 Movimientos parseados: ${parseadas}`);
console.log(`   Total Ingresos (Σ M):  ${totalIngresos.toLocaleString("es-PE")}`);
console.log(`   Total Egresos  (Σ L):  ${totalEgresos.toLocaleString("es-PE")}`);
console.log(`   Net Flow:               ${(totalIngresos - totalEgresos).toLocaleString("es-PE")}`);

if (descartadas.length > 0) {
  console.log(`\n⚠️  ${descartadas.length} fila(s) descartada(s) (no se suman al total):`);
  descartadas.slice(0, 10).forEach((d, i) => {
    const preview = d.row.slice(0, 14).map((v, idx) => v && String(v).length > 0 ? `${String.fromCharCode(65+idx)}=${String(v).slice(0,30)}` : null).filter(Boolean).join(" | ");
    console.log(`   ${i+1}. (${d.motivo}) [L=${d.debitos}, M=${d.creditos}]`);
    console.log(`      ${preview}`);
  });
  if (descartadas.length > 10) console.log(`   ... y ${descartadas.length - 10} más`);
}

console.log("\n💡 Compara estos totales con los TOTALES de tu sheet. Si NO cuadran, dímelo y lo investigamos.");
