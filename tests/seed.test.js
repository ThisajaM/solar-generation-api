const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const { execFile, spawn } = require('child_process');
const { promisify } = require('util');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const run = promisify(execFile);
let mongod;
let connection;
let server;
let out;
let uri;
const root = path.resolve(__dirname, '..');

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  uri = mongod.getUri('slsea_seed_test');
  connection = await mongoose.createConnection(uri).asPromise();
  out = await fs.mkdtemp(path.join(os.tmpdir(), 'slsea-export-'));
});
afterAll(async () => {
  if (server && server.exitCode === null) {
    await new Promise(resolve => { server.once('exit', resolve); server.kill('SIGTERM'); });
  }
  if (connection) await connection.close();
  if (mongod) await mongod.stop();
  if (out) await fs.rm(out, { recursive: true, force: true });
});

function env() {
  return { ...process.env, NODE_ENV: 'development', MONGODB_URI: uri, MONGODB_TEST_URI: '', JWT_SECRET: 'isolated-test-only-secret', SEED_CONFIRM: 'yes', SEED_END: '2026-09-26T18:15:00Z' };
}

test('full seed, referential integrity, realistic intervals, BSON export/import and production HTTP startup', async () => {
  const seed = await run('npm', ['run', 'seed'], { cwd: root, env: env(), maxBuffer: 1024 * 1024 });
  expect(seed.stdout).toContain('Readings: 134400');
  const db = connection.db;
  const counts = { provinces: 9, districts: 25, substations: 27, solarinstallations: 200, generationreadings: 134400, users: 227 };
  for (const [name, count] of Object.entries(counts)) expect(await db.collection(name).countDocuments()).toBe(count);
  for (const [child, field, parent] of [['districts', 'province', 'provinces'], ['substations', 'district', 'districts'], ['solarinstallations', 'substation', 'substations'], ['generationreadings', 'installation', 'solarinstallations']]) {
    const orphans = await db.collection(child).aggregate([{ $lookup: { from: parent, localField: field, foreignField: '_id', as: 'parent' } }, { $match: { parent: { $size: 0 } } }, { $count: 'count' }]).toArray();
    expect(orphans).toEqual([]);
  }
  const distribution = await db.collection('generationreadings').aggregate([{ $group: { _id: '$installation', n: { $sum: 1 } } }]).toArray();
  expect(distribution).toHaveLength(200);
  expect(distribution.every(row => row.n === 672)).toBe(true);
  const firstInstallation = await db.collection('solarinstallations').findOne({ code: 'INST-00001' });
  const records = await db.collection('generationreadings').find({ installation: firstInstallation._id }).sort({ timestamp: 1 }).toArray();
  const { colomboHourDecimal } = require('../src/utils/sriLankaTime');
  for (let i = 0; i < records.length; i++) {
    const row = records[i];
    const hour = colomboHourDecimal(row.timestamp);
    if (hour < 6 || hour > 18.25) expect(row.powerKw).toBe(0);
    expect(row.powerKw).toBeLessThanOrEqual(firstInstallation.capacityKw);
    if (i) {
      expect(row.timestamp - records[i - 1].timestamp).toBe(900000);
      expect(row.cumulativeEnergyKwh).toBeGreaterThanOrEqual(records[i - 1].cumulativeEnergyKwh);
    }
  }
  const reseed = await run('npm', ['run', 'seed'], { cwd: root, env: env(), maxBuffer: 1024 * 1024 });
  expect(reseed.stdout).toContain('Readings: 134400');
  const regeneratedInstallation = await db.collection('solarinstallations').findOne({ code: 'INST-00001' });
  const regeneratedRecords = await db.collection('generationreadings').find({ installation: regeneratedInstallation._id }).sort({ timestamp: 1 }).toArray();
  expect(regeneratedRecords.map(r => [r.timestamp, r.powerKw, r.cumulativeEnergyKwh, r.voltage])).toEqual(records.map(r => [r.timestamp, r.powerKw, r.cumulativeEnergyKwh, r.voltage]));
  const exported = await run(process.execPath, [path.join(root, 'scripts/export-seed.js')], { cwd: out, env: env(), maxBuffer: 1024 * 1024 });
  expect(exported.stdout).toContain('Exported 134400 MongoDB documents');
  const imported = connection.useDb('slsea_import_test').db;
  const { EJSON } = mongoose.mongo.BSON;
  for (const name of Object.keys(counts)) {
    const docs = EJSON.parse(await fs.readFile(path.join(out, 'seed-output', `${name}.json`), 'utf8'));
    for (let offset = 0; offset < docs.length; offset += 2000) await imported.collection(name).insertMany(docs.slice(offset, offset + 2000));
    expect(await imported.collection(name).countDocuments()).toBe(counts[name]);
  }
  const restored = await imported.collection('generationreadings').findOne({ installation: regeneratedInstallation._id });
  expect(restored.timestamp).toBeInstanceOf(Date);
  expect(restored.installation.toHexString()).toBe(regeneratedInstallation._id.toHexString());
  await expect(run('npm', ['run', 'seed'], { cwd: root, env: { ...env(), SEED_CONFIRM: 'no' } })).rejects.toThrow();
  expect(await db.collection('generationreadings').countDocuments()).toBe(134400);
  const indexes = await run('npm', ['run', 'indexes'], { cwd: root, env: { ...env(), MONGODB_URI: mongod.getUri('slsea_import_test') } });
  expect(indexes.stdout).toContain('Indexes ready: generationreadings');
  const port = await new Promise((resolve, reject) => {
    server = spawn(process.execPath, ['src/server.js'], { cwd: root, env: { ...env(), NODE_ENV: 'production', PORT: '0' }, stdio: ['ignore', 'pipe', 'pipe'] });
    server.once('error', reject);
    server.once('exit', code => reject(new Error(`Startup exited ${code}`)));
    server.stdout.on('data', chunk => {
      const match = String(chunk).match(/port (\d+)/);
      if (match) resolve(Number(match[1]));
    });
  });
  const base = `http://127.0.0.1:${port}`;
  const health = await fetch(`${base}/health`);
  expect(health.status).toBe(200);
  expect((await health.json()).database).toBe('connected');
  const login = await fetch(`${base}/api/v1/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'admin@example.test', password: 'Admin@12345' }) });
  expect(login.status).toBe(200);
  const token = (await login.json()).data.token;
  const response = await fetch(`${base}/api/v1/readings?limit=1`, { headers: { Authorization: `Bearer ${token}` } });
  expect(response.status).toBe(200);
  expect((await response.json()).meta.total).toBe(134400);
  expect((await fetch(`${base}/docs/swagger-ui-bundle.js`)).status).toBe(200);
}, 180000);
