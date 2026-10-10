const { MongoMemoryReplSet } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const request = require('supertest');
const bcrypt = require('bcryptjs');
const Province = require('../src/models/Province');
const District = require('../src/models/District');
const Substation = require('../src/models/Substation');
const Installation = require('../src/models/SolarInstallation');
const Reading = require('../src/models/GenerationReading');
const User = require('../src/models/User');
const Snapshot = require('../src/models/ReadingSnapshot');
const { signature } = require('../src/services/cursorService');
let mongo, app, a, b, empty, stationA, stationB, districtA, districtB, provinceA, provinceB;
const tokens = {}; let serial = 0;
const auth = token => ({ Authorization: `Bearer ${token}` });
const body = (substation = stationA._id) => ({ code: `CRUD-${++serial}`, name: 'New solar site', meterId: `CRUD-MTR-${serial}`, capacityKw: 12, latitude: 7, longitude: 80, substation: String(substation), status: 'active' });
const reading = (installation, timestamp, counter=1) => ({ installation, timestamp, powerKw: 2, cumulativeEnergyKwh: counter, voltage: 230 });
const start = +new Date('2026-10-01T18:30:00Z');
async function account(name, role, scope, extra={}) {
  const password='isolated-fixture-password';
  const scopes=role==='installation-admin'?['analyst-read','installation-manage']:role==='device'?['installation-write']:['analyst-read'];
  const user=await User.create({name,email:`${name}@example.test`,passwordHash:await bcrypt.hash(password,4),role,scope,scopes,...extra});
  const response=await request(app).post('/api/v1/auth/login').send({email:user.email,password});expect(response.status).toBe(200);
  tokens[name]=response.body.data.token;return user;
}
beforeAll(async()=>{
  mongo=await MongoMemoryReplSet.create({replSet:{count:1}});process.env.MONGODB_TEST_URI=mongo.getUri('finalization_tests');
  await require('../src/config/database').connectDatabase();app=require('../api/index');
  await Promise.all([Province,District,Substation,Installation,Reading,User].map(m=>m.init()));
  await Snapshot.createCollection();await Snapshot.createIndexes();await Reading.collection.createIndex({timestamp:1,_id:1},{name:'snapshot_time_id'});
  provinceA=await Province.create({name:'A',code:'A'});provinceB=await Province.create({name:'B',code:'B'});
  districtA=await District.create({name:'A district',code:'AD',province:provinceA._id});districtB=await District.create({name:'B district',code:'BD',province:provinceB._id});
  stationA=await Substation.create({name:'A grid',code:'AG',district:districtA._id});stationB=await Substation.create({name:'B grid',code:'BG',district:districtB._id});
  a=await Installation.create(body());b=await Installation.create(body(stationB._id));empty=await Installation.create(body());
  await Reading.insertMany([a,b].flatMap(inst=>[0,1,2,3,4].map(n=>reading(inst._id,new Date(start+n*900000),100+n*5))));
  await account('admin','installation-admin','national');await account('provinceAdmin','installation-admin','province',{province:provinceA._id});await account('districtAdmin','installation-admin','district',{district:districtA._id});
  await account('analyst','national-analyst','national');await account('districtAnalyst','district-analyst','district',{district:districtA._id});
  await account('device','device','installation',{installation:a._id});
});
afterAll(async()=>{await mongoose.disconnect();if(mongo)await mongo.stop();});

