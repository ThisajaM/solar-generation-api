require('dotenv').config();
const fs = require('fs/promises');
const path = require('path');
const mongoose = require('mongoose');
const { connectDatabase, disconnectDatabase } = require('../src/config/database');
const { EJSON } = mongoose.mongo.BSON;
const collections = ['provinces', 'districts', 'substations', 'solarinstallations', 'generationreadings', 'users'];

async function exportSeed(out = path.resolve('seed-output')) {
  await connectDatabase();
  await fs.mkdir(out, { recursive: true, mode: 0o700 });
  for (const collection of collections) {
    const file = await fs.open(path.join(out, `${collection}.json`), 'w', 0o600);
    let count = 0;
    try {
      await file.write('[\n');
      for await (const doc of mongoose.connection.db.collection(collection).find({}).sort({ _id: 1 })) {
        await file.write(`${count ? ',\n' : ''}${EJSON.stringify(doc, { relaxed: false })}`);
        count++;
      }
      await file.write('\n]\n');
    } finally {
      await file.close();
    }
    console.log(`Exported ${count} MongoDB documents to ${collection}.json`);
  }
}

if (require.main === module) exportSeed()
  .catch(() => { console.error('Export failed. Check database access and output permissions.'); process.exitCode = 1; })
  .finally(disconnectDatabase);

module.exports = { exportSeed, collections };
