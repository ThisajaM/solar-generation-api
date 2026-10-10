const { cursorPage } = require('./cursorService');
const GenerationReading = require('../models/GenerationReading');
const SolarInstallation = require('../models/SolarInstallation');
const { parseIsoDate, parsePagination, parseSort, asNonNegativeNumber, validateOptionalObjectIdQuery } = require('../utils/validate');
const { buildPageLinks, paginated } = require('../utils/pagination');
const { assertFilterInsideJurisdiction } = require('./accessService');
const { populateInstallation } = require('../middleware/auth');
const { idString } = require('../utils/ids');

function HttpError(status, code, message, detail) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  error.detail = detail;
  return error;
}

function readingInput(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw HttpError(400, 'VALIDATION_ERROR', 'JSON object body is required', null);
  }
  const allowed = ['timestamp', 'powerKw', 'cumulativeEnergyKwh', 'voltage', 'frequencyHz'];
  if (Object.keys(body).some(key => !allowed.includes(key))) throw HttpError(400, 'VALIDATION_ERROR', 'Unexpected reading field', null);
  const timestamp = parseIsoDate(body.timestamp, 'timestamp');
  if (!timestamp) throw HttpError(400, 'VALIDATION_ERROR', 'timestamp is required', { field: 'timestamp' });
  return {
    timestamp,
    powerKw: asNonNegativeNumber(body.powerKw, 'powerKw'),
    cumulativeEnergyKwh: asNonNegativeNumber(body.cumulativeEnergyKwh, 'cumulativeEnergyKwh'),
    voltage: asNonNegativeNumber(body.voltage, 'voltage'),
    frequencyHz: body.frequencyHz == null ? 50 : asNonNegativeNumber(body.frequencyHz, 'frequencyHz')
  };
}

async function listReadings(req, installation) {
  validateOptionalObjectIdQuery(req, ['provinceId', 'districtId', 'substationId']);
  const { page, limit } = parsePagination(req.query);
  const sort = parseSort(req.query.sort, ['timestamp']);
  const from = parseIsoDate(req.query.from, 'from');
  const to = parseIsoDate(req.query.to, 'to');
  if (from && to && from.getTime() > to.getTime()) {
    throw HttpError(400, 'INVALID_PARAMETER', 'from must be earlier than or equal to to', { field: 'from', value: req.query.from });
  }

  const populated = installation.substation?.district?.province
    ? installation
    : await populateInstallation(installation._id);

  const mismatch = assertFilterInsideJurisdiction(req.user, req.query, populated);
  if (mismatch) {
    throw HttpError(403, 'FILTER_SCOPE_MISMATCH', 'The requested filter is outside the installation or your jurisdiction', { field: mismatch, value: req.query[mismatch] });
  }

  const query = { installation: installation._id };
  if (from || to) {
    query.timestamp = {};
    if (from) query.timestamp.$gte = from;
    if (to) query.timestamp.$lte = to;
  }

  if (req.query.pagination === 'snapshot') return { payload: await require('./snapshotService').snapshotPage(req, GenerationReading, query, limit, sort.startsWith('-') ? -1 : 1) };
  if (req.query.pagination === 'cursor') return { payload: await cursorPage(req, GenerationReading, query, limit, sort.startsWith('-') ? -1 : 1) };
  const sortSpec = { timestamp: sort.startsWith('-') ? -1 : 1 };
  const total = await GenerationReading.countDocuments(query);
  const pages = total === 0 ? 0 : Math.ceil(total / limit);
  const items = await GenerationReading.find(query)
    .sort(sortSpec)
    .skip((page - 1) * limit)
    .limit(limit);

  const payload = paginated({
    data: items,
    total,
    page,
    limit,
    links: buildPageLinks(req, { page, limit, pages })
  });
  // Pagination totals and late-arriving historical records can change any page.
  // ETag covers the complete representation; a page timestamp cannot validate it.
  const lastModified = undefined;
  return { payload, lastModified };
}

async function createReading(installationId, body) {
  const input = readingInput(body);
  const session = await SolarInstallation.startSession();
  let reading;
  try {
    await session.withTransaction(async () => {
      const installation = await SolarInstallation.findOneAndUpdate({ _id: installationId, status: { $ne: 'archived' } }, { $inc: { ingestionVersion: 1 } }, { session, new: true });
      if (!installation) {
        if (await SolarInstallation.exists({ _id: installationId }).session(session)) throw HttpError(409, 'INSTALLATION_ARCHIVED', 'Archived installations do not accept readings');
        reading = null; return;
      }
      [reading] = await GenerationReading.create([{ installation: installation._id, ...input }], { session });
    }, { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' }, maxCommitTimeMS: 5000, timeoutMS: 15000 });
    return reading;
  } catch (error) {
    if (error.code === 11000) throw HttpError(409, 'DUPLICATE_READING', 'A reading for this installation and timestamp already exists', null);
    throw error;
  } finally { await session.endSession(); }
}

async function getReading(installationId, readingId) {
  return GenerationReading.findOne({ _id: readingId, installation: installationId });
}

async function lastReading(installationId) {
  return GenerationReading.findOne({ installation: installationId }).sort({ timestamp: -1 });
}

function locationPath(installationId, readingId) {
  return `/api/v1/installations/${idString(installationId)}/readings/${idString(readingId)}`;
}

module.exports = {
  listReadings,
  createReading,
  getReading,
  lastReading,
  locationPath,
  readingInput
};
