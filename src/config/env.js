require('dotenv').config();

const isTest = process.env.NODE_ENV === 'test';

if (!isTest) {
  for (const key of ['MONGODB_URI', 'JWT_SECRET']) {
    if (!process.env[key]) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
  }
}

function mongoUri() {
  if (process.env.NODE_ENV === 'test') {
    if (!process.env.MONGODB_TEST_URI) throw new Error('MONGODB_TEST_URI is required in test mode');
    if (process.env.MONGODB_TEST_URI === process.env.MONGODB_URI) throw new Error('Test and application databases must differ');
    return process.env.MONGODB_TEST_URI;
  }
  return process.env.MONGODB_URI;
}

function positiveSeconds(name, fallback) {
  const value = process.env[name] === undefined ? fallback : Number(process.env[name]);
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`Invalid ${name}`);
  return value;
}

module.exports = {
  freshnessSeconds: positiveSeconds('READING_FRESHNESS_SECONDS', 1800),
  reportingIntervalSeconds: positiveSeconds('READING_INTERVAL_SECONDS', 900),
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 3000),
  mongoUri,
  jwtSecret: process.env.JWT_SECRET || (isTest ? 'test-only-jwt-secret' : undefined),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1h',
  corsOrigin: process.env.CORS_ORIGIN || '*',
  rateLimitWindowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 900000),
  rateLimitMax: Number(process.env.RATE_LIMIT_MAX || (isTest ? 10000 : 300)),
  apiVersion: '1.0.0'
};
