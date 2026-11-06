const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
function load(file) {
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)(require, module, module.exports);
  return module.exports;
}
const P = load('lib/pl-base-sheet.ts');

// Celdas con la forma de la API de Sheets.
const BOLD_DARK = { textFormat: { bold: true }, backgroundColor: { red: 0.18, green: 0.33, blue: 0.59 } };
const BOLD_GREY = { textFormat: { bold: true }, backgroundColor: { red: 0.72, green: 0.72, blue: 0.72 } };
const BOLD = { textFormat: { bold: true }, backgroundColor: { red: 1, green: 1, blue: 1 } };
const L = (text, format) => ({ formattedValue: text, effectiveFormat: format });
const N = (value, formula) => ({ formattedValue: String(value), effectiveValue: { numberValue: value }, ...(formula ? { userEnteredValue: { formulaValue: formula } } : {}) });
const serial = (y, m) => (Date.UTC(y, m - 1, 1) / 86400000) + 25569;
const months = (y, fn) => Array.from({ length: 12 }, (_, m) => fn(m, y));
// A, B, 2025 (C..N) + TOTAL (O), separador (P), 2026 (Q..AB) + TOTAL (AC)
const row = (label, fn = () => ({})) => [{}, label, ...months(2025, fn), {}, {}, ...months(2026, fn), {}];
const header = [{}, {}, ...months(2025, (m, y) => N(serial(y, m + 1))), { formattedValue: 'TOTALES 2025' }, {}, ...months(2026, (m, y) => N(serial(y, m + 1))), { formattedValue: 'TOTALES 2026' }];

function grid() {
  return [
    row(L('P&L EUROPE', BOLD)).map((c, i) => (i > 1 ? {} : c)),
    header,
    row(L('INGRESOS OPERATIVOS', BOLD_DARK), (m, y) => N(serial(y, m + 1))),
    row(L('TC PARALELO', BOLD), () => N(9.5, "=VLOOKUP(C$3;'Cotizacion Dolar'!$B:$D;2;FALSE)")),
    row(L(''), () => N(7, "=VLOOKUP(C$3;'Cotizacion Dolar'!$B:$D;3;FALSE)")),
    row(L('TIGO Bolivia (e-care)'), (m) => N(100 + m, '=(1000+' + m + ')/C4')),
    row(L('Alquiler de Posiciones de trabajo - Tupperware'), () => N(50)),
    row(L('Total Ingresos Operativos', BOLD_DARK), (m) => N(150 + m, '=SUM(C6:C7)')),
    row(L('HORAS FACTURADAS Bolivia e-sim', BOLD), () => N(2183)),
    row(L('INDICE DE PRODUCTIVIDAD Bolivia e-sim', BOLD), () => N(1)),
    row(L('COSTOS DE SERVICIOS', BOLD_DARK)),
    row(L('Salarios Personal en Nómina', BOLD_GREY), () => N(30, '=SUM(C13:C13)')),
    row(L('Salarios agentes'), () => N(30)),
    row(L('Honorarios - Persona WFM', BOLD_GREY), () => N(5, '=C15*C16')),
    row(L('Total honorarios cobrados en el mes'), () => N(10)),
    row(L('Total Costos de Servicios', BOLD_DARK), () => N(35, '=C12+C14')),
    row(L('EGRESOS OPERATIVOS', BOLD)),
    row(L('GASTOS ADMINISTRATIVOS', { textFormat: { bold: true }, backgroundColor: { red: 0.26, green: 0.26, blue: 0.26 } }), () => N(20, '=C19')),
    row(L('Internet'), () => N(20)),
    row(L('Total Egresos Operativos', BOLD_DARK), () => N(20, '=C18')),
    row(L('TOTAL APORTES', BOLD), () => N(0)),
    row(L('TOTAL INGRESOS', BOLD), () => N(150, '=C8')),
    row(L('TOTAL EGRESOS', BOLD), () => N(55, '=+C16+C20')),
    row(L('UTILIDAD OPERATIVA - EBITDA', BOLD), () => N(95, '=C22-C23')),
    row(L('MARGEN NETO %', BOLD), () => ({ formattedValue: '63%', effectiveValue: { numberValue: 0.63 } })),
    row(L('Cotizacion Dólar Paralelo')),
    row(L('Notas')),
  ];
}

test('detecta los años y sus columnas desde la fila de fechas', () => {
  const g = grid();
  const h = P.findHeaderRow(g);
  assert.equal(h, 1);
  const blocks = P.findYearBlocks(g, h);
  assert.deepEqual(blocks.map((b) => b.year), [2025, 2026]);
  assert.equal(blocks[0].months[0], 2);
  assert.equal(blocks[0].totalCol, 14);
  assert.equal(blocks[1].months[11], 27);
  assert.equal(blocks[1].totalCol, 28);
});

