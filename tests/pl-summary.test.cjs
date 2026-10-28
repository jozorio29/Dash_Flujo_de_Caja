const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
function load(path,deps={}) { const m={exports:{}};const code=ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;new Function('require','module','exports',code)(n=>n in deps?deps[n]:require(n),m,m.exports);return m.exports; }
const model=load('lib/pl-model.ts');
const formula=load('lib/pl-formula.ts',{'./pl-model':model});
const {calculateSummary,validateSummary,formatSummary}=load('lib/pl-summary.ts',{'./pl-model':model,'./pl-formula':formula});
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const ref=(type,n)=>({kind:'reference',type,id:id(n)});
const op=value=>({kind:'operator',value});
const row=(n,tokens,format='amount')=>({id:id(n),name:`Fila ${n}`,tokens,format,sort_order:n,updated_at:'2026-10-28T12:00:00Z'});
function sheet() { return {sections:[{id:id(1),name:'Ingresos'},{id:id(2),name:'Egresos'}],groups:[{id:id(3),section_id:id(1),parent_id:null},{id:id(4),section_id:id(2),parent_id:null},{id:id(5),section_id:id(2),parent_id:id(4)}],accounts:[{id:id(6),group_id:id(3),active:true},{id:id(7),group_id:id(5),active:false}],values:[{account_id:id(6),month:1,amount:'100'},{account_id:id(6),month:2,amount:'900'},{account_id:id(7),month:1,amount:'50'},{account_id:id(7),month:2,amount:'90'}]}; }
test('suma jerarquías una sola vez y conserva importes archivados',()=>{
 const data=sheet(),rows=[row(10,[ref('group',4)]),row(11,[ref('section',2)])];validateSummary(rows,data);
 const r=calculateSummary(data,rows);assert.equal(r.get(id(10))[0].amount,'50');assert.equal(r.get(id(11))[12].amount,'140');
});
test('porcentaje anual usa totales y no suma promedios mensuales',()=>{
 const data=sheet(),rows=[row(10,[ref('section',1),op('-'),ref('section',2)]),row(11,[ref('summary',10),op('/'),ref('section',1)],'percent')];
 validateSummary(rows,data);const r=calculateSummary(data,rows);
 assert.equal(r.get(id(10))[12].amount,'860');assert.equal(r.get(id(11))[0].amount,'0.5');assert.equal(r.get(id(11))[1].amount,'0.9');assert.equal(r.get(id(11))[12].amount,'0.86');
 assert.match(formatSummary(r.get(id(11))[12],'percent'),/86/);
});
test('cambios de nombre y orden conservan referencias; cambios de monto recalculan',()=>{
 const data=sheet(),rows=[row(10,[ref('account',6)])];data.accounts.reverse();data.accounts[1].name='Renombrada';data.values[0].amount='150';assert.equal(calculateSummary(data,rows).get(id(10))[0].amount,'150');
});
test('sin datos no inventa ceros; cero explícito es válido; división cero es error',()=>{
 const data=sheet(),rows=[row(10,[ref('account',6)]),row(11,[ref('account',7),op('/'),ref('account',6)],'percent')];
 assert.equal(calculateSummary(data,rows).get(id(10))[2].amount,null);
 data.values[0].amount='0';const r=calculateSummary(data,rows);assert.equal(r.get(id(10))[0].amount,'0');assert.match(r.get(id(11))[0].error,/cero/);
});
test('rechaza ciclos, referencias inexistentes, operadores y sintaxis inválida',()=>{
 const data=sheet();
 assert.throws(()=>validateSummary([row(10,[ref('summary',11)]),row(11,[ref('summary',10)])],data),/circular/);
 assert.throws(()=>validateSummary([row(10,[ref('account',999)])],data),/no existe/);
 assert.throws(()=>validateSummary([row(10,[ref('account',6),op('+')])],data));
 assert.throws(()=>validateSummary([row(10,[ref('account',6),op('/'),{kind:'number',value:'0'},op('+')])],data));
 assert.throws(()=>validateSummary([row(10,[{kind:'number',value:'alert(1)'}])],data));
});
test('propaga errores del origen y errores en referencias eliminadas',()=>{
 const data=sheet(),rows=[row(10,[ref('account',6)]),row(11,[ref('summary',10)])];
 data.values[0].formulaError='Referencia circular';assert.match(calculateSummary(data,rows).get(id(11))[0].error,/origen/);
 data.accounts=[];assert.match(calculateSummary(data,rows).get(id(10))[0].error,/no existe/);
});

