const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
function load(file, dependencies = {}) {
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)(name => name in dependencies ? dependencies[name] : require(name), module, module.exports);
  return module.exports;
}
const model = load('lib/pl-model.ts');
test('decimales exactos, vacíos y cero', () => {
  assert.equal(model.normalizeAmount('38377,50'), '38377.5');
  assert.equal(model.sumAmounts(['0.1', '0.2']), '0.3');
  assert.equal(model.sumAmounts(['99999999999999.999999', '0.000001']), '100000000000000');
  assert.equal(model.sumAmounts([]), null);
  assert.equal(model.sumAmounts(['0']), '0');
  assert.equal(model.sumAmounts(['-7.123456','2.123456']), '-5');
  assert.equal(model.displayAmount('38377.5'), '38.377,5');
  for (const value of ['1.234,56', 'NaN', 'Infinity', '=1+1', '1e5', '1.1234567']) assert.throws(() => model.normalizeAmount(value));
});
let session, editor, calls, responseRows;
class StoreError extends Error { constructor(status) { super(); this.status = status; } }
const routes = load('app/api/estado-resultados/route.ts', {
  '@/lib/auth': { authOptions: {} },
  'next-auth': { getServerSession: async () => session },
  '@/lib/pl-model': model,
  '@/lib/pl-store': {
    PLStoreError: StoreError,
    canEditPL: () => editor,
    readPL: async () => ({ sections: [], groups: [], accounts: [], values: [] }),
    plRequest: async (table, query, init) => { calls.push({table, query, init}); return table === 'pl_accounts' && !init ? [{id: account}] : responseRows; },
  },
});
const account = '00000000-0000-4000-8000-000000000001';
const body = {action:'value', accountId: account, year:2026, month:1, currency:'USD', amount:'0', previous:null};
function request(value = body, origin = 'http://localhost:3000') {
  return new Request('http://localhost:3000/api/estado-resultados', {method:'POST', headers:{origin,'Content-Type':'application/json'}, body:JSON.stringify(value)});
}
test('API exige sesión, permiso de edición y origen', async () => {
  calls = []; session = null; editor = false;
  assert.equal((await routes.POST(request())).status, 401);
  session = {user:{email:'editor@example.com'}};
  assert.equal((await routes.POST(request())).status, 403);
  editor = true;
  assert.equal((await routes.POST(request(body, 'https://other.example'))).status, 403);
  assert.equal(calls.length, 0);
});
test('API rechaza importes y períodos inválidos antes de escribir', async () => {
  calls = []; session = {user:{email:'editor@example.com'}}; editor = true;
  for (const change of [{month:13},{currency:'EUR'},{amount:'NaN'},{amount:1},{previous:undefined}]) assert.equal((await routes.POST(request({...body,...change}))).status, 400);
  assert.equal(calls.length, 0);
});
test('API guarda cero con autor del servidor y detecta conflictos', async () => {
  calls = []; responseRows = [{amount:'0'}];
  assert.equal((await routes.POST(request())).status, 200);
  const payload = JSON.parse(calls[1].init.body);
  assert.equal(payload.amount, '0');
  assert.equal(payload.updated_by, 'editor@example.com');
  assert.equal(calls[1].init.method, 'POST');
  calls = []; responseRows = [];
  assert.equal((await routes.POST(request({...body,previous:'2026-09-24T00:00:00+00:00'}))).status, 409);
  assert(calls[1].query.includes('updated_at='));
});
test('API borra solo la celda y versión indicadas', async () => {
  calls = []; responseRows = [{amount:'0'}];
  assert.equal((await routes.POST(request({...body,amount:null,previous:'2026-09-24T00:00:00+00:00'}))).status, 200);
  assert.equal(calls[1].init.method, 'DELETE');
  for (const field of ['account_id','month','year','currency','updated_at']) assert(calls[1].query.includes(field + '='));
});

test('renombrar conserva identificadores y montos; restringe tablas y conflictos', async () => {
  session = {user:{email:'editor@example.com'}}; editor = true;
  for (const kind of ['accounts', 'groups', 'sections']) {
    calls = []; responseRows = [{id:account,name:'Nuevo nombre'}];
    const response = await routes.POST(request({action:'rename',kind,id:account,previousName:'Anterior',name:' Nuevo nombre '}));
    assert.equal(response.status, 200);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].table, 'pl_' + kind);
    assert.equal(calls[0].init.method, 'PATCH');
    assert.deepEqual(JSON.parse(calls[0].init.body), {name:'Nuevo nombre'});
    assert.equal(new URLSearchParams(calls[0].query).get('name'), 'eq.Anterior');
  }
  for (const change of [{kind:'pl_monthly_values'}, {kind:'__proto__'}, {name:'   '}, {name:'x'.repeat(201)}]) {
    assert.equal((await routes.POST(request({action:'rename',kind:'accounts',id:account,previousName:'Anterior',name:'Nuevo',...change}))).status,400);
  }
  responseRows = [];
  assert.equal((await routes.POST(request({action:'rename',kind:'accounts',id:account,previousName:'Anterior',name:'Nuevo'}))).status,409);
  editor = false;
  assert.equal((await routes.POST(request({action:'rename',kind:'accounts',id:account,previousName:'Anterior',name:'Nuevo'}))).status,403);
});

test('eliminación revisa todos los períodos y archivo conserva importes', async () => {
  session = {user:{email:'editor@example.com'}}; editor = true;
  calls = []; responseRows = [{id:account}];
  assert.equal((await routes.POST(request({action:'delete-account',id:account}))).status,409);
  assert.equal(calls.length,2);
  assert.equal(calls[1].table,'pl_monthly_values');
  assert(!calls[1].query.includes('year='));
  assert(!calls[1].query.includes('currency='));
  calls = [];
  assert.equal((await routes.POST(request({action:'archive-account',id:account}))).status,200);
  assert.equal(calls[2].table,'pl_accounts');
  assert.equal(calls[2].init.method,'PATCH');
  assert.deepEqual(JSON.parse(calls[2].init.body),{active:false});
  calls = []; editor = false;
  assert.equal((await routes.POST(request({action:'delete-account',id:account}))).status,403);
  assert.equal(calls.length,0);
});

test('reordenar modifica solo sort_order y rechaza otro nivel', async () => {
  const target = '00000000-0000-4000-8000-000000000002';
  const writes = [];
  const api = load('app/api/estado-resultados/route.ts', {
    '@/lib/auth': {authOptions:{}}, 'next-auth': {getServerSession:async()=>({user:{email:'editor@example.com'}})},
    '@/lib/pl-model':model,
    '@/lib/pl-store':{canEditPL:()=>true,PLStoreError:StoreError,plRequest:async(table,query,init)=>{
      if(init) {writes.push({table,query,body:JSON.parse(init.body)});return [];}
      if(query.startsWith('select=*&id=')) return [{id:account,sort_order:10,group_id:target}];
      return [{id:account,sort_order:10},{id:target,sort_order:20}];
    }},
  });
  const response=await api.POST(request({action:'reorder',kind:'accounts',id:account,targetId:target,position:'after'}));
  assert.equal(response.status,200);
  assert.deepEqual((await response.json()).order.map(x=>x.id),[target,account]);
  assert.equal(writes.length,2);
  for(const write of writes){assert.equal(write.table,'pl_accounts');assert.deepEqual(Object.keys(write.body),['sort_order']);assert(write.query.includes('group_id='));}
  assert.equal((await api.POST(request({action:'reorder',kind:'accounts',id:account,targetId:'00000000-0000-4000-8000-000000000003',position:'before'}))).status,400);
});
