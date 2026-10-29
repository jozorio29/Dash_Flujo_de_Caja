const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
function load(path,deps={}) { const m={exports:{}};const code=ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;new Function('require','module','exports',code)(n=>n in deps?deps[n]:require(n),m,m.exports);return m.exports; }
const links=load('lib/pl-cell-links.ts');
test('admite enlaces HTTPS de Drive y rechaza esquemas ejecutables y credenciales',()=>{
 assert.equal(links.normalizeInvoiceURL(' https://drive.google.com/file/d/abc/view '),'https://drive.google.com/file/d/abc/view');
 for(const value of ['javascript:alert(1)','data:image/png;base64,abc','http://example.com','https://user:pass@example.com/file','no url',null,'https://example.com/'+ 'x'.repeat(2050)])assert.throws(()=>links.normalizeInvoiceURL(value));
});
let session=null,editor=false,calls=[],failure=null;
class StoreError extends Error {constructor(status){super('error');this.status=status;}}
const route=load('app/api/estado-resultados/enlaces/route.ts',{
 'next-auth':{getServerSession:async()=>session},'@/lib/auth':{authOptions:{}},'@/lib/pl-cell-links':links,
 '@/lib/pl-store':{canEditPL:()=>editor,PLStoreError:StoreError,plRequest:async(table,query,init)=>{calls.push({table,query,body:init?.body?JSON.parse(init.body):null});if(failure)throw failure;return [];}}
});
const payload=()=>({kind:'account',sourceId:'00000000-0000-4000-8000-000000000001',year:2026,month:8,currency:'USD',url:'https://drive.google.com/file/d/test/view',previous:null});
const request=(body=payload(),origin='http://localhost:3000')=>new Request('http://localhost:3000/api/estado-resultados/enlaces',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
test('lectura requiere sesión; escritura exige editor y origen autorizado',async()=>{
 assert.equal((await route.GET(new Request('http://localhost:3000/api/estado-resultados/enlaces?year=2026&currency=USD&kind=account'))).status,401);
 assert.equal((await route.POST(request())).status,401);
 session={user:{email:'viewer@example.com'}};assert.equal((await route.POST(request())).status,403);
 editor=true;assert.equal((await route.POST(request(payload(),'https://other.example'))).status,403);assert.equal(calls.length,0);
});
test('guarda solo URL en su período con autor y versión, sin modificar importes',async()=>{
 calls=[];session={user:{email:'editor@example.com'}};editor=true;
 const body={...payload(),updated_by:'forged@example.com',amount:'100'};
 assert.equal((await route.POST(request(body))).status,200);
 assert.equal(calls[0].table,'rpc/mutate_pl_cell_link');assert.equal(calls[0].body.p_month,8);assert.equal(calls[0].body.p_currency,'USD');assert.equal(calls[0].body.p_actor,'editor@example.com');assert.equal(calls[0].body.p_previous,null);assert.equal(calls[0].body.amount,undefined);
 calls=[];const previous='2026-10-29T12:00:00Z';assert.equal((await route.POST(request({...payload(),kind:'summary',previous,url:null}))).status,200);assert.equal(calls[0].body.p_url,null);assert.equal(calls[0].body.p_previous,previous);assert.equal(calls[0].body.p_kind,'summary');
});
test('rechaza URL y celdas inválidas antes de escribir',async()=>{
 calls=[];
 for(const patch of [{url:'javascript:alert(1)'},{month:13},{currency:'EUR'},{kind:'other'},{sourceId:'bad'},{previous:'bad'}])assert.equal((await route.POST(request({...payload(),...patch}))).status,400);
 assert.equal(calls.length,0);
});
test('informa conflicto y migración pendiente sin fingir guardado',async()=>{
 failure=new StoreError(409);assert.equal((await route.POST(request())).status,409);
 failure=new StoreError(404);const response=await route.POST(request());assert.equal(response.status,409);assert.match((await response.json()).error,/20261029/);
 const get=await route.GET(new Request('http://localhost:3000/api/estado-resultados/enlaces?year=2026&currency=USD&kind=account'));assert.deepEqual(await get.json(),{links:[],enabled:false});failure=null;
});
