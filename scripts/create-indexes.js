const { connectDatabase, disconnectDatabase } = require('../src/config/database');
const models = ['Province', 'District', 'Substation', 'SolarInstallation', 'GenerationReading', 'User'].map(name => require(`../src/models/${name}`));

async function main() {
  await connectDatabase();
  for (const model of models) {
    await model.createIndexes();
    console.log(`Indexes ready: ${model.collection.name}`);
  }
}

if (require.main === module) main()
  .catch(() => { console.error('Index creation failed; check permissions or duplicate data. No documents were deleted.'); process.exitCode = 1; })
  .finally(disconnectDatabase);
