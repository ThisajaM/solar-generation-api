const express = require('express');
const controller = require('../controllers/geographyController');
const { asyncHandler } = require('../utils/http');
const { validateObjectIdParam } = require('../utils/validate');
const {
  authenticate,
  requireScope,
  authorizeProvinceRead,
  authorizeDistrictRead,
  authorizeSubstationRead,
  authorizeInstallationRead
} = require('../middleware/auth');

const { listCollection } = require('../services/collectionService');
const { applyValidators, isNotModified } = require('../utils/etag');
const router = express.Router();
for (const kind of ['districts', 'substations', 'installations', 'readings']) {
  router.get(`/${kind}`, authenticate, requireScope('analyst-read'), asyncHandler(async (req, res) => {
    const payload = await listCollection(req, kind);
    const etag = applyValidators(res, payload);
    if (isNotModified(req, etag)) return res.status(304).end();
    return res.json(payload);
  }));
}
router.param('provinceId', validateObjectIdParam('provinceId'));
router.param('districtId', validateObjectIdParam('districtId'));
router.param('substationId', validateObjectIdParam('substationId'));
router.param('installationId', validateObjectIdParam('installationId'));

router.get('/provinces', authenticate, requireScope('analyst-read'), asyncHandler(controller.listProvinces));
router.get('/provinces/:provinceId', authenticate, requireScope('analyst-read'), authorizeProvinceRead, asyncHandler(controller.getProvince));
router.get('/provinces/:provinceId/districts', authenticate, requireScope('analyst-read'), authorizeProvinceRead, asyncHandler(controller.listDistricts));
router.get('/districts/:districtId', authenticate, requireScope('analyst-read'), authorizeDistrictRead, asyncHandler(controller.getDistrict));
router.get('/districts/:districtId/substations', authenticate, requireScope('analyst-read'), authorizeDistrictRead, asyncHandler(controller.listSubstations));
router.get('/substations/:substationId', authenticate, requireScope('analyst-read'), authorizeSubstationRead, asyncHandler(controller.getSubstation));
router.get('/substations/:substationId/installations', authenticate, requireScope('analyst-read'), authorizeSubstationRead, asyncHandler(controller.listInstallations));
router.get('/installations/:installationId', authenticate, requireScope('analyst-read', 'installation-write'), authorizeInstallationRead, asyncHandler(controller.getInstallation));
router.get('/installations/:installationId/composite', authenticate, requireScope('analyst-read', 'installation-write'), authorizeInstallationRead, asyncHandler(controller.getComposite));

module.exports = router;
