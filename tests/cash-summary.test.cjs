const test=require('node:test');
const assert=require('node:assert/strict');
const ts=require('typescript');
const fs=require('node:fs');
const mod={exports:{}};
new Function('exports',ts.transpileModule(fs.readFileSync('lib/cash-summary.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText)(mod.exports);
const {buildCashSummary}=mod.exports;
const real=(day,creditos,debitos=0)=>({fecha:new Date(2026,8,day),creditos,debitos,saldo:100,saldoUsd:10,conceptoPL:'Alquiler de oficina',categoria:'Alquiler de oficina',descPL:'Servicios'});
const plan=(day,ingresos,egresos=0)=>({fecha:new Date(2026,8,day),ingresos,egresos,creditoUsd:ingresos/10,debitoUsd:egresos/10,conceptoPL:'Alquiler de oficina'});
test('compara mismo corte y cierra con futuro sin duplicar proyección pasada',()=>{
 const r=buildCashSummary([real(1,100,40),real(28,999)],[plan(1,80,30),plan(28,50,10)],'2026-09','BOB',new Date(2026,8,24));
 assert.equal(r.income,100); assert.equal(r.variations[0].delta,20); assert.equal(r.closing[0].estimate,150); assert.equal(r.closing[0].forecast,130); assert.equal(r.expenses[0].operating,true); assert.equal(r.daily[24].actual,null);
});
test('sin proyección no inventa comparaciones o cierre futuro',()=>{
 const r=buildCashSummary([real(1,100)],[],'2026-09','BOB',new Date(2026,8,24));
 assert.equal(r.hasForecast,false);assert.equal(r.closing[0].estimate,null);assert.deepEqual(r.top,[]);
 const closed=buildCashSummary([real(1,100)],[],'2026-09','BOB',new Date(2026,9,1)); assert.equal(closed.closing[0].estimate,100);
});
test('USD usa conversión por movimiento y notifica tasas ausentes',()=>{
 const r=buildCashSummary([real(1,100),{...real(2,20),saldo:0}],[],'2026-09','USD',new Date(2026,8,24));assert.equal(r.income,10);assert.equal(r.missingRates,1);
});