test('series mensuales para Facturación, Horas e Indicadores', () => {
  const g = grid();
  const blocks = P.findYearBlocks(g, P.findHeaderRow(g));
  const fact = P.facturacionSpecs(g);
  assert.deepEqual(fact.map((c) => [c.label, c.group]), [['TIGO Bolivia (e-care)', 'servicio'], ['Alquiler de Posiciones de trabajo - Tupperware', 'alquiler']]);
  const data = P.monthlyRows(g, blocks, fact);
  assert.equal(data.length, 24);
  assert.deepEqual([data[2].ano, data[2].mes, data[2].fecha, data[2].tc], [2025, 'marzo', '2025-03-01', 9.5]);
  assert.equal(data[2][fact[0].key], 102);
  const horas = P.horasSpecs(g);
  assert.deepEqual(horas.columns.map((c) => c.label), ['Bolivia e-sim']);
  assert.deepEqual(horas.groups, [{ id: 'bolivia', label: 'Bolivia' }]);
  const ind = P.indicadoresSpecs(g);
  assert.deepEqual(ind.map((c) => c.label), [
    'Total Ingresos Operativos', 'Total Costos de Servicios', 'Total Egresos Operativos',
    'TOTAL EGRESOS (costos + egresos operativos)', 'UTILIDAD OPERATIVA - EBITDA', 'MARGEN NETO %',
  ]);
  assert.deepEqual(ind.map((c) => c.tipo).slice(-1), ['porcentaje']);
  assert.equal(ind[1].inverso, true);
});

test('clasifica secciones, grupos, cuentas y totales; excluye horas y lo posterior al margen', () => {
  const st = P.buildStatement(grid());
  assert.deepEqual(st.years, [2025, 2026]);
  const kinds = st.rows.map((r) => `${r.kind}:${r.label}`);
  assert.deepEqual(kinds, [
    'section:INGRESOS OPERATIVOS',
    'info:TC PARALELO',
    'account:TIGO Bolivia (e-care)',
    'account:Alquiler de Posiciones de trabajo - Tupperware',
    'total:Total Ingresos Operativos',
    'section:COSTOS DE SERVICIOS',
    'group:Salarios Personal en Nómina',
    'account:Salarios agentes',
    'account:Honorarios - Persona WFM',
    'detail:Total honorarios cobrados en el mes',
    'total:Total Costos de Servicios',
    'section:EGRESOS OPERATIVOS',
    'group:GASTOS ADMINISTRATIVOS',
    'account:Internet',
    'total:Total Egresos Operativos',
    'section:Resultados',
    'result:TOTAL APORTES',
    'result:TOTAL INGRESOS',
    'result:TOTAL EGRESOS',
    'result:UTILIDAD OPERATIVA - EBITDA',
    'result:MARGEN NETO %',
  ]);
  const tigo = st.rows.find((r) => r.label.startsWith('TIGO'));
  assert.equal(tigo.row, 6);
  assert.equal(tigo.cells[2026].length, 13);
  assert.deepEqual(tigo.cells[2026][0], { text: '100', value: 100, formula: '=(1000+0)/C4', address: 'Q6' });
});

test('fórmulas de suma y letras de columna', () => {
  for (const f of ['=C6+C7', '=SUM(C52:C58)', '=+Q162+Q278', '=SUM(C204+C205)', '=Q62+Q68+Q71']) assert.equal(P.isSumFormula(f), true, f);
  for (const f of ['=Q63*Q64', "=VLOOKUP(C$12;'Cotizacion Dolar'!$B:$D;2;FALSE)", '=C293-(C283+C282)', '=30955,62/Q13']) assert.equal(P.isSumFormula(f), false, f);
  assert.deepEqual([0, 1, 25, 26, 27, 28].map(P.columnLetter), ['A', 'B', 'Z', 'AA', 'AB', 'AC']);
});

test('valida lo que se escribe en una celda (configuración española)', () => {
  for (const ok of ['1234', '-1234,50', '12,5%', '=30955,62/Q13', "=VLOOKUP(Q$12;'Cotizacion Dolar'!$G:$I;2;FALSE)", '']) {
    assert.equal(P.validateCellInput(` ${ok} `), ok);
  }
  assert.throws(() => P.validateCellInput('1234.50'), /coma/);
  assert.throws(() => P.validateCellInput('1.234,50'), /número/);
  assert.throws(() => P.validateCellInput('hola'), /número/);
  assert.throws(() => P.validateCellInput('=IMPORTRANGE("x";"A1")'), /externos/);
  assert.equal(P.editableText({ text: '1.234', value: 1234.5, formula: null, address: 'Q6' }), '1234,5');
  assert.equal(P.editableText({ text: '9', value: 9, formula: '=C6+1', address: 'Q6' }), '=C6+1');
});

