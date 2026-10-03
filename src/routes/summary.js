const express = require('express');
const { districtSummary } = require('../controllers/summaryController');
const { asyncHandler } = require('../utils/http');
const { validateObjectIdParam } = require('../utils/validate');
const { authenticate, requireScope, authorizeDistrictRead } = require('../middleware/auth');

const router = express.Router();
router.param('districtId', validateObjectIdParam('districtId'));
router.get('/districts/:districtId/generation-summary', authenticate, requireScope('analyst-read'), authorizeDistrictRead, asyncHandler(districtSummary));

module.exports = router;
