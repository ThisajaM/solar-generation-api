const { freshness } = require('../utils/readingQuality');
const readingService = require('../services/readingService');
const { sendError } = require('../utils/http');
const { applyValidators, isNotModified } = require('../utils/etag');

async function listReadings(req, res) {
  const installation = req.authorizedInstallation;
  if (!installation) return sendError(res, 404, 'NOT_FOUND', 'Installation not found', null);
  const { payload, lastModified } = await readingService.listReadings(req, installation);
  const etag = applyValidators(res, payload, lastModified);
  if (isNotModified(req, etag, lastModified)) return res.status(304).end();
  return res.json(payload);
}

async function createReading(req, res) {
  const reading = await readingService.createReading(req.params.installationId, req.body);
  if (!reading) return sendError(res, 404, 'NOT_FOUND', 'Installation not found', null);
  const location = readingService.locationPath(req.params.installationId, reading._id);
  res.set('Location', location);
  return res.status(201).json({ data: reading });
}

async function getReading(req, res) {
  const reading = await readingService.getReading(req.params.installationId, req.params.readingId);
  if (!reading) return sendError(res, 404, 'NOT_FOUND', 'Generation reading not found', null);
  const payload = { data: reading };
  const lastModified = reading.updatedAt || reading.timestamp;
  const etag = applyValidators(res, payload, lastModified);
  if (isNotModified(req, etag, lastModified)) return res.status(304).end();
  return res.json(payload);
}

async function lastReading(req, res) {
  const installation = req.authorizedInstallation;
  if (!installation) return sendError(res, 404, 'NOT_FOUND', 'Installation not found', null);
  const reading = await readingService.lastReading(installation._id);
  if (!reading) return sendError(res, 404, 'NOT_FOUND', 'No generation reading exists for this installation', freshness(null));
  const payload = { data: reading, freshness: freshness(reading) };
  const lastModified = undefined; // Freshness changes with server time, independently of storage.
  const etag = applyValidators(res, payload, lastModified);
  if (isNotModified(req, etag, lastModified)) return res.status(304).end();
  return res.json(payload);
}

module.exports = { listReadings, createReading, getReading, lastReading };
