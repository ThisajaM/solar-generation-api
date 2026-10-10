const bcrypt = require('bcryptjs');
const request = require('supertest');
const { MongoMemoryReplSet } = require('mongodb-memory-server');

const Province = require('../src/models/Province');
const District = require('../src/models/District');
const Substation = require('../src/models/Substation');
const SolarInstallation = require('../src/models/SolarInstallation');
const GenerationReading = require('../src/models/GenerationReading');
const User = require('../src/models/User');

let app;
let mongod;
let ids = {};
let tokens = {};

function auth(token) {
  return { Authorization: `Bearer ${token}` };
}

async function login(email, password) {
  const res = await request(app).post('/api/v1/auth/login').send({ email, password });
  return res.body.data.token;
}

beforeAll(async () => {
  mongod = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  process.env.MONGODB_TEST_URI = mongod.getUri('slsea_test');
  app = require('../api/index');
  const { connectDatabase } = require('../src/config/database');
  await connectDatabase();
  await Promise.all([Province, District, Substation, SolarInstallation, GenerationReading, User].map(model => model.init()));

  const wp = await Province.create({ name: 'Western', code: 'WP' });
  const ep = await Province.create({ name: 'Eastern', code: 'EP' });
  const colombo = await District.create({ name: 'Colombo', code: 'CMB', province: wp._id });
  const batticaloa = await District.create({ name: 'Batticaloa', code: 'BAT', province: ep._id });
  const gs1 = await Substation.create({ name: 'Colombo GS 01', code: 'GS001', district: colombo._id });
  const gs2 = await Substation.create({ name: 'Batticaloa GS 01', code: 'GS002', district: batticaloa._id });
  const instA = await SolarInstallation.create({
    code: 'INST-00001',
    name: 'Site A',
    meterId: 'MTR-1',
    capacityKw: 10,
    latitude: 6.9,
    longitude: 79.8,
    substation: gs1._id,
    status: 'active'
  });
  const instB = await SolarInstallation.create({
    code: 'INST-00002',
    name: 'Site B',
    inverterId: 'INV-2',
    capacityKw: 8,
    latitude: 7.7,
    longitude: 81.7,
    substation: gs2._id,
    status: 'active'
  });

  const now = new Date('2026-09-26T06:00:00.000Z');
  await GenerationReading.insertMany([
    { installation: instA._id, timestamp: new Date(now.getTime() - 30 * 60000), powerKw: 4, cumulativeEnergyKwh: 100, voltage: 230, frequencyHz: 50 },
    { installation: instA._id, timestamp: new Date(now.getTime() - 15 * 60000), powerKw: 6, cumulativeEnergyKwh: 101.5, voltage: 231, frequencyHz: 50 },
    { installation: instA._id, timestamp: now, powerKw: 8, cumulativeEnergyKwh: 103.5, voltage: 232, frequencyHz: 50 },
    { installation: instB._id, timestamp: now, powerKw: 5, cumulativeEnergyKwh: 50, voltage: 229, frequencyHz: 50 }
  ]);

  const hash = (p) => bcrypt.hashSync(p, 4);
  await User.insertMany([
    { name: 'National', email: 'admin@slsea.gov.lk', passwordHash: hash('Admin@12345'), role: 'national-analyst', scope: 'national', scopes: ['analyst-read'] },
    { name: 'Western', email: 'analyst.western@slsea.gov.lk', passwordHash: hash('Analyst@12345'), role: 'province-analyst', scope: 'province', province: wp._id, scopes: ['analyst-read'] },
    { name: 'Colombo', email: 'analyst.cmb@slsea.gov.lk', passwordHash: hash('District@12345'), role: 'district-analyst', scope: 'district', district: colombo._id, scopes: ['analyst-read'] },
    { name: 'Device A', email: 'device00001@devices.slsea.gov.lk', passwordHash: hash('Device@12345'), role: 'device', scope: 'installation', installation: instA._id, scopes: ['installation-write'] },
    { name: 'Device B', email: 'device00002@devices.slsea.gov.lk', passwordHash: hash('Device@12345'), role: 'device', scope: 'installation', installation: instB._id, scopes: ['installation-write'] }
  ]);

  ids = {
    wp: wp._id.toString(),
    ep: ep._id.toString(),
    colombo: colombo._id.toString(),
    batticaloa: batticaloa._id.toString(),
    gs1: gs1._id.toString(),
    gs2: gs2._id.toString(),
    instA: instA._id.toString(),
    instB: instB._id.toString()
  };

  tokens.national = await login('admin@slsea.gov.lk', 'Admin@12345');
  tokens.province = await login('analyst.western@slsea.gov.lk', 'Analyst@12345');
  tokens.district = await login('analyst.cmb@slsea.gov.lk', 'District@12345');
  tokens.deviceA = await login('device00001@devices.slsea.gov.lk', 'Device@12345');
  tokens.deviceB = await login('device00002@devices.slsea.gov.lk', 'Device@12345');
});

