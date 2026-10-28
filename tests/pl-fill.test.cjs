const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const m={exports:{}};
new Function('module','exports',ts.transpileModule(fs.readFileSync('lib/pl-fill.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText)(m,m.exports);
const {shiftPLFormula,fillMonths}=m.exports;
const id='00000000-0000-4000-8000-000000000001';
test('relleno relativo conserva IDs, números fijos y porcentajes',()=>{
 assert.equal(shiftPLFormula(`=@[${id}:1]+@[${id}:2]+100*15%`,2),`=@[${id}:3]+@[${id}:4]+100*15%`);
 assert.equal(shiftPLFormula('=100+2',11),'=100+2');
 assert.equal(shiftPLFormula(`=@[${id}:12]/2`,-11),`=@[${id}:1]/2`);
});
test('el rango excluye origen y permite ambos sentidos hasta diciembre',()=>{
 assert.deepEqual(fillMonths(1,12),[2,3,4,5,6,7,8,9,10,11,12]);
 assert.deepEqual(fillMonths(4,1),[3,2,1]);assert.deepEqual(fillMonths(5,5),[]);
 assert.throws(()=>fillMonths(0,12));assert.throws(()=>fillMonths(1,13));
});
test('rechaza el relleno completo si una referencia sale del año',()=>{
 assert.throws(()=>shiftPLFormula(`=@[${id}:12]+5`,1),/saldría/);
 assert.throws(()=>shiftPLFormula(`=@[${id}:1]`,-1),/saldría/);
 assert.throws(()=>shiftPLFormula('=2',1.5));
});
