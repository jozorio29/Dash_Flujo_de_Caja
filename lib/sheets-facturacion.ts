import { fetchSheetValues } from "./google-sheets-client";
import { parseAmount } from "./utils";

export interface FacturacionRow {
  ano: number;
  mes: string;
  // C:I
  tigoBolivia: number;
  tigoUruguayCC: number;
  tigoUruguayTM: number;
  tigoUruguayCapCC: number;
  tigoUruguayCapTV: number;
  tigoUruguayCapPort: number;
  tigoOtros: number;
  // J:L
  alquilerPos: number;
  alquilerSala: number;
  alquilerZen: number;
  // M
  tc: number;
  
  // Para filtros
  fecha: Date;
}

const MESES: Record<string, number> = {
  enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5,
  julio: 6, agosto: 7, septiembre: 8, octubre: 9, noviembre: 10, diciembre: 11
};

export async function getFacturacionData(): Promise<FacturacionRow[]> {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  if (!spreadsheetId) return [];

  const rows = await fetchSheetValues(spreadsheetId, "P&L!A:M");
  
  const data: FacturacionRow[] = [];
  
  // Asumimos que la fila 1 son headers
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !row[0] || !row[1]) continue;
    
    const anoStr = String(row[0]).trim();
    const mesStr = String(row[1]).trim().toLowerCase();
    
    const ano = parseInt(anoStr, 10);
    if (isNaN(ano)) continue;
    
    const mesIndex = MESES[mesStr];
    if (mesIndex === undefined) continue;
    
    const fecha = new Date(ano, mesIndex, 1);
    
    data.push({
      ano,
      mes: mesStr,
      tigoBolivia: parseAmount(row[2]),
      tigoUruguayCC: parseAmount(row[3]),
      tigoUruguayTM: parseAmount(row[4]),
      tigoUruguayCapCC: parseAmount(row[5]),
      tigoUruguayCapTV: parseAmount(row[6]),
      tigoUruguayCapPort: parseAmount(row[7]),
      tigoOtros: parseAmount(row[8]),
      alquilerPos: parseAmount(row[9]),
      alquilerSala: parseAmount(row[10]),
      alquilerZen: parseAmount(row[11]),
      tc: parseAmount(row[12]) || 1, // Por si acaso no hay TC
      fecha,
    });
  }
  
  // Ordenar por fecha
  data.sort((a, b) => a.fecha.getTime() - b.fecha.getTime());
  
  return data;
}
