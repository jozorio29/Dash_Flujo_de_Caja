const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
function load(path,deps={}) { const m={exports:{}};const code=ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;new Function('require','module','exports',code)(n=>n in deps?deps[n]:require(n),m,m.exports);return m.exports; }
const model=load('lib/pl-model.ts');const formula=load('lib/pl-formula.ts',{'./pl-model':model});
const fx=load('lib/pl-exchange.ts',{'./pl-formula':formula,'./pl-model':model});
test('cotización positiva y división exacta BOB por USD',()=>{
 assert.equal(fx.normalizeExchangeRate('6,96'),'6.96');assert.equal(fx.convertBOBToUSD('696','6.96'),'100');assert.equal(fx.convertBOBToUSD('-696','6.96'),'-100');assert.equal(fx.convertBOBToUSD('1','3'),'0.333333');
 for(const x of ['0','-2','texto','1.0000001',null])assert.throws(()=>fx.normalizeExchangeRate(x));
});
const source=()=>({canEdit:true,sections:[],groups:[],accounts:[],values:[{id:'v1',account_id:'a',month:1,year:2026,currency:'BOB',amount:'696',formula:'=600+96',updated_at:'x'},{id:'v2',account_id:'a',month:2,year:2026,currency:'BOB',amount:'1000',updated_at:'y'}]});
test('cada mes usa su tipo de cambio, conserva originales y no recalcula la fórmula en USD',()=>{
 const data=source(),snapshot=JSON.stringify(data);
 const converted=fx.convertedPL(data,[{year:2026,month:1,rate:'6.96'},{year:2026,month:2,rate:'10'}]);
 assert.deepEqual(converted.values.map(v=>v.amount),['100','100']);assert.equal(converted.canEdit,false);assert.equal(JSON.stringify(data),snapshot);assert.deepEqual(converted.conversion.sourceValues,data.values);
});
test('sin cotización no inventa un valor ni usa la de otro mes',()=>{
 const converted=fx.convertedPL(source(),[{year:2026,month:1,rate:'6.96'}]);assert.equal(converted.values.length,1);assert.equal(converted.values[0].month,1);
 assert.equal(fx.convertedPL(source(),[]).values.length,0);
});
test('resumen convierte valores calculados BOB, anual suma USD y porcentajes se conservan',()=>{
 const rows=[{id:'r',format:'amount',cells:{}},{id:'p',format:'percent',cells:{}}];
 const source=new Map([['r',[{amount:'696'},{amount:'1000'},...Array.from({length:11},()=>({amount:null}))]],['p',Array.from({length:13},()=>({amount:'0.25'}))]]);
 const results=fx.convertSummaryResults(source,rows,2026,{1:'6.96',2:'10'});
 assert.equal(results.get('r')[0].amount,'100');assert.equal(results.get('r')[1].amount,'100');assert.equal(results.get('r')[12].amount,'200');assert.equal(results.get('p')[0].amount,'0.25');assert.equal(results.get('p')[12].amount,null);
});
let session=null,editor=false,calls=[],failure=null;
class StoreError extends Error {constructor(status){super('error');this.status=status;}}
const route=load('app/api/estado-resultados/tipo-cambio/route.ts',{
 'next-auth':{getServerSession:async()=>session},'@/lib/auth':{authOptions:{}},'@/lib/pl-exchange':fx,
 '@/lib/pl-exchange-store':{readExchangeRates:async()=>({enabled:true,rates:[]})},
 '@/lib/pl-store':{canEditPL:()=>editor,PLStoreError:StoreError,plRequest:async(table,query,init)=>{calls.push({table,body:JSON.parse(init.body)});if(failure)throw failure;return null;}}
});
const payload=()=>({year:2026,changes:[{month:8,rate:'6,96',previous:null}]});
const request=(body=payload(),origin='http://localhost:3000')=>new Request('http://localhost:3000/api/estado-resultados/tipo-cambio',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
test('API exige sesión, editor y mismo origen',async()=>{
 assert.equal((await route.POST(request())).status,401);session={user:{email:'editor@example.com'}};assert.equal((await route.POST(request())).status,403);editor=true;assert.equal((await route.POST(request(payload(),'https://other.example'))).status,403);assert.equal(calls.length,0);
});
test('API guarda cotizaciones por año con versión y autor sin tocar importes',async()=>{
 calls=[];assert.equal((await route.POST(request())).status,200);assert.deepEqual(calls,[{table:'rpc/save_pl_exchange_rates',body:{p_year:2026,p_changes:[{month:8,rate:'6.96',previous:null}],p_actor:'editor@example.com'}}]);
});
test('API rechaza cero, negativo, mes repetido y versiones inválidas antes de escribir',async()=>{
 calls=[];for(const rate of ['0','-1','texto'])assert.equal((await route.POST(request({year:2026,changes:[{month:8,rate,previous:null}]}))).status,400);
 const p=payload();p.changes.push(p.changes[0]);assert.equal((await route.POST(request(p))).status,400);
 const q=payload();q.changes[0].previous='bad';assert.equal((await route.POST(request(q))).status,400);assert.equal(calls.length,0);
});
test('API comunica conflictos y falta de migración',async()=>{
 failure=new StoreError(409);assert.equal((await route.POST(request())).status,409);failure=new StoreError(404);assert.match((await (await route.POST(request())).json()).error,/20261029_pl_exchange_rates/);failure=null;
});
