const express = require('express');
const controller = require('../controllers/readingController');
const { asyncHandler } = require('../utils/http');
const { validateObjectIdParam } = require('../utils/validate');
const { authenticate, requireScope, authorizeInstallationRead, deviceOwnsInstallation } = require('../middleware/auth');

const router = express.Router();
router.param('installationId', validateObjectIdParam('installationId'));
router.param('readingId', validateObjectIdParam('readingId'));

router.get('/installations/:installationId/readings', authenticate, requireScope('analyst-read', 'installation-write'), authorizeInstallationRead, asyncHandler(controller.listReadings));
router.post('/installations/:installationId/readings', authenticate, requireScope('installation-write'), deviceOwnsInstallation, asyncHandler(controller.createReading));
router.get('/installations/:installationId/readings/:readingId', authenticate, requireScope('analyst-read', 'installation-write'), authorizeInstallationRead, asyncHandler(controller.getReading));
router.get('/installations/:installationId/last-reading', authenticate, requireScope('analyst-read', 'installation-write'), authorizeInstallationRead, asyncHandler(controller.lastReading));

module.exports = router;
