const { spawn } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const assert = require('assert/strict');
const password = crypto.randomBytes(24).toString('hex');
const child = spawn(process.execPath, ['scripts/demo.js'], { env: { ...process.env, DEMO_ADMIN_PASSWORD: password, DEMO_PORT: '0' }, stdio: ['ignore', 'pipe', 'pipe'] });
const checks = [];
let phase = 'isolated startup';
const closed = new Promise(resolve => child.once('close', resolve));
(async () => {
  const base = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Demo startup timeout')), 90000);
    let output = '';
    child.stdout.on('data', chunk => { output += chunk; const match = output.match(/ISOLATED SYNTHETIC DEMO: (http:\/\/127\.0\.0\.1:\d+)/); if (match) { clearTimeout(timer); resolve(match[1]); } });
    child.stderr.on('data', () => {});
    child.once('error', () => { clearTimeout(timer); reject(new Error('Demo startup failed')); });
    child.once('exit', () => { clearTimeout(timer); reject(new Error('Demo exited')); });
  });
  async function call(path, token, method='GET', body) {
    const res = await fetch(base + path, { method, headers: { ...(token && { Authorization: `Bearer ${token}` }), ...(body && { 'Content-Type': 'application/json' }) }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(30000) });
    const text = await res.text(); let data; try { data = JSON.parse(text); } catch { data = null; }
    return { status: res.status, data, location: res.headers.get('location') };
  }
  phase = 'Swagger'; assert.equal((await call('/docs/')).status, 200);
  const spec = await call('/openapi.json'); assert.ok(spec.data.paths['/api/v1/installations/{installationId}'].delete); checks.push('Swagger CRUD documentation');
  phase = 'administrator login'; const login = await call('/api/v1/auth/login', null, 'POST', { email: 'installation-admin@example.test', password }); assert.equal(login.status, 200); const token = login.data.data.token; checks.push('Private demo administrator login');
  phase = 'CRUD'; const stations = await call('/api/v1/substations?limit=1', token);
  const made = await call('/api/v1/installations', token, 'POST', { name: 'Swagger verification', code: 'SWAGGER-VERIFY', meterId: 'SWAGGER-VERIFY', capacityKw: 12, latitude: 7, longitude: 80, substation: stations.data.data[0].id }); assert.equal(made.status, 201); assert.ok(made.location);
  assert.equal((await call(made.location, token)).status, 200);
  assert.equal((await call('/api/v1/installations?search=SWAGGER-VERIFY', token)).data.meta.total, 1);
  const changed = await call(made.location, token, 'PATCH', { capacityKw: 15 }); assert.equal(changed.status, 200); assert.equal(changed.data.data.capacityKw, 15);
  assert.equal((await call(made.location, token, 'DELETE')).status, 204); assert.equal((await call(made.location, token, 'DELETE')).status, 204);
  assert.equal((await call('/api/v1/installations?search=SWAGGER-VERIFY', token)).data.meta.total, 0); checks.push('Create, list, retrieve, PATCH, repeated archive');
  phase = 'historical report'; const history = await call('/api/v1/generation-summary?mode=historical&date=2026-10-02', token); assert.equal(history.status, 200); assert.equal(history.data.data.summary.energyQuality.isComplete, false); // Newly created archived site has no history.
  assert.ok(history.data.data.summary.energyKwh > 0); checks.push('Historical seed report with explicit mixed coverage');
  phase = 'snapshot'; const snapshot = await call('/api/v1/readings?pagination=snapshot&limit=2', token); assert.equal(snapshot.status, 200); assert.equal(snapshot.data.meta.total, 134400); checks.push('Full-size fixed reading snapshot');
  fs.writeFileSync('report/evidence/FINALIZATION-DEMO-VERIFICATION.json', JSON.stringify({ verifiedAt: new Date().toISOString(), environment: 'Disposable synthetic local replica set; no Atlas access', checks: checks.map(check => ({ check, passed: true })) }, null, 2) + '\n');
  console.log(`Isolated Swagger demonstration passed: ${checks.length} groups; credentials suppressed.`);
})().catch(() => { console.error(`Isolated demonstration failed at ${phase}; details suppressed.`); process.exitCode = 1; }).finally(async () => { if (child.exitCode === null) child.kill('SIGTERM'); await closed; });
