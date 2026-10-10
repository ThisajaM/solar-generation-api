// Deliberately isolated demo: never connects to Atlas or imports the local .env URI.
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const crypto = require('crypto');
let mongo; let server;
async function close() {
  if (server) await new Promise(resolve => server.close(resolve));
  await require('../src/config/database').disconnectDatabase(); if (mongo) await mongo.stop();
}
(async () => {
  if (!process.env.DEMO_ADMIN_PASSWORD || process.env.DEMO_ADMIN_PASSWORD.length < 16 || Buffer.byteLength(process.env.DEMO_ADMIN_PASSWORD) > 72) throw new Error('Set DEMO_ADMIN_PASSWORD to at least 16 characters');
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  process.env.NODE_ENV = 'test'; process.env.MONGODB_TEST_URI = mongo.getUri('isolated_swagger_demo');
  process.env.MONGODB_URI = ''; process.env.JWT_SECRET = crypto.randomBytes(48).toString('hex');
  process.env.SEED_CONFIRM = 'yes'; process.env.SEED_END = '2026-10-03T21:30:00Z';
  await require('../scripts/seed').main();
  const Snapshot = require('../src/models/ReadingSnapshot'); await Snapshot.createCollection(); await Snapshot.createIndexes();
  await require('../src/models/GenerationReading').collection.createIndex({ timestamp: 1, _id: 1 }, { name: 'snapshot_time_id' });
  await require('./provision-admin').provisionAdmin({ name: 'Isolated demo administrator', email: 'installation-admin@example.test', password: process.env.DEMO_ADMIN_PASSWORD, scope: 'national' });
  const app = require('../src/app'); server = app.listen(Number(process.env.DEMO_PORT || 3001), '127.0.0.1', () => console.log(`ISOLATED SYNTHETIC DEMO: http://127.0.0.1:${server.address().port}/docs/ — administrator installation-admin@example.test; use your supplied password.`));
})().catch(async () => { console.error('Isolated demo failed. Supply DEMO_ADMIN_PASSWORD (16–72 bytes); details suppressed.'); await close(); process.exitCode = 1; });
process.once('SIGINT', async () => { await close(); process.exit(0); });
process.once('SIGTERM', async () => { await close(); process.exit(0); });
