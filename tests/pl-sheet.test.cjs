const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
function load(path,deps={}) { const m={exports:{}};const code=ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;new Function('require','module','exports',code)(n=>n in deps?deps[n]:require(n),m,m.exports);return m.exports; }
const utils=load('lib/utils.ts');
const pl=load('lib/pl-sheet.ts',{'./utils':utils});
const ind=load('lib/indicadores.ts');

// Encabezados como en la hoja P&L (fila 1)
const headers=['Año','Mes','TIGO Bolivia (e-care)','TIGO Uruguay\n(Call center)','Alquiler de Oficina Tupperware','TIGO Otros servicios','TC PARALELO',
 'HORAS FACTURADAS Bolivia e-sim','HORAS TRABAJADAS Bolivia e-sim','INDICE DE PRODUCTIVIDAD Bolivia e-sim','PERSONAL FACTURADO Bolivia e-sim',
 'HORAS FACTURADAS Uruguay Call Center','HORAS TRABAJADAS Uruguay Call Center','Otra cosa',
 'Total Ingresos Operativos','Total Costos de Servicios','TOTAL EGRESOS (costos + egresos operativos)','UTILIDAD OPERATIVA - EBITDA','EBITDA %','MARGEN NETO %','',  'Columna ajena'].map(pl.normalizeHeader);

test('facturación: desde C hasta antes de TC, categoría por nombre (no por orden)',()=>{
 const tc=pl.findTCIndex(headers);assert.equal(tc,6);
 const cols=pl.selectFacturacionColumns(headers,tc);
 assert.deepEqual(cols.map(c=>c.label),['TIGO Bolivia (e-care)','TIGO Uruguay (Call center)','Alquiler de Oficina Tupperware','TIGO Otros servicios']);
 assert.deepEqual(cols.map(c=>c.group),['servicio','servicio','alquiler','servicio']);
});
test('sin TC no hay índice',()=>{assert.equal(pl.findTCIndex(['Año','Mes','X','HORAS FACTURADAS A']),null);});
test('horas: solo "HORAS FACTURADAS" después de TC, agrupadas por país',()=>{
 const {columns,groups}=pl.selectHorasColumns(headers,6);
 assert.deepEqual(columns.map(c=>[c.label,c.group,c.sheetIndex]),[['Bolivia e-sim','bolivia',7],['Uruguay Call Center','uruguay',11]]);
 assert.deepEqual(groups.map(g=>g.label),['Bolivia','Uruguay']);
});
test('indicadores: desde Total Ingresos Operativos hasta la primera columna vacía',()=>{
 const cols=pl.selectIndicadoresColumns(headers);
 assert.deepEqual(cols.map(c=>c.label),['Total Ingresos Operativos','Total Costos de Servicios','TOTAL EGRESOS (costos + egresos operativos)','UTILIDAD OPERATIVA - EBITDA','EBITDA %','MARGEN NETO %']);
 assert.deepEqual(cols.map(c=>c.tipo),['monto','monto','monto','monto','porcentaje','porcentaje']);
 assert.deepEqual(cols.map(c=>c.inverso),[false,true,true,false,false,false]);
});
test('indicadores: termina en ROE % inclusive, aunque haya columnas pegadas después',()=>{
 const h=['Año','Mes','TC PARALELO','Total Ingresos Operativos','UTILIDAD NETA','MARGEN NETO %','ROA % (Rentabilidad sobre Activos)','','ROE % (Rentabilidad sobre Capital)','Otra sección','Más'].map(pl.normalizeHeader);
 const cols=pl.selectIndicadoresColumns(h);
 assert.deepEqual(cols.map(c=>c.label),['Total Ingresos Operativos','UTILIDAD NETA','MARGEN NETO %','ROA % (Rentabilidad sobre Activos)','ROE % (Rentabilidad sobre Capital)']);
 assert.equal(cols.at(-1).tipo,'porcentaje');
});
test('filas: meses en español, fecha sin zona horaria, TC por fila, ignora filas inválidas',()=>{
 const rows=[headers,[2026,'Febrero',10,0,0,0,'9,62'],[2025,'Setiembre','1.234,50',0,0,0,9.14],['','',1],[2026,'Mes raro',5],[2026,'Enero',3,0,0,0,'']];
 const cols=pl.selectFacturacionColumns(headers,6);
 const data=pl.parsePLRows(rows,cols,6);
 assert.deepEqual(data.map(d=>d.fecha),['2025-09-01','2026-01-01','2026-02-01']);
 assert.deepEqual(data.map(d=>d.tc),[9.14,1,9.62]);
 assert.equal(data[0].col_2,1234.5);
});

const icols=[{key:'ing',label:'Total Ingresos Operativos',tipo:'monto',inverso:false},{key:'egr',label:'TOTAL EGRESOS',tipo:'monto',inverso:true},{key:'mg',label:'EBITDA %',tipo:'porcentaje',inverso:false}];
const irows=[
 {ano:2025,fecha:'2025-02-01',tc:10,ing:100,egr:80,mg:0.2},
 {ano:2026,fecha:'2026-01-01',tc:10,ing:100,egr:50,mg:0.5},
 {ano:2026,fecha:'2026-02-01',tc:12,ing:300,egr:60,mg:0.8},
];
test('KPI mes vs mes anterior: % para montos, p.p. para porcentajes, inversos',()=>{
 const k=ind.computeKPIs(irows,icols,{periodo:'2026-02',modo:'mes',comparar:'anterior',moneda:'USD'});
 assert.equal(k[0].actual,300);assert.equal(k[0].delta,200);assert.equal(k[0].favorable,true);
 assert.equal(k[1].delta,20);assert.equal(k[1].favorable,false);
 assert.ok(Math.abs(k[2].delta-30)<1e-9);
});
test('KPI acumulado: suma montos con TC de cada mes y pondera % por ingresos',()=>{
 const k=ind.computeKPIs(irows,icols,{periodo:'2026-02',modo:'ytd',comparar:'anterior',moneda:'BOB'});
 assert.equal(k[0].actual,100*10+300*12);
 // (0.5*1000 + 0.8*3600) / 4600
 assert.ok(Math.abs(k[2].actual-(0.5*1000+0.8*3600)/4600)<1e-9);
 assert.equal(k[0].anterior,1000); // ene–feb 2025 solo tiene feb
});
test('sin período de comparación la variación queda vacía',()=>{
 const k=ind.computeKPIs(irows,icols,{periodo:'2026-01',modo:'mes',comparar:'anio',moneda:'USD'});
 assert.equal(k[0].anterior,null);assert.equal(k[0].delta,null);assert.equal(k[0].favorable,null);
});
test('período por defecto: último mes con datos que no sea futuro',()=>{
 const rows=[...irows,{ano:2026,fecha:'2026-03-01',tc:1,ing:0,egr:0,mg:0},{ano:2026,fecha:'2026-12-01',tc:1,ing:5,egr:0,mg:0}];
 assert.equal(ind.defaultPeriodo(rows,icols,'2026-11'),'2026-02');
});
