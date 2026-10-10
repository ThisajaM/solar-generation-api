const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const swaggerUi = require('swagger-ui-express');
const { corsOrigin, rateLimitWindowMs, rateLimitMax, apiVersion, nodeEnv } = require('./config/env');
const { connectDatabase } = require('./config/database');
const { notFound, errorHandler } = require('./middleware/error');
const { sendError } = require('./utils/http');
const authRoutes = require('./routes/auth');
const geographyRoutes = require('./routes/geography');
const readingRoutes = require('./routes/readings');
const summaryRoutes = require('./routes/summary');
const openapi = require('./docs/openapi');

const app = express();
app.set('trust proxy', process.env.VERCEL ? 1 : false);
app.disable('etag');
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: false
}));
// Public coursework clients supply a Bearer token explicitly; no cookie sessions.
app.use(cors({
  origin: corsOrigin === '*' ? '*' : corsOrigin.split(',').map(value => value.trim()),
  credentials: false,
  methods: ['GET', 'HEAD', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  exposedHeaders: ['ETag', 'Last-Modified', 'Location']
}));
app.use(rateLimit({
  windowMs: rateLimitWindowMs,
  limit: rateLimitMax,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: () => nodeEnv === 'test',
  handler: (_req, res) => sendError(res, 429, 'RATE_LIMITED', 'Too many requests; retry later', null)
}));
app.use(express.json({ limit: '100kb' }));

app.use((req, res, next) => {
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    const type = req.get('Content-Type') || '';
    if (!req.is('application/json')) {
      return sendError(res, 415, 'UNSUPPORTED_MEDIA_TYPE', 'Request body must use Content-Type: application/json', { contentType: type || null });
    }
  }
  next();
});

app.use('/api/v1', (req, res, next) => {
  res.set('Cache-Control', 'private, no-cache');
  res.vary('Authorization');
  const accept = req.get('Accept');
  if (accept && !req.accepts('application/json')) {
    return sendError(res, 406, 'NOT_ACCEPTABLE', 'This API serves application/json representations', { accept });
  }
  const collection = /\/(provinces|districts|substations|installations|readings)$/.test(req.path);
  const allowed = collection ? ['page', 'limit'] : [];
  if (req.path.endsWith('/readings')) allowed.push('provinceId', 'districtId', 'substationId', 'from', 'to', 'sort', 'pagination', 'cursor');
  if (['/districts', '/substations', '/installations'].includes(req.path)) allowed.push('provinceId');
  if (['/substations', '/installations'].includes(req.path)) allowed.push('districtId');
  if (req.path === '/installations') allowed.push('substationId');
  if (req.path.endsWith('/installations')) allowed.push('status', 'search');
  if (req.path.endsWith('/generation-summary')) allowed.push('mode', 'date', 'from', 'to');
  if (req.path === '/generation-summary') allowed.push('provinceId', 'districtId', 'substationId');
  for (const [key, value] of Object.entries(req.query)) {
    if (!allowed.includes(key) || typeof value !== 'string') return sendError(res, 400, 'INVALID_PARAMETER', 'Unknown or repeated query parameter', { field: key });
  }
  if ((req.query.pagination !== undefined && !['offset', 'cursor', 'snapshot'].includes(req.query.pagination)) || (req.query.cursor !== undefined && (!['cursor', 'snapshot'].includes(req.query.pagination) || !req.query.cursor))) return sendError(res, 400, 'INVALID_PARAMETER', 'Invalid pagination mode or cursor combination', null);
  next();
});

app.use('/api/v1', async (req, res, next) => {
  try {
    await connectDatabase();
    next();
  } catch {
    sendError(res, 503, 'DATABASE_UNAVAILABLE', 'Database is temporarily unavailable', null);
  }
});

app.get('/health', async (req, res) => {
  try {
    await connectDatabase();
    res.json({ status: 'ok', database: 'connected', version: apiVersion });
  } catch {
    res.status(503).json({ status: 'degraded', database: 'unavailable', version: apiVersion });
  }
});

app.get('/api/v1', (req, res) => res.json({
  data: {
    name: 'SLSEA Real-Time Solar Generation Data API',
    version: apiVersion,
    docs: '/docs'
  }
}));

app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapi, { explorer: true, swaggerOptions: { persistAuthorization: true } }));
app.get('/openapi.json', (req, res) => res.json(openapi));
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1', geographyRoutes);
app.use('/api/v1', readingRoutes);
app.use('/api/v1', summaryRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
