const fs = require('fs');
const assert = require('assert/strict');
let base = process.argv[2];
let server;
let currentCheck = 'startup';
const results = [];
const seed = fs.readFileSync('scripts/seed.js', 'utf8');
// Read only the explicitly fictional seed-account passwords in memory; never print them.
const passwords = [...seed.matchAll(/passwordHash\('([^']+)'\)/g)].map(match => match[1]);
async function call(path, token, options = {}) {
  const response = await fetch(base + path, { ...options, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers }, signal: AbortSignal.timeout(30000) });
  const text = await response.text();
  let body;
  try { body = JSON.parse(text); } catch { body = null; }
  return { status: response.status, headers: response.headers, body, text };
}
async function check(name, fn) {
  currentCheck = name;
  await fn(); results.push({ check: name, passed: true }); console.log(`PASS: ${name}`);
}
async function login(email, password) {
  const r = await call('/api/v1/auth/login', null, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
  assert.equal(r.status, 200); assert.ok(r.body.data.token); return r.body.data.token;
}
(async () => {
  if (base === '--local') {
    const app = require('../src/app');
    server = await new Promise(resolve => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)); });
    base = `http://127.0.0.1:${server.address().port}`;
  } else {
    const target = new URL(base);
    if (target.protocol !== 'https:' || target.username || target.password || target.search || target.hash ||
        !(target.hostname === 'project-n8zne.vercel.app' || /^slsea-solar-generation-[a-z0-9-]+-thisajams-projects\.vercel\.app$/.test(target.hostname))) {
      throw new Error('Use the authorized coursework deployment host');
    }
    base = target.origin;
  }
  await check('Health confirms MongoDB connection', async () => { const r=await call('/health'); assert.equal(r.status,200); assert.equal(r.body.database,'connected'); });
  await check('Swagger and OpenAPI load', async () => { for (const path of ['/docs/','/docs/swagger-ui-bundle.js','/openapi.json']) { const r=await call(path); assert.equal(r.status,200); if(path==='/openapi.json') assert.equal(r.body.openapi,'3.0.3'); } });
  await check('Missing bearer token is rejected', async () => { assert.equal((await call('/api/v1/provinces')).status,401); });
  let national, province, district, device;
  await check('All four demo roles can log in', async () => {
    national = await login('admin@example.test', passwords[0]);
    province = await login('analyst.western@example.test', passwords[1]);
    district = await login('analyst.cmb@example.test', passwords[2]);
    device = await login('device00001@devices.example.test', passwords[3]);
  });
  const collections = {};
  await check('Live collection counts: 9 provinces, 25 districts, 27 substations, 200 installations, 134400 readings', async () => {
    for (const [name, expected] of Object.entries({ provinces:9, districts:25, substations:27, installations:200, readings:134400 })) {
      const r = await call(`/api/v1/${name}?limit=100`, national);
      assert.equal(r.status, 200); assert.equal(r.body.meta.total, expected); collections[name] = r.body;
    }
  });
  const own = collections.installations.data.find(i => i.code === 'INST-00001');
  const colombo = collections.districts.data.find(d => d.code === 'CMB');
  const foreign = collections.districts.data.find(d => d.code === 'BAT');
  await check('District/province scope and forbidden foreign district', async () => {
    const r = await call(`/api/v1/districts/${foreign.id}`, district); assert.equal(r.status, 403);
    const p = await call('/api/v1/provinces', province); assert.equal(p.body.meta.total, 1);
    const d = await call('/api/v1/districts', district); assert.equal(d.body.meta.total, 1);
    const hidden = await call(`/api/v1/readings?districtId=${foreign.id}`, district); assert.equal(hidden.body.meta.total, 0);
  });
  await check('Device own composite and latest reading', async () => {
    for (const suffix of ['composite','last-reading']) assert.equal((await call(`/api/v1/installations/${own.id}/${suffix}`, device)).status, 200);
  });
  await check('672 own readings, pagination, timestamp sorting and time filter', async () => {
    const history = await call(`/api/v1/installations/${own.id}/readings?limit=2&sort=timestamp`, device);
    assert.equal(history.status,200); assert.equal(history.body.meta.total,672); assert.ok(history.body.links.next);
    const [a,b] = history.body.data; assert.ok(a.timestamp < b.timestamp);
    const filtered = await call(`/api/v1/installations/${own.id}/readings?from=${encodeURIComponent(a.timestamp)}&to=${encodeURIComponent(b.timestamp)}`,national);
    assert.equal(filtered.body.meta.total,2);
  });
  await check('ETag, Last-Modified, bodyless 304 and failed precondition 412', async () => {
    const path = `/api/v1/districts/${colombo.id}`;
    const r = await call(path,national); assert.ok(r.headers.get('last-modified'));
    const cached = await call(path,national,{headers:{'If-None-Match':r.headers.get('etag')}});
    assert.equal(cached.status,304); assert.equal(cached.text,'');
    assert.equal((await call(path,national,{headers:{'If-Match':'"mismatch"'}})).status,412);
  });
  await check('District summary and public noncredentialed CORS', async () => {
    const r = await call(`/api/v1/districts/${colombo.id}/generation-summary`,district);
    assert.equal(r.status,200); assert.ok(r.body.data.summary.installationCount > 0);
    const cors = await call('/api/v1/provinces',null,{method:'OPTIONS',headers:{Origin:'https://assessment.example.test','Access-Control-Request-Method':'GET','Access-Control-Request-Headers':'authorization'}});
    assert.equal(cors.status,204); assert.equal(cors.headers.get('access-control-allow-origin'),'*'); assert.equal(cors.headers.get('access-control-allow-credentials'),null);
  });
  await check('Hierarchy atomic and nested resources are reachable', async () => {
    const provinceId=collections.provinces.data[0].id;
    const substationId=own.substation;
    for(const path of [`/provinces/${provinceId}`,`/provinces/${provinceId}/districts`, `/districts/${colombo.id}/substations`, `/substations/${substationId}`, `/substations/${substationId}/installations`, `/installations/${own.id}`]) assert.equal((await call('/api/v1'+path,national)).status,200);
  });
  await check('Write authorization and invalid input preserve database', async () => {
    const headers={'Content-Type':'application/json'};
    const path=`/api/v1/installations/${own.id}/readings`;
    assert.equal((await call(path,national,{method:'POST',headers,body:'{}'})).status,403);
    const other=collections.installations.data.find(i=>i.id!==own.id);
    assert.equal((await call(`/api/v1/installations/${other.id}/readings`,device,{method:'POST',headers,body:'{}'})).status,403);
    assert.equal((await call(path,device,{method:'POST',headers,body:'{}'})).status,400);
    const old=(await call(path+'?limit=1',device)).body.data[0];
    const input=Object.fromEntries(['timestamp','powerKw','cumulativeEnergyKwh','voltage','frequencyHz'].map(k=>[k,old[k]]));
    assert.equal((await call(path,device,{method:'POST',headers,body:JSON.stringify(input)})).status,409);
    assert.equal((await call(`${path}/${old.id}`,device)).status,200);
    for(const method of ['PUT','PATCH','DELETE']) assert.equal((await call(`${path}/${old.id}`,device,{method,headers,body:method==='DELETE'?undefined:'{}'})).status,404);
  });
  await check('Validation and consistent client errors', async () => {
    for(const [path,status,headers] of [['/api/v1/readings?limit=0',400,{}],['/api/v1/provinces/invalid',400,{}],['/api/v1/provinces',406,{Accept:'text/plain'}]]) {
      const r=await call(path,national,{headers}); assert.equal(r.status,status); assert.ok(r.body.error.code); assert.ok(r.body.error.message); assert.ok('detail' in r.body.error);
    }
  });
  await check('Readings count remains exactly 134400',async()=>{assert.equal((await call('/api/v1/readings?limit=1',national)).body.meta.total,134400);});
  const report = {verifiedAt:new Date().toISOString(),baseUrl:base,preservesData:true,results};
  const output = process.argv[3];
  if(output) fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
})().catch(() => { console.error(`Smoke verification failed at: ${currentCheck}. Credential and response details suppressed.`); process.exitCode=1; }).finally(async()=>{
  if(server) { await new Promise(resolve=>server.close(resolve)); await require('../src/config/database').disconnectDatabase(); }
});