test('installation CRUD returns Location, supports filters/search, PATCH and idempotent archival',async()=>{
  const input=body();const made=await request(app).post('/api/v1/installations').set(auth(tokens.districtAdmin)).send(input);
  expect(made.status).toBe(201);const url=made.headers.location;expect(url).toBe(`/api/v1/installations/${made.body.data.id}`);
  expect((await request(app).get(url).set(auth(tokens.admin))).status).toBe(200);
  const patched=await request(app).patch(url).set(auth(tokens.districtAdmin)).send({name:'Updated solar site',capacityKw:15,status:'inactive'});
  expect(patched.status).toBe(200);expect(patched.body.data.capacityKw).toBe(15);expect(+new Date(patched.body.data.updatedAt)).toBeGreaterThanOrEqual(+new Date(made.body.data.createdAt));
  const list=await request(app).get(`/api/v1/installations?districtId=${districtA._id}&provinceId=${provinceA._id}&substationId=${stationA._id}&status=inactive&search=Updated`).set(auth(tokens.analyst));
  expect(list.status).toBe(200);expect(list.body.data.map(i=>i.id)).toContain(made.body.data.id);
  for(let i=0;i<2;i++) {const removed=await request(app).delete(url).set(auth(tokens.admin));expect(removed.status).toBe(204);expect(removed.text).toBe('');}
  const stored=await Installation.findById(made.body.data.id);expect(stored.status).toBe('archived');const stamp=+stored.updatedAt;
  await request(app).delete(url).set(auth(tokens.admin));expect(+(await Installation.findById(stored._id)).updatedAt).toBe(stamp);
  expect((await request(app).get('/api/v1/installations?search='+input.code).set(auth(tokens.admin))).body.meta.total).toBe(0);
  expect((await request(app).get('/api/v1/installations?status=archived&search='+input.code).set(auth(tokens.admin))).body.meta.total).toBe(1);
  expect((await request(app).get(`/api/v1/substations/${stationA._id}/installations?search=${input.code}`).set(auth(tokens.admin))).body.meta.total).toBe(0);
  expect((await request(app).get(url).set(auth(tokens.admin))).status).toBe(200);
  expect((await request(app).patch(url).set(auth(tokens.admin)).send({name:'Reopen'})).status).toBe(409);
});
test.each(['analyst','device'])('%s cannot create, update or delete installations',async role=>{
  expect((await request(app).post('/api/v1/installations').set(auth(tokens[role])).send(body())).status).toBe(403);
  expect((await request(app).patch(`/api/v1/installations/${a._id}`).set(auth(tokens[role])).send({name:'Denied'})).status).toBe(403);
  expect((await request(app).delete(`/api/v1/installations/${a._id}`).set(auth(tokens[role]))).status).toBe(403);
});
test('missing authentication and foreign jurisdictions cannot manage installations',async()=>{
  expect((await request(app).post('/api/v1/installations').send(body())).status).toBe(401);
  for(const role of ['provinceAdmin','districtAdmin']) {
    expect((await request(app).post('/api/v1/installations').set(auth(tokens[role])).send(body(stationB._id))).status).toBe(403);
    expect((await request(app).patch(`/api/v1/installations/${b._id}`).set(auth(tokens[role])).send({status:'inactive'})).status).toBe(403);
    expect((await request(app).delete(`/api/v1/installations/${b._id}`).set(auth(tokens[role]))).status).toBe(403);
    expect((await request(app).get(`/api/v1/installations?provinceId=${provinceB._id}`).set(auth(tokens[role]))).body.meta.total).toBe(0);
  }
});
test.each([{_id:'aaaaaaaaaaaaaaaaaaaaaaaa'},{code:'REPLACEMENT'},{meterId:'REPLACEMENT'},{inverterId:'REPLACEMENT'},{substation:'aaaaaaaaaaaaaaaaaaaaaaaa'},{unknown:1},{status:'archived'},{capacityKw:0},{latitude:91},{longitude:-181},{name:''},{capacityKw:'12'},{}])('PATCH rejects unknown, immutable or invalid fields %j',async payload=>{
  expect((await request(app).patch(`/api/v1/installations/${a._id}`).set(auth(tokens.admin)).send(payload)).status).toBe(400);
});
test('invalid IDs, missing resources, invalid references and duplicate identifiers',async()=>{
  for(const method of ['get','patch','delete']) {
    expect((await request(app)[method]('/api/v1/installations/invalid').set(auth(tokens.admin)).send(method==='patch'?{name:'X'}:undefined)).status).toBe(400);
    expect((await request(app)[method]('/api/v1/installations/aaaaaaaaaaaaaaaaaaaaaaaa').set(auth(tokens.admin)).send(method==='patch'?{name:'X'}:undefined)).status).toBe(404);
  }
  const invalid=body();delete invalid.meterId;expect((await request(app).post('/api/v1/installations').set(auth(tokens.admin)).send(invalid)).status).toBe(400);
  expect((await request(app).post('/api/v1/installations').set(auth(tokens.admin)).send({...body(),substation:'bad'})).status).toBe(400);
  expect((await request(app).post('/api/v1/installations').set(auth(tokens.admin)).send(body('aaaaaaaaaaaaaaaaaaaaaaaa'))).status).toBe(404);
  for(const payload of [{...body(),code:a.code},{...body(),meterId:a.meterId}]) expect((await request(app).post('/api/v1/installations').set(auth(tokens.admin)).send(payload)).status).toBe(409);
});
test('archival preserves readings and prevents subsequent and racing ingestion',async()=>{
  const site=await Installation.create(body());await account('archiveDevice','device','installation',{installation:site._id});
  await Reading.create(reading(site._id,new Date(start),100));const url=`/api/v1/installations/${site._id}`;
  const jobs=[0,1,2].map(n=>request(app).post(url+'/readings').set(auth(tokens.archiveDevice)).send({timestamp:new Date(start+(n+1)*900000).toISOString(),powerKw:2,cumulativeEnergyKwh:101+n,voltage:230}));
  const responses=await Promise.all([...jobs,request(app).delete(url).set(auth(tokens.admin))]);
  expect(responses.at(-1).status).toBe(204);responses.slice(0,-1).forEach(r=>expect([201,409]).toContain(r.status));
  expect(await Reading.countDocuments({installation:site._id})).toBe(1+responses.slice(0,-1).filter(r=>r.status===201).length);
  expect((await request(app).post(url+'/readings').set(auth(tokens.archiveDevice)).send({timestamp:new Date(start+999999).toISOString(),powerKw:1,cumulativeEnergyKwh:105,voltage:230})).status).toBe(409);
  expect((await request(app).get(url+'/readings').set(auth(tokens.archiveDevice))).status).toBe(200);
});
test('historical summaries ignore live freshness, preserve boundaries and apply jurisdiction',async()=>{
  const range='mode=historical&from=2026-10-01T18:30:00Z&to=2026-10-01T19:30:00Z';
  const own=await request(app).get(`/api/v1/installations/${a._id}/generation-summary?${range}`).set(auth(tokens.device));
  expect(own.status).toBe(200);expect(own.body.data.summary.energyKwh).toBe(20);expect(own.body.data.summary.energyQuality.coveragePercent).toBe(100);expect(own.body.data.summary.energyQuality.isComplete).toBe(true);expect(own.body.data.summary.currentPowerKw).toBeUndefined();
  const scoped=await request(app).get(`/api/v1/generation-summary?${range}&districtId=${districtB._id}`).set(auth(tokens.districtAnalyst));expect(scoped.status).toBe(200);expect(scoped.body.data.summary.installationCount).toBe(0);
  expect((await request(app).get(`/api/v1/districts/${districtB._id}/generation-summary?${range}`).set(auth(tokens.districtAnalyst))).status).toBe(403);
  expect((await request(app).get(`/api/v1/installations/${b._id}/generation-summary?${range}`).set(auth(tokens.device))).status).toBe(403);
  const day=await request(app).get(`/api/v1/districts/${districtA._id}/generation-summary?mode=historical&date=2026-10-02`).set(auth(tokens.admin));expect(day.status).toBe(200);expect(day.body.data.summary.window.from).toBe('2026-10-01T18:30:00.000Z');expect(day.body.data.summary.energyQuality.isComplete).toBe(false);
  const live=await request(app).get(`/api/v1/installations/${a._id}/generation-summary`).set(auth(tokens.device));expect(live.body.data.summary.currentPowerKw).toBe(0);expect(live.body.data.summary.staleInstallations).toBe(1);
});
test('empty history is unavailable and invalid reporting inputs fail explicitly',async()=>{
  const base=`/api/v1/installations/${empty._id}/generation-summary`;
  const r=await request(app).get(base+'?mode=historical&date=2026-10-02').set(auth(tokens.admin));expect(r.status).toBe(200);expect(r.body.data.summary.energyQuality.qualityStatus).toBe('unavailable');expect(r.body.data.summary.energyKwh).toBe(0);
  for(const query of ['mode=bad','mode=historical','date=2026-10-02','mode=historical&date=invalid','mode=historical&from=2026-01-01T00:00:00Z&to=2026-10-01T00:00:00Z','mode=historical&date=2099-01-01'])expect((await request(app).get(base+'?'+query).set(auth(tokens.admin))).status).toBe(400);
});

