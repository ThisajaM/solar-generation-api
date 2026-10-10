const express = require('express');
const { districtSummary } = require('../controllers/summaryController');
const { asyncHandler } = require('../utils/http');
const { validateObjectIdParam } = require('../utils/validate');
const { authenticate, requireScope, authorizeDistrictRead, authorizeInstallationRead } = require('../middleware/auth');

const router = express.Router();
router.param('districtId', validateObjectIdParam('districtId'));
router.get('/districts/:districtId/generation-summary', authenticate, requireScope('analyst-read'), authorizeDistrictRead, asyncHandler(districtSummary));

router.param('installationId', validateObjectIdParam('installationId'));
const { report } = require('../services/reportingService');
const { applyValidators, isNotModified } = require('../utils/etag');
async function serveReport(req, res) {
  const payload = { data: await report(req.user, req.query, { installation: req.authorizedInstallation }) };
  const etag = applyValidators(res, payload);
  if (isNotModified(req, etag)) return res.status(304).end();
  return res.json(payload);
}
router.get('/generation-summary', authenticate, requireScope('analyst-read'), asyncHandler(serveReport));
router.get('/installations/:installationId/generation-summary', authenticate, requireScope('analyst-read', 'installation-write'), authorizeInstallationRead, asyncHandler(serveReport));
module.exports = router;
