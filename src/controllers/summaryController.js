const { districtSummary } = require('../services/summaryService');
const { sendError } = require('../utils/http');
const { applyValidators, isNotModified } = require('../utils/etag');

async function districtSummaryHandler(req, res) {
  const { reportingWindow, report } = require('../services/reportingService');
  const window = reportingWindow(req.query);
  let data;
  if (window.mode === 'historical') {
    const district = await require('../models/District').findById(req.params.districtId);
    if (!district) return sendError(res, 404, 'NOT_FOUND', 'District not found', null);
    data = { district: { id: String(district._id), name: district.name, code: district.code }, ...await report(req.user, req.query, { districtId: district._id }) };
  } else data = await districtSummary(req.params.districtId);
  if (!data) return sendError(res, 404, 'NOT_FOUND', 'District not found', null);
  const payload = { data };
  const lastModified = undefined; // The calendar window can change without a new reading.
  const etag = applyValidators(res, payload, lastModified);
  if (isNotModified(req, etag, lastModified)) return res.status(304).end();
  return res.json(payload);
}

module.exports = { districtSummary: districtSummaryHandler };