afterAll(async () => {
  const { disconnectDatabase } = require('../src/config/database');
  await disconnectDatabase();
  if (mongod) await mongod.stop();
});

describe('health and docs', () => {
  test('GET /health', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.database).toBe('connected');
    expect(res.body.version).toBe('1.0.0');
  });

  test('GET /docs', async () => {
    const res = await request(app).get('/docs/');
    expect(res.status).toBe(200);
    expect(res.text).toMatch(/swagger/i);
  });
});

describe('authentication', () => {
  test('login issues JWT', async () => {
    expect(tokens.national).toBeTruthy();
  });

  test('wrong password is 401', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({ email: 'admin@slsea.gov.lk', password: 'nope' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  test('missing bearer is 401', async () => {
    const res = await request(app).get('/api/v1/provinces');
    expect(res.status).toBe(401);
  });
});

describe('geography and authorization', () => {
  test('national lists both provinces', async () => {
    const res = await request(app).get('/api/v1/provinces').set(auth(tokens.national));
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.headers.etag).toBeTruthy();
    expect(res.headers['last-modified']).toBeTruthy();
  });

  test('If-None-Match returns 304 with empty body', async () => {
    const first = await request(app).get(`/api/v1/provinces/${ids.wp}`).set(auth(tokens.national));
    const res = await request(app).get(`/api/v1/provinces/${ids.wp}`).set(auth(tokens.national)).set('If-None-Match', first.headers.etag);
    expect(res.status).toBe(304);
    expect(res.text).toBe('');
  });

  test('district cannot read another district', async () => {
    const res = await request(app).get(`/api/v1/districts/${ids.batticaloa}`).set(auth(tokens.district));
    expect(res.status).toBe(403);
  });

  test('district list in Western only returns Colombo', async () => {
    const res = await request(app).get(`/api/v1/provinces/${ids.wp}/districts`).set(auth(tokens.district));
    expect(res.status).toBe(200);
    expect(res.body.data.map(d => d.code)).toEqual(['CMB']);
  });

  test('province cannot read Eastern installation', async () => {
    const res = await request(app).get(`/api/v1/installations/${ids.instB}`).set(auth(tokens.province));
    expect(res.status).toBe(403);
  });

  test('national reads installation, composite, last-reading', async () => {
    const one = await request(app).get(`/api/v1/installations/${ids.instA}`).set(auth(tokens.national));
    expect(one.status).toBe(200);
    const composite = await request(app).get(`/api/v1/installations/${ids.instA}/composite`).set(auth(tokens.national));
    expect(composite.status).toBe(200);
    expect(composite.body.data.province.code).toBe('WP');
    expect(composite.body.data.latestReading.powerKw).toBe(8);
    const last = await request(app).get(`/api/v1/installations/${ids.instA}/last-reading`).set(auth(tokens.national));
    expect(last.status).toBe(200);
    expect(last.body.data.powerKw).toBe(8);
  });

  test('invalid ObjectId is 400', async () => {
    const res = await request(app).get('/api/v1/provinces/not-an-id').set(auth(tokens.national));
    expect(res.status).toBe(400);
  });

  test('missing province is 404', async () => {
    const res = await request(app).get('/api/v1/provinces/aaaaaaaaaaaaaaaaaaaaaaaa').set(auth(tokens.national));
    expect(res.status).toBe(404);
  });
});

describe('readings', () => {
  test('pagination, sorting and time window', async () => {
    const desc = await request(app).get(`/api/v1/installations/${ids.instA}/readings?sort=-timestamp&limit=2&page=1`).set(auth(tokens.national));
    expect(desc.status).toBe(200);
    expect(desc.body.meta.total).toBe(3);
    expect(desc.body.meta.pages).toBe(2);
    expect(desc.body.links.next).toBeTruthy();
    expect(desc.body.links.previous).toBeNull();
    expect(new Date(desc.body.data[0].timestamp).getTime()).toBeGreaterThan(new Date(desc.body.data[1].timestamp).getTime());

    const asc = await request(app).get(`/api/v1/installations/${ids.instA}/readings?sort=timestamp`).set(auth(tokens.national));
    expect(asc.status).toBe(200);
    expect(new Date(asc.body.data[0].timestamp).getTime()).toBeLessThan(new Date(asc.body.data[1].timestamp).getTime());

    const windowed = await request(app)
      .get(`/api/v1/installations/${ids.instA}/readings?from=2026-09-26T05:50:00.000Z&to=2026-09-26T06:10:00.000Z`)
      .set(auth(tokens.national));
    expect(windowed.status).toBe(200);
    expect(windowed.body.meta.total).toBe(1);
  });

  test('from later than to is 400', async () => {
    const res = await request(app)
      .get(`/api/v1/installations/${ids.instA}/readings?from=2026-09-27T00:00:00.000Z&to=2026-09-26T00:00:00.000Z`)
      .set(auth(tokens.national));
    expect(res.status).toBe(400);
  });

  test('invalid limit is 400', async () => {
    const res = await request(app).get(`/api/v1/installations/${ids.instA}/readings?limit=500`).set(auth(tokens.national));
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_PARAMETER');
  });

  test('district cannot filter to another district', async () => {
    const res = await request(app)
      .get(`/api/v1/installations/${ids.instA}/readings?districtId=${ids.batticaloa}`)
      .set(auth(tokens.district));
    expect(res.status).toBe(403);
  });

  test('device posts reading with 201 Location', async () => {
    const res = await request(app)
      .post(`/api/v1/installations/${ids.instA}/readings`)
      .set(auth(tokens.deviceA))
      .send({ timestamp: '2026-09-26T06:15:00.000Z', powerKw: 7.5, cumulativeEnergyKwh: 105, voltage: 230 });
    expect(res.status).toBe(201);
    expect(res.headers.location).toMatch(new RegExp(`/api/v1/installations/${ids.instA}/readings/[a-f0-9]{24}$`));
  });

  test('device cannot write to another installation', async () => {
    const res = await request(app)
      .post(`/api/v1/installations/${ids.instB}/readings`)
      .set(auth(tokens.deviceA))
      .send({ timestamp: '2026-09-26T06:15:00.000Z', powerKw: 1, cumulativeEnergyKwh: 1, voltage: 230 });
    expect(res.status).toBe(403);
  });

  test('analyst cannot post readings', async () => {
    const res = await request(app)
      .post(`/api/v1/installations/${ids.instA}/readings`)
      .set(auth(tokens.national))
      .send({ timestamp: '2026-09-26T06:30:00.000Z', powerKw: 1, cumulativeEnergyKwh: 1, voltage: 230 });
    expect(res.status).toBe(403);
  });

  test('duplicate timestamp is 409', async () => {
    const res = await request(app)
      .post(`/api/v1/installations/${ids.instA}/readings`)
      .set(auth(tokens.deviceA))
      .send({ timestamp: '2026-09-26T06:15:00.000Z', powerKw: 7.5, cumulativeEnergyKwh: 105, voltage: 230 });
    expect(res.status).toBe(409);
  });

  test('negative power is 400', async () => {
    const res = await request(app)
      .post(`/api/v1/installations/${ids.instA}/readings`)
      .set(auth(tokens.deviceA))
      .send({ timestamp: '2026-09-26T07:00:00.000Z', powerKw: -1, cumulativeEnergyKwh: 1, voltage: 230 });
    expect(res.status).toBe(400);
  });
});

describe('district summary', () => {
  test('aggregates installations in Colombo', async () => {
    const res = await request(app).get(`/api/v1/districts/${ids.colombo}/generation-summary`).set(auth(tokens.national));
    expect(res.status).toBe(200);
    expect(res.body.data.summary.installationCount).toBe(1);
    expect(res.body.data.summary.currentPowerKw).toBe(0);
    expect(res.body.data.summary.lastKnownPowerKw).toBeGreaterThan(0);
    expect(res.body.data.summary.powerQuality.staleInstallations).toBe(1);
  });

  test('district analyst cannot summarise Batticaloa', async () => {
    const res = await request(app).get(`/api/v1/districts/${ids.batticaloa}/generation-summary`).set(auth(tokens.district));
    expect(res.status).toBe(403);
  });
});

describe('content negotiation', () => {
  test('unsupported Accept is 406', async () => {
    const res = await request(app).get('/api/v1/provinces').set(auth(tokens.national)).set('Accept', 'application/xml');
    expect(res.status).toBe(406);
  });
});

describe('regressions and security boundaries', () => {
  test.each(['readings', 'last-reading', 'composite'])('owning device can GET %s', async suffix => {
    const res = await request(app).get(`/api/v1/installations/${ids.instA}/${suffix}`).set(auth(tokens.deviceA));
    expect(res.status).toBe(200);
  });
  test.each(['readings', 'last-reading', 'composite'])('district and device cannot GET foreign %s', async suffix => {
    for (const token of [tokens.district, tokens.province, tokens.deviceA]) {
      const res = await request(app).get(`/api/v1/installations/${ids.instB}/${suffix}`).set(auth(token));
      expect(res.status).toBe(403);
    }
  });
  test.each(['districts', 'substations', 'installations', 'readings'])('top-level %s intersects jurisdiction', async resource => {
    const national = await request(app).get(`/api/v1/${resource}`).set(auth(tokens.national));
    expect(national.status).toBe(200);
    expect(national.body.meta.total).toBeGreaterThan(1);
    const scoped = await request(app).get(`/api/v1/${resource}?provinceId=${ids.ep}`).set(auth(tokens.district));
    expect(scoped.status).toBe(200);
    expect(scoped.body.meta.total).toBe(0);
    expect(scoped.body.data).toEqual([]);
    const denied = await request(app).get(`/api/v1/${resource}`).set(auth(tokens.deviceA));
    expect(denied.status).toBe(403);
  });
  test('all hierarchy retrieval paths work and foreign nested paths are denied', async () => {
    const ownPaths = [`districts/${ids.colombo}`, `districts/${ids.colombo}/substations`, `substations/${ids.gs1}`, `substations/${ids.gs1}/installations`];
    for (const path of ownPaths) expect((await request(app).get(`/api/v1/${path}`).set(auth(tokens.district))).status).toBe(200);
    for (const path of [`districts/${ids.batticaloa}/substations`, `substations/${ids.gs2}`, `substations/${ids.gs2}/installations`]) {
      expect((await request(app).get(`/api/v1/${path}`).set(auth(tokens.district))).status).toBe(403);
    }
  });
  test.each(['page=0', 'page=1.5', 'page=1e2', 'page=9007199254740992', 'limit=', 'page=1&page=2', 'sort=powerKw', 'sort=timestamp&sort=timestamp', 'from=2026-02-30T00:00:00Z', 'from=2026-09-26', 'from=09/26/2026', 'to=bad', 'from=', 'provinceId=bad', 'districtId=', 'substationId[$ne]=x', 'unknown=x'])('rejects query %s', async query => {
    const res = await request(app).get(`/api/v1/installations/${ids.instA}/readings?${query}`).set(auth(tokens.national));
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBeTruthy();
  });
  test('empty and beyond-last pages preserve envelope and links', async () => {
    const beyond = await request(app).get(`/api/v1/installations/${ids.instA}/readings?page=999&limit=2`).set(auth(tokens.national));
    expect(beyond.status).toBe(200);
    expect(beyond.body.data).toEqual([]);
    expect(beyond.body.meta.total).toBe(4);
    expect(beyond.body.links.next).toBeNull();
    expect(beyond.body.links.self).toContain('page=999');
    const empty = await request(app).get(`/api/v1/installations/${ids.instA}/readings?from=2099-01-01T00:00:00Z`).set(auth(tokens.national));
    expect(empty.body.meta.pages).toBe(0);
    expect(empty.body.links.previous).toBeNull();
    const page2 = await request(app).get(`/api/v1/installations/${ids.instA}/readings?page=2&limit=2`).set(auth(tokens.national));
    expect(page2.body.links.previous).toContain('page=1');
  });
  test('combined valid jurisdiction filters return only matching data', async () => {
    const res = await request(app).get(`/api/v1/readings?provinceId=${ids.wp}&districtId=${ids.colombo}&substationId=${ids.gs1}&sort=timestamp`).set(auth(tokens.district));
    expect(res.status).toBe(200);
    expect(res.body.meta.total).toBe(4);
    expect(res.body.data.every(row => row.installation === ids.instA)).toBe(true);
  });
  test('created resource can be retrieved, but history cannot be mutated', async () => {
    const last = await request(app).get(`/api/v1/installations/${ids.instA}/last-reading`).set(auth(tokens.deviceA));
    const path = `/api/v1/installations/${ids.instA}/readings/${last.body.data.id}`;
    const before = await request(app).get(path).set(auth(tokens.deviceA));
    expect(before.status).toBe(200);
    for (const method of ['put', 'patch', 'delete']) {
      const res = await request(app)[method](path).set(auth(tokens.deviceA)).send({});
      expect([404, 405]).toContain(res.status);
    }
    const after = await request(app).get(path).set(auth(tokens.deviceA));
    expect(after.body).toEqual(before.body);
    expect((await request(app).get(path).set(auth(tokens.deviceB))).status).toBe(403);
  });
  test.each([
    { powerKw: '1' }, { powerKw: null }, { powerKw: -1 }, { cumulativeEnergyKwh: -1 }, { voltage: -1 }, { timestamp: '2026-02-30T00:00:00Z' }, { extra: true }, { frequencyHz: '50' }
  ])('rejects invalid reading fields %j', async override => {
    const res = await request(app).post(`/api/v1/installations/${ids.instA}/readings`).set(auth(tokens.deviceA)).send({ timestamp: '2026-09-26T07:00:00Z', powerKw: 1, cumulativeEnergyKwh: 106, voltage: 230, ...override });
    expect(res.status).toBe(400);
  });
  test('nonfinite numeric JSON is rejected', async () => {
    const res = await request(app).post(`/api/v1/installations/${ids.instA}/readings`).set(auth(tokens.deviceA)).set('Content-Type', 'application/json').send('{"timestamp":"2026-09-26T07:00:00Z","powerKw":1e999,"cumulativeEnergyKwh":107,"voltage":230}');
    expect(res.status).toBe(400);
  });
  test('JSON, media-type and size errors have the error envelope', async () => {
    const malformed = await request(app).post('/api/v1/auth/login').set('Content-Type', 'application/json').send('{');
    expect(malformed.status).toBe(400);
    const media = await request(app).post('/api/v1/auth/login').set('Content-Type', 'text/plain').send('hello');
    expect(media.status).toBe(415);
    const oversized = await request(app).post('/api/v1/auth/login').send({ email: 'x'.repeat(110000) });
    expect(oversized.status).toBe(413);
    for (const res of [malformed, media, oversized]) expect(res.body.error.code).toBeTruthy();
  });
  test('Accept supports wildcards and respects q=0', async () => {
    expect((await request(app).get('/api/v1/provinces').set(auth(tokens.national)).set('Accept', 'application/*')).status).toBe(200);
    expect((await request(app).get('/api/v1/provinces').set(auth(tokens.national)).set('Accept', 'application/json;q=0, */*;q=1')).status).toBe(406);
  });
  test('conditional dates, weak/list tags, precedence, and 412', async () => {
    const path = `/api/v1/provinces/${ids.wp}`;
    const first = await request(app).get(path).set(auth(tokens.national));
    for (const tag of ['*', `W/${first.headers.etag}`, `"other", ${first.headers.etag}`]) {
      const res = await request(app).get(path).set(auth(tokens.national)).set('If-None-Match', tag);
      expect(res.status).toBe(304);
      expect(res.text).toBe('');
    }
    const date = await request(app).get(path).set(auth(tokens.national)).set('If-Modified-Since', first.headers['last-modified']);
    expect(date.status).toBe(304);
    const precedence = await request(app).get(path).set(auth(tokens.national)).set('If-None-Match', '"different"').set('If-Modified-Since', 'Wed, 01 Jan 2099 00:00:00 GMT');
    expect(precedence.status).toBe(200);
    expect((await request(app).get(path).set(auth(tokens.national)).set('If-Match', '"different"')).status).toBe(412);
    expect((await request(app).get(path).set(auth(tokens.national)).set('If-Match', first.headers.etag)).status).toBe(200);
  });
  test('invalid and expired JWTs fail without leaking errors', async () => {
    const jwt = require('jsonwebtoken');
    const expired = jwt.sign({ sub: 'aaaaaaaaaaaaaaaaaaaaaaaa' }, process.env.JWT_SECRET, { expiresIn: -1 });
    for (const token of ['invalid', expired]) {
      const res = await request(app).get('/api/v1/provinces').set(auth(token));
      expect(res.status).toBe(401);
      expect(res.body.error.detail).toBeNull();
    }
  });
  test('device JWT identifies installation and has no password', () => {
    const payload = require('jsonwebtoken').decode(tokens.deviceA);
    expect(payload.installationId).toBe(ids.instA);
    expect(payload.passwordHash).toBeUndefined();
  });
  test('public Bearer-token CORS allows origins without browser credentials', async () => {
    for (const origin of ['https://example.test', 'https://assessment.example.test']) {
      const res = await request(app).options(`/api/v1/installations/${ids.instA}/readings`)
        .set('Origin', origin)
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'authorization,content-type');
      expect(res.status).toBe(204);
      expect(res.text).toBe('');
      expect(res.headers['access-control-allow-origin']).toBe('*');
      expect(res.headers['access-control-allow-credentials']).toBeUndefined();
      expect(res.headers['access-control-allow-methods']).toBe('GET,HEAD,POST,PATCH,DELETE,OPTIONS');
      expect(res.headers['access-control-allow-headers']).toContain('authorization');
      expect(res.headers['access-control-allow-headers']).toContain('content-type');
    }
    const get = await request(app).get('/api/v1/provinces')
      .set('Origin', 'https://assessment.example.test').set(auth(tokens.national));
    expect(get.status).toBe(200);
    expect(get.headers['access-control-allow-origin']).toBe('*');
    expect(get.headers['access-control-allow-credentials']).toBeUndefined();
    expect(get.headers['access-control-expose-headers']).toContain('ETag');
    expect(get.headers['cache-control']).toContain('private');
    const unauthenticated = await request(app).get('/api/v1/provinces')
      .set('Origin', 'https://assessment.example.test');
    expect(unauthenticated.status).toBe(401);
    expect(unauthenticated.headers['access-control-allow-origin']).toBe('*');
  });
  test('summary excludes stale power and cross-midnight energy, ignores future data and has stable ETag', async () => {
    const { startOfColomboDay } = require('../src/utils/sriLankaTime');
    const start = startOfColomboDay(new Date());
    const RealDate = Date;
    global.Date = class extends RealDate { constructor(...args) { super(...(args.length ? args : [+start + 7200000])); } };
    try {
    await GenerationReading.insertMany([
      { installation: ids.instA, timestamp: new Date(start.getTime() - 900000), powerKw: 0, cumulativeEnergyKwh: 200, voltage: 230 },
      { installation: ids.instA, timestamp: new Date(start.getTime() + 1), powerKw: 2, cumulativeEnergyKwh: 210, voltage: 230 },
      { installation: ids.instA, timestamp: new Date(Date.now() + 86400000), powerKw: 999, cumulativeEnergyKwh: 999, voltage: 230 }
    ]);
    const path = `/api/v1/districts/${ids.colombo}/generation-summary`;
    const first = await request(app).get(path).set(auth(tokens.district));
    expect(first.body.data.summary.currentPowerKw).toBe(0);
    expect(first.body.data.summary.lastKnownPowerKw).toBe(2);
    expect(first.body.data.summary.todayEnergyKwh).toBe(0);
    expect(first.body.data.summary.energyQuality.reasons).toContain('missing-midnight-baseline');
    const second = await request(app).get(path).set(auth(tokens.district)).set('If-None-Match', first.headers.etag);
    expect(second.status).toBe(304);
    } finally { global.Date = RealDate; }
  });
  test('OpenAPI has concrete successful JSON schemas and no historical mutations', async () => {
    const res = await request(app).get('/openapi.json');
    expect(res.status).toBe(200);
    const spec = res.body;
    expect(spec.components.securitySchemes.BearerAuth.scheme).toBe('bearer');
    for (const [path, operations] of Object.entries(spec.paths)) {
      for (const operation of Object.values(operations)) {
        for (const [status, response] of Object.entries(operation.responses)) {
          if (['200', '201'].includes(status)) expect(response.content['application/json'].schema).toBeTruthy();
        }
      }
      if (path.includes('readings')) expect(operations.put || operations.delete).toBeUndefined();
    }
    for (const asset of ['swagger-ui.css', 'swagger-ui-bundle.js', 'swagger-ui-init.js']) {
      expect((await request(app).get(`/docs/${asset}`)).status).toBe(200);
    }
  });
});


describe('five-issue regressions', () => {
  test('district energy uses per-installation deltas and fresh/stale/missing coverage', async () => {
    const district = await District.create({ name: 'Isolated quality district', code: 'QUALITY', province: ids.wp });
    const station = await Substation.create({ name: 'Quality station', code: 'QUALITY', district: district._id });
    const installations = await SolarInstallation.insertMany([0, 1, 2].map(n => ({ name: `Quality ${n}`, code: `QUALITY-${n}`, meterId: `QUALITY-${n}`, capacityKw: 10, latitude: 7, longitude: 80, substation: station._id })));
    const start = +new Date('2035-01-01T18:30:00Z');
    const records = [[0, 100], [15, 102], [30, 0], [45, 3], [60, 4]].map(([minute, counter]) => ({ installation: installations[0]._id, timestamp: new Date(start + minute * 60000), cumulativeEnergyKwh: counter, powerKw: 4, voltage: 230 }));
    records.push(...[[0, 200], [15, 203]].map(([minute, counter]) => ({ installation: installations[1]._id, timestamp: new Date(start + minute * 60000), cumulativeEnergyKwh: counter, powerKw: 6, voltage: 230 })));
    await GenerationReading.insertMany(records);
    const { districtSummary } = require('../src/services/summaryService');
    const { summary } = await districtSummary(district._id, new Date(start + 60 * 60000));
    expect(summary.currentPowerKw).toBe(4); expect(summary.lastKnownPowerKw).toBe(10);
    expect(summary.todayEnergyKwh).toBe(9); // (2 + 3 + 1) + 3; reset interval excluded.
    expect(summary.powerQuality).toEqual({ freshInstallations: 1, staleInstallations: 1, missingInstallations: 1 });
    expect(summary.energyQuality.partialInstallations).toBe(3); expect(summary.energyQuality.counterDecreases).toBe(1);
    expect(summary.window.from).toBe('2035-01-01T18:30:00.000Z');
    const missing = await request(app).get(`/api/v1/installations/${installations[2]._id}/last-reading`).set(auth(tokens.national));
    expect(missing.status).toBe(404); expect(missing.body.error.detail.status).toBe('missing');
  });

  test.each(['timestamp', '-timestamp'])('keyset traversal survives concurrent inserts (%s)', async sort => {
    const baseTime = sort === 'timestamp' ? '2031-01-01T00:00:00Z' : '2032-01-01T00:00:00Z';
    const begin = +new Date(baseTime);
    const rows = await GenerationReading.insertMany([0, 1, 2, 3, 4, 5].map((n) => ({ installation: n % 2 ? ids.instA : ids.instB, timestamp: new Date(begin + Math.floor(n / 2) * 900000), powerKw: 1, cumulativeEnergyKwh: n, voltage: 230 })));
    const path = `/api/v1/readings?pagination=cursor&limit=2&sort=${sort}&from=${baseTime}&to=${new Date(begin + 3600000).toISOString()}`;
    const first = await request(app).get(path).set(auth(tokens.national));
    expect(first.status).toBe(200); expect(first.body.meta.total).toBe(6); expect(first.body.links.previous).toBeNull();
    await GenerationReading.create({ installation: ids.instA, timestamp: new Date(begin + 1000), powerKw: 1, cumulativeEnergyKwh: 1, voltage: 230 });
    await GenerationReading.create({ installation: ids.instA, timestamp: new Date(begin + 3599000), powerKw: 1, cumulativeEnergyKwh: 10, voltage: 230 });
    const seen = first.body.data.map(r => r.id); let next = first.body.links.next; let previous;
    while (next) {
      const response = await request(app).get(next).set(auth(tokens.national)); expect(response.status).toBe(200);
      seen.push(...response.body.data.map(r => r.id)); previous = response.body.links.previous; next = response.body.links.next;
    }
    expect(new Set(seen).size).toBe(seen.length);
    for (const row of rows) expect(seen).toContain(String(row._id));
    expect(previous).toBeTruthy();
    const back = await request(app).get(previous).set(auth(tokens.national)); expect(back.status).toBe(200); expect(back.body.links.next).toBeTruthy();
    expect((await request(app).get(first.body.links.next + '&districtId=' + ids.colombo).set(auth(tokens.national))).status).toBe(400);
    expect((await request(app).get(first.body.links.next).set(auth(tokens.district))).status).toBe(400);
    const changed = new URL(first.body.links.next, 'http://local'); changed.searchParams.set('cursor', changed.searchParams.get('cursor') + 'x');
    expect((await request(app).get(changed.pathname + changed.search).set(auth(tokens.national))).status).toBe(400);
  });
  test('nested cursor boundaries, reverse navigation, invalid modes and empty history', async () => {
    const path = `/api/v1/installations/${ids.instA}/readings?pagination=cursor&limit=2&sort=timestamp`;
    const first = await request(app).get(path).set(auth(tokens.deviceA)); expect(first.status).toBe(200);
    const second = await request(app).get(first.body.links.next).set(auth(tokens.deviceA)); expect(second.status).toBe(200);
    const back = await request(app).get(second.body.links.previous).set(auth(tokens.deviceA));
    expect(back.body.data.map(r => r.id)).toEqual(first.body.data.map(r => r.id));
    expect((await request(app).get(first.body.links.next).set(auth(tokens.deviceB))).status).toBe(403);
    for (const suffix of ['&cursor=bad', '&page=1', '&pagination=other']) expect((await request(app).get(path + suffix).set(auth(tokens.deviceA))).status).toBe(400);
    const empty = await request(app).get(path + '&from=2199-01-01T00:00:00Z').set(auth(tokens.deviceA));
    expect(empty.body.data).toEqual([]); expect(empty.body.links.next).toBeNull(); expect(empty.body.links.previous).toBeNull();
  });
  test('freshness changes invalidate cached operational representations', async () => {
    const { freshnessSeconds } = require('../src/config/env');
    const original = Date.now();
    const reading = await GenerationReading.create({ installation: ids.instB, timestamp: new Date('2040-01-01T00:00:00Z'), powerKw: 1, cumulativeEnergyKwh: 1, voltage: 230 });
    // Service receives trusted server time; move only the Date constructor for GET evaluation.
    const NativeDate = Date;
    const path = `/api/v1/installations/${ids.instB}/last-reading`;
    global.Date = class extends NativeDate { constructor(...args) { super(...(args.length ? args : [+reading.timestamp])); } static now() { return original; } };
    try {
      const first = await request(app).get(path).set(auth(tokens.national)); expect(first.body.freshness.status).toBe('fresh');
      global.Date = class extends NativeDate { constructor(...args) { super(...(args.length ? args : [+reading.timestamp + (freshnessSeconds + 1) * 1000])); } static now() { return original; } };
      const stale = await request(app).get(path).set(auth(tokens.national)).set('If-None-Match', first.headers.etag);
      expect(stale.status).toBe(200); expect(stale.body.freshness.status).toBe('stale'); expect(stale.headers['last-modified']).toBeUndefined();
    } finally { global.Date = NativeDate; }
  });
  test.each(['exp', 'iat', 'sub', 'role', 'scopes', 'scope', 'installationId'])('device JWT requires %s', async claim => {
    const jwt = require('jsonwebtoken'); const { jwtSecret } = require('../src/config/env');
    const payload = jwt.decode(tokens.deviceA); delete payload[claim];
    const token = jwt.sign(payload, jwtSecret, { algorithm: 'HS256', noTimestamp: claim === 'iat' });
    expect((await request(app).get(`/api/v1/installations/${ids.instA}`).set(auth(token))).status).toBe(401);
  });
  test.each(['role', 'scopes', 'scope', 'installationId'])('device claim escalation rejected: %s', async claim => {
    const jwt = require('jsonwebtoken'); const { jwtSecret } = require('../src/config/env'); const payload = jwt.decode(tokens.deviceA);
    payload[claim] = claim === 'scopes' ? ['analyst-read'] : claim === 'installationId' ? ids.instB : 'national-analyst';
    const token = jwt.sign(payload, jwtSecret);
    expect((await request(app).get(`/api/v1/installations/${ids.instA}`).set(auth(token))).status).toBe(401);
  });
  test('forged, wrong algorithm and disabled device tokens are rejected', async () => {
    const jwt = require('jsonwebtoken'); const { jwtSecret } = require('../src/config/env'); const payload = jwt.decode(tokens.deviceA);
    for (const token of [jwt.sign(payload, 'fictional-wrong-test-key'), jwt.sign(payload, jwtSecret, { algorithm: 'HS384' })]) {
      expect((await request(app).get(`/api/v1/installations/${ids.instA}`).set(auth(token))).status).toBe(401);
    }
    await User.updateOne({ _id: payload.sub }, { active: false });
    try { expect((await request(app).get(`/api/v1/installations/${ids.instA}`).set(auth(tokens.deviceA))).status).toBe(401); }
    finally { await User.updateOne({ _id: payload.sub }, { active: true }); }
  });
});