test.each(['timestamp','-timestamp'])('snapshot excludes equal-time and backdated inserts in %s order',async sort=>{
  const year=sort==='timestamp'?2020:2021;const t=+new Date(`${year}-01-01T00:00:00Z`);
  const original=await Reading.insertMany([a,b].flatMap(inst=>[0,1,2].map(n=>reading(inst._id,new Date(t+n*900000),n))));
  const url=`/api/v1/readings?pagination=snapshot&limit=2&sort=${sort}&from=${new Date(t).toISOString()}&to=${new Date(t+3600000).toISOString()}`;
  const first=await request(app).get(url).set(auth(tokens.admin));expect(first.status).toBe(200);expect(first.body.meta.total).toBe(6);expect(first.body.meta.consistency).toBe('fixed-membership');
  await Reading.insertMany([{...reading(empty._id,new Date(t),2),_id:new mongoose.Types.ObjectId(year===2020?'000000000000000000000001':'000000000000000000000002'),createdAt:new Date(t)},reading(a._id,new Date(t+1000),2),reading(a._id,new Date(t+3599000),4)]);
  const ids=first.body.data.map(r=>r.id);let next=first.body.links.next;let previous;
  while(next){const r=await request(app).get(next).set(auth(tokens.admin));expect(r.status).toBe(200);expect(r.body.meta.total).toBe(6);ids.push(...r.body.data.map(x=>x.id));previous=r.body.links.previous;next=r.body.links.next;}
  expect(ids).toHaveLength(6);expect(new Set(ids)).toEqual(new Set(original.map(r=>String(r._id))));
  const back=await request(app).get(previous).set(auth(tokens.admin));expect(back.status).toBe(200);expect(back.body.data.map(r=>r.id)).toEqual(ids.slice(2,4));
  expect((await request(app).get(first.body.links.next+'&districtId='+districtA._id).set(auth(tokens.admin))).status).toBe(400);
  expect((await request(app).get(first.body.links.next).set(auth(tokens.analyst))).status).toBe(400);
});
test('snapshot tokens reject signatures, versions, expiry, replacement and missing members',async()=>{
  const url=`/api/v1/installations/${a._id}/readings?pagination=snapshot&limit=2`;
  let first=await request(app).get(url).set(auth(tokens.device));expect(first.status).toBe(200);
  const next=new URL(first.body.links.next,'http://local');const value=JSON.parse(Buffer.from(next.searchParams.get('cursor').split('.')[0],'base64url').toString());
  for(const changed of [{...value,v:99},{...value,exp:1},{...value,position:-1}]){const encoded=Buffer.from(JSON.stringify(changed)).toString('base64url');next.searchParams.set('cursor',encoded+'.'+signature(encoded).toString('base64url'));expect((await request(app).get(next.pathname+next.search).set(auth(tokens.device))).status).toBe(400);}
  expect((await request(app).get(first.body.links.next+'x').set(auth(tokens.device))).status).toBe(400);
  await request(app).get(url).set(auth(tokens.device));expect((await request(app).get(first.body.links.next).set(auth(tokens.device))).status).toBe(410);
  first=await request(app).get(url).set(auth(tokens.device));await Snapshot.updateOne({_id:JSON.parse(Buffer.from(tokens.device.split('.')[1],'base64url')).sub},{$set:{expiresAt:new Date(0)}});expect((await request(app).get(first.body.links.next).set(auth(tokens.device))).status).toBe(410);
  // Direct deletion is only an isolated administrator-tampering fixture; no API mutation exists.
  first=await request(app).get(url).set(auth(tokens.device));const manifest=await Snapshot.findOne({nonce:JSON.parse(Buffer.from(new URL(first.body.links.next,'http://local').searchParams.get('cursor').split('.')[0],'base64url')).snapshot});
  await Reading.deleteOne({_id:manifest.readingIds[2]});expect((await request(app).get(first.body.links.next).set(auth(tokens.device))).status).toBe(409);
});
test('empty snapshots, page conflicts and inactive principals are handled',async()=>{
  const url=`/api/v1/readings?pagination=snapshot&from=2199-01-01T00:00:00Z`;
  const r=await request(app).get(url).set(auth(tokens.admin));expect(r.status).toBe(200);expect(r.body.meta.total).toBe(0);expect(r.body.links.next).toBeNull();expect(r.body.links.previous).toBeNull();
  expect((await request(app).get(url+'&page=1').set(auth(tokens.admin))).status).toBe(400);
  expect((await request(app).get(url+'&limit=101').set(auth(tokens.admin))).status).toBe(400);
  const user=await User.findOne({email:'admin@example.test'});user.active=false;await user.save();expect((await request(app).get(url).set(auth(tokens.admin))).status).toBe(401);user.active=true;await user.save();
});
test('administrator provisioning creates a hashed new identity and never overwrites an existing one',async()=>{
  const {provisionAdmin}=require('../scripts/provision-admin');const input={name:'New operator',email:'new-operator@example.test',password:'isolated-admin-fixture-credential',scope:'district',districtId:String(districtA._id)};
  const user=await provisionAdmin(input);expect(user.role).toBe('installation-admin');expect(await bcrypt.compare(input.password,user.passwordHash)).toBe(true);expect(user.passwordHash).not.toBe(input.password);
  await expect(provisionAdmin(input)).rejects.toMatchObject({code:11000});expect((await User.findById(user._id)).passwordHash).toBe(user.passwordHash);
  await expect(provisionAdmin({...input,email:'other@example.test',districtId:'aaaaaaaaaaaaaaaaaaaaaaaa'})).rejects.toThrow();
});
test('literal search cannot expand into a regex and missing historical districts are 404',async()=>{
  expect((await request(app).get('/api/v1/installations?search=.*').set(auth(tokens.admin))).body.meta.total).toBe(0);
  expect((await request(app).get('/api/v1/installations?search=').set(auth(tokens.admin))).status).toBe(400);
  expect((await request(app).get('/api/v1/districts/aaaaaaaaaaaaaaaaaaaaaaaa/generation-summary?mode=historical&date=2026-10-02').set(auth(tokens.admin))).status).toBe(404);
});
test('snapshot traversal survives authorization-preserving archival of an installation',async()=>{
  const site=await Installation.create(body());await Reading.insertMany([0,1,2].map(n=>reading(site._id,new Date(start+n*900000),n)));
  const first=await request(app).get(`/api/v1/installations/${site._id}/readings?pagination=snapshot&limit=1`).set(auth(tokens.admin));expect(first.status).toBe(200);
  expect((await request(app).delete(`/api/v1/installations/${site._id}`).set(auth(tokens.admin))).status).toBe(204);
  const second=await request(app).get(first.body.links.next).set(auth(tokens.admin));expect(second.status).toBe(200);expect(second.body.meta.total).toBe(3);
  const historical=await request(app).get(`/api/v1/installations/${site._id}/generation-summary?mode=historical&from=2026-10-01T18:30:00Z&to=2026-10-01T19:00:00Z`).set(auth(tokens.admin));expect(historical.body.data.summary.energyKwh).toBe(2);
  const live=await request(app).get(`/api/v1/installations/${site._id}/generation-summary?mode=live`).set(auth(tokens.admin));expect(live.body.data.summary.installationCount).toBe(0);
});
test('a changed jurisdiction invalidates old tokens and snapshot reuse',async()=>{
  const first=await request(app).get('/api/v1/readings?pagination=snapshot&limit=1').set(auth(tokens.districtAdmin));expect(first.status).toBe(200);expect(first.body.links.next).toBeTruthy();
  const user=await User.findOne({email:'districtAdmin@example.test'.toLowerCase()});
  user.district=districtB._id;await user.save();
  try {
    expect((await request(app).get(first.body.links.next).set(auth(tokens.districtAdmin))).status).toBe(401);
    const logged=await request(app).post('/api/v1/auth/login').send({email:user.email,password:'isolated-fixture-password'});expect(logged.status).toBe(200);
    expect((await request(app).get(first.body.links.next).set(auth(logged.body.data.token))).status).toBe(400);
  } finally { user.district=districtA._id;await user.save(); }
});