const {NextResponse}=require('next/server');
let session=null,editor=false,requests=[],dbRows=[],lastBody;
const routes=load('app/api/estado-resultados/resumen/route.ts',{
 'next/server':{NextResponse},'next-auth':{getServerSession:async()=>session},'@/lib/auth':{authOptions:{}},
 '@/lib/pl-summary':{validateSummary},'@/lib/pl-summary-store':{readSummaryRows:async()=>({rows:dbRows,enabled:true,monthlyEnabled:true})},
 '@/lib/pl-store':{canEditPL:()=>editor,PLStoreError:class extends Error{},readPL:async()=>sheet(),plRequest:async(table,query,init)=>{requests.push(table);lastBody=JSON.parse(init.body);return [];}}
});
const payload=()=>({action:'save',row:row(10,[ref('section',1)]),previous:null,year:2026,currency:'USD'});
const request=(body=payload(),origin='http://localhost:3000')=>new Request('http://localhost:3000/api/estado-resultados/resumen',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
test('API resumen exige sesión, editor y mismo origen',async()=>{
 session=null;editor=false;assert.equal((await routes.GET()).status,401);assert.equal((await routes.POST(request())).status,401);
 session={user:{email:'editor@example.com'}};assert.equal((await routes.POST(request())).status,403);
 editor=true;assert.equal((await routes.POST(request(payload(),'https://otro.example'))).status,403);assert.equal(requests.length,0);
});
test('API usa autor de sesión, rechaza ciclos y conflictos sin escribir',async()=>{
 session={user:{email:'editor@example.com'}};editor=true;dbRows=[];requests=[];
 assert.equal((await routes.POST(request())).status,200);assert.equal(lastBody.p_actor,'editor@example.com');assert.deepEqual(requests,['rpc/mutate_pl_summary']);
 requests=[];const bad=payload();bad.row.tokens=[ref('summary',10)];assert.equal((await routes.POST(request(bad))).status,400);assert.equal(requests.length,0);
 dbRows=[row(10,[ref('section',1)])];assert.equal((await routes.POST(request())).status,409);assert.equal(requests.length,0);
});
test('API no elimina una fila utilizada por otra',async()=>{
 dbRows=[row(10,[ref('section',1)]),row(11,[ref('summary',10)])];requests=[];
 const body={action:'delete',row:{id:id(10)},previous:dbRows[0].updated_at};
 assert.equal((await routes.POST(request(body))).status,409);assert.equal(requests.length,0);
});

test('celdas mensuales separan meses, años y monedas y recalculan referencias estables',()=>{
 const data=sheet();const r={...row(20,[{kind:'number',value:'0'}]),cells:{
 '2026:USD:1':{input:'12',format:'amount'},
 '2026:USD:2':{input:`=@[${id(6)}:1]+2`,format:'amount'},
 '2025:USD:1':{input:'999',format:'amount'},
 '2026:BOB:1':{input:'50',format:'amount'}
 }};
 validateSummary([r],data);
 let values=calculateSummary(data,[r],2026,'USD').get(r.id);
 assert.equal(values[0].amount,'12');assert.equal(values[1].amount,'102');assert.equal(values[2].amount,null);assert.equal(values[12].amount,'114');
 assert.equal(calculateSummary(data,[r],2026,'BOB').get(r.id)[0].amount,'50');
 data.values[0].amount='200';assert.equal(calculateSummary(data,[r],2026,'USD').get(r.id)[1].amount,'202');
});
test('porcentajes mensuales no se suman y borrar una celda conserva las demás',()=>{
 const data=sheet();const r={...row(20,[{kind:'number',value:'0'}]),cells:{'2026:USD:1':{input:'0.215',format:'percent'},'2026:USD:2':{input:'3',format:'amount'}}};
 const result=calculateSummary(data,[r],2026,'USD').get(r.id);assert.equal(result[0].amount,'0.215');assert.equal(result[12].amount,null);
 delete r.cells['2026:USD:1'];const next=calculateSummary(data,[r],2026,'USD').get(r.id);assert.equal(next[0].amount,null);assert.equal(next[1].amount,'3');assert.equal(next[12].amount,'3');
});
test('rechaza texto, períodos inválidos y referencias inexistentes en celdas mensuales',()=>{
 const data=sheet();const r={...row(20,[{kind:'number',value:'0'}]),cells:{'2026:USD:1':{input:'hola',format:'amount'}}};
 assert.throws(()=>validateSummary([r],data));
 r.cells['2026:USD:1'].input=`=@[${id(999)}:1]`;assert.throws(()=>validateSummary([r],data),/no existe/);
 r.cells={'2026:USD:13':{input:'3',format:'amount'}};assert.throws(()=>validateSummary([r],data),/período/);
});
test('una excepción mensual conserva las fórmulas anteriores en otros meses',()=>{
 const data=sheet();const r={...row(20,[ref('account',6)]),monthly_only:false,cells:{'2026:USD:1':{input:'25',format:'amount'}}};
 const values=calculateSummary(data,[r],2026,'USD').get(r.id);assert.equal(values[0].amount,'25');assert.equal(values[1].amount,'900');assert.equal(values[12].amount,'925');
 r.cells['2026:USD:1'].input='';validateSummary([r],data);assert.equal(calculateSummary(data,[r],2026,'USD').get(r.id)[0].amount,null);
});

test('API guarda celdas mensuales mediante RPC con versión y autor de sesión',async()=>{
 session={user:{email:'editor@example.com'}};editor=true;dbRows=[];requests=[];
 const body=payload();body.row.tokens=[{kind:'number',value:'0'}];body.row.cells={'2026:USD:1':{input:'120',format:'amount'}};
 assert.equal((await routes.POST(request(body))).status,200);
 assert.deepEqual(requests,['rpc/mutate_pl_summary_cells']);assert.equal(lastBody.p_row.monthly_only,true);assert.equal(lastBody.p_row.cells['2026:USD:1'].input,'120');assert.equal(lastBody.p_actor,'editor@example.com');
 requests=[];body.row.cells['2026:USD:1'].input='palabra';assert.equal((await routes.POST(request(body))).status,400);assert.equal(requests.length,0);
});

test('referencias mensuales a totales incluyen cuentas nuevas y conservan sección y mes',()=>{
 const data=sheet();const r={...row(20,[{kind:'number',value:'0'}]),monthly_only:true,cells:{'2026:USD:1':{input:`=@[${id(1)}:1]+@[${id(2)}:2]+5`,format:'amount'}}};
 validateSummary([r],data);assert.equal(calculateSummary(data,[r],2026,'USD').get(r.id)[0].amount,'195');
 data.accounts.push({id:id(30),group_id:id(3),active:true});data.values.push({account_id:id(30),month:1,amount:'25'});
 data.sections[0].name='Renombrada';assert.equal(calculateSummary(data,[r],2026,'USD').get(r.id)[0].amount,'220');
 data.values[0].formulaError='Error origen';assert.match(calculateSummary(data,[r],2026,'USD').get(r.id)[0].error,/error/);
 data.sections=[];assert.throws(()=>validateSummary([r],data),/no existe/);
});
test('un total vacío aporta cero a la fórmula sin modificar sus datos',()=>{
 const data=sheet();const r={...row(20,[{kind:'number',value:'0'}]),monthly_only:true,cells:{'2026:USD:1':{input:`=@[${id(1)}:3]+5`,format:'amount'}}};
 assert.equal(calculateSummary(data,[r],2026,'USD').get(r.id)[0].amount,'5');
 data.values.push({account_id:id(6),month:3,amount:'0'});assert.equal(calculateSummary(data,[r],2026,'USD').get(r.id)[0].amount,'5');
});

test('sumar totales con importes y vacíos conserva los importes disponibles',()=>{
 const data=sheet(); const before=JSON.stringify(data.values);
 const r={...row(20,[{kind:'number',value:'0'}]),monthly_only:true,cells:{'2026:USD:1':{input:`=@[${id(1)}:1]+@[${id(2)}:3]+@[${id(2)}:1]`,format:'amount'}}};
 const values=calculateSummary(data,[r],2026,'USD').get(r.id);
 assert.equal(values[0].amount,'150');assert.equal(values[12].amount,'150');
 assert.equal(JSON.stringify(data.values),before);
 assert.equal(formatSummary(values[1],'amount'),'');
 assert.equal(formatSummary({amount:null},'percent'),'');
 assert.equal(formatSummary({amount:'0'},'amount'),'—');
 assert.equal(formatSummary({amount:null,error:'Error real'},'amount'),'#ERROR');
});
