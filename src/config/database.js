const mongoose = require('mongoose');
const { mongoUri } = require('./env');

let connectionPromise;

async function connectDatabase() {
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  if (!connectionPromise) {
    const uri = typeof mongoUri === 'function' ? mongoUri() : mongoUri;
    connectionPromise = mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000,
      maxPoolSize: 10,
      maxIdleTimeMS: 60000
    }).catch((error) => {
      connectionPromise = undefined;
      throw error;
    });
  }
  try {
    await connectionPromise;
    return mongoose.connection;
  } finally {
    connectionPromise = undefined;
  }
}

async function disconnectDatabase() {
  connectionPromise = undefined;
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}

module.exports = { connectDatabase, disconnectDatabase };
