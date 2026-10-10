const { connectDatabase, disconnectDatabase } = require('../src/config/database');
const models = ['Province', 'District', 'Substation', 'SolarInstallation', 'GenerationReading', 'User', 'ReadingSnapshot'].map(name => require(`../src/models/${name}`));

async function main() {
  await connectDatabase();
  for (const model of models) {
    await model.createCollection();
    await model.createIndexes();
    if (model.modelName === 'GenerationReading') await model.collection.createIndex({ timestamp: 1, _id: 1 }, { name: 'snapshot_time_id' });
    console.log(`Indexes ready: ${model.collection.name}`);
  }
}

if (require.main === module) main()
  .catch(() => { console.error('Index creation failed; check permissions or duplicate data. No documents were deleted.'); process.exitCode = 1; })
  .finally(disconnectDatabase);