test('solo se editan cuentas sin cambios desde la lectura', () => {
  const st = P.buildStatement(grid());
  const base = { row: 6, address: 'Q6', label: 'TIGO Bolivia (e-care)', formula: '=(1000+0)/C4', value: 100 };
  assert.equal(P.findEditableCell(st, base).cell.address, 'Q6');
  assert.throws(() => P.findEditableCell(st, { ...base, label: 'Otra cuenta' }), /filas del Sheet cambiaron/);
  assert.throws(() => P.findEditableCell(st, { ...base, formula: '=1' }), /cambió en el Sheet/);
  assert.throws(() => P.findEditableCell(st, { ...base, address: 'AC6' }), /total anual/);
  assert.throws(() => P.findEditableCell(st, { row: 8, address: 'Q8', label: 'Total Ingresos Operativos', formula: '=SUM(C6:C7)', value: 150 }), /calcula el Sheet/);
  const literal = { row: 7, address: 'R7', label: 'Alquiler de Posiciones de trabajo - Tupperware', formula: null, value: 50 };
  assert.equal(P.findEditableCell(st, literal).cell.address, 'R7');
  assert.throws(() => P.findEditableCell(st, { ...literal, value: 49 }), /cambió en el Sheet/);
});

test('fila del registro de cambios (Log Portal)', () => {
  const when = new Date(Date.UTC(2026, 10, 5, 18, 30, 15));
  const row = P.logRow({ email: 'a@x.com', address: 'S15', row: 15, year: 2026, month: 3, before: '=30955,62/Q13', after: '' }, when);
  assert.equal(row.length, P.LOG_HEADERS.length);
  assert.match(row[0], /^05\/11\/2026,? 14:30:15$/);
  assert.deepEqual(row.slice(1), ['America/La_Paz', 'a@x.com', 'S15', '15', 'MAR-26', '=30955,62/Q13', '(vacío)']);
  // Misma hora del servidor, mostrada en la zona del usuario.
  const madrid = P.logRow({ email: 'a@x.com', address: 'S15', row: 15, year: 2026, month: 3, before: '1', after: '2' }, when, 'Europe/Madrid');
  assert.match(madrid[0], /^05\/11\/2026,? 19:30:15$/);
  assert.equal(madrid[1], 'Europe/Madrid');
  for (const bad of ['Marte/Olympus', '../../etc', '', 42, null]) assert.equal(P.safeTimeZone(bad), 'America/La_Paz');
});

test('fórmulas con el nombre del concepto en vez de la celda', () => {
  const labels = P.buildStatement(grid()).labels;
  assert.equal(labels[6], 'TIGO Bolivia (e-care)');
  const col = (c) => ({ Q: 'ENE-26', R: 'FEB-26', AB: 'DIC-26' })[c] ?? null;
  const d = (f, own = 'Q') => P.describeFormula(f, labels, own, col);
  assert.equal(d('=Q6+Q7'), '[TIGO Bolivia (e-care)] + [Alquiler de Posiciones de trabajo - Tupperware]');
  assert.equal(d('=SUM(Q6:Q7)'), 'SUM([TIGO Bolivia (e-care)] … [Alquiler de Posiciones de trabajo - Tupperware])');
  assert.equal(d('=SUM(Q6:AB6)', 'AC'), 'SUM([TIGO Bolivia (e-care)] (ENE-26 a DIC-26))');
  assert.equal(d('=R6*$Q$13'), '[TIGO Bolivia (e-care)] (FEB-26) * [Salarios agentes]');
  assert.equal(d('=30955,62/Q4'), '30955,62 / [TC PARALELO]');
  assert.equal(d('=Q999'), '[Fila 999]');
  assert.equal(d("=VLOOKUP(Q$3;'Cotizacion Dolar'!$B:$D;2;FALSE)"), "VLOOKUP([INGRESOS OPERATIVOS]; 'Cotizacion Dolar'!$B:$D; 2; FALSE)");
  assert.equal(d('=IF(Q6>0;"Q6 ok";LOG10(Q7))'), 'IF([TIGO Bolivia (e-care)]>0; "Q6 ok"; LOG10([Alquiler de Posiciones de trabajo - Tupperware]))');
});
