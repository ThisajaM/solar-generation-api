const path = require('path');
const root = process.cwd();
const mongoose = require(path.join(root, 'node_modules/mongoose'));
const { connectDatabase, disconnectDatabase } = require(path.join(root, 'src/config/database'));
const fs = require('fs');
(async () => {
  await connectDatabase();
  const expected = { provinces: 9, districts: 25, substations: 27, solarinstallations: 200, generationreadings: 134400, users: 227 };
  const counts = {};
  for (const [name, count] of Object.entries(expected)) {
    counts[name] = await mongoose.connection.db.collection(name).countDocuments({});
    if (counts[name] !== count) throw new Error(`Unexpected count for ${name}: ${counts[name]} (expected ${count})`);
  }
  const distribution = await mongoose.connection.db.collection('generationreadings').aggregate([
    { $group: { _id: '$installation', count: { $sum: 1 }, first: { $min: '$timestamp' }, last: { $max: '$timestamp' } } }
  ]).toArray();
  if (distribution.length !== 200 || distribution.some(row => row.count !== 672)) throw new Error('Unexpected per-installation reading distribution');
  const roles = await mongoose.connection.db.collection('users').aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }, { $sort: { _id: 1 } }]).toArray();
  const result = { verifiedAt: new Date().toISOString(), target: 'Configured Atlas coursework database', counts, installationsWith672Readings: distribution.length, firstReading: new Date(Math.min(...distribution.map(r => +r.first))).toISOString(), lastReading: new Date(Math.max(...distribution.map(r => +r.last))).toISOString(), roles };
  fs.writeFileSync(path.join(root, 'report/ATLAS-SEED-VERIFICATION.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
})().catch(() => { console.error('Seed verification failed; connection and credential details suppressed'); process.exitCode = 1; }).finally(disconnectDatabase);
