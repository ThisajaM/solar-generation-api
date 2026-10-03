const app = require('./app');
const { connectDatabase } = require('./config/database');
const { port } = require('./config/env');

async function start() {
  await connectDatabase();
  const server = app.listen(port, () => {
    console.log(`SLSEA API listening on port ${server.address().port}`);
  });
}

if (require.main === module) {
  start().catch((error) => {
    console.error('Startup failed:', error.name, 'Check environment and database connectivity');
    process.exit(1);
  });
}

module.exports = app;
