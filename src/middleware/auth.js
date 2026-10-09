const { sendError, asyncHandler } = require('../utils/http');
const { idString, isObjectId } = require('../utils/ids');
const User = require('../models/User');
const District = require('../models/District');
const Substation = require('../models/Substation');
const SolarInstallation = require('../models/SolarInstallation');
const { jwtSecret } = require('../config/env');
const jwt = require('jsonwebtoken');

const authenticate = asyncHandler(async (req, res, next) => {
  const header = req.get('Authorization');
  if (!header || !header.startsWith('Bearer ')) {
    return sendError(res, 401, 'AUTHENTICATION_REQUIRED', 'Bearer authentication is required', null);
  }
  const token = header.slice(7);
  let payload;
  try {
    payload = jwt.verify(token, jwtSecret, { algorithms: ['HS256'] });
    if (!isObjectId(payload.sub) || !Number.isInteger(payload.exp) || !Number.isInteger(payload.iat) || payload.exp <= payload.iat || payload.iat > Date.now() / 1000 + 60 || typeof payload.role !== 'string' || !Array.isArray(payload.scopes) || !payload.scopes.length || payload.scopes.some(s => typeof s !== 'string') || payload.scope !== payload.scopes[0]) throw new Error('Invalid claims');
  } catch {
    return sendError(res, 401, 'INVALID_TOKEN', 'The bearer token is invalid or expired', null);
  }
  const user = await User.findById(payload.sub);
  if (!user || !user.active || payload.role !== user.role || JSON.stringify([...payload.scopes].sort()) !== JSON.stringify([...user.scopes].sort()) || (user.role === 'device' && payload.installationId !== idString(user.installation))) {
    return sendError(res, 401, 'INVALID_TOKEN', 'Token subject is inactive, invalid or reassigned', null);
  }
  if ((user.scope === 'province' && payload.provinceId !== idString(user.province)) || (user.scope === 'district' && payload.districtId !== idString(user.district))) return sendError(res, 401, 'INVALID_TOKEN', 'Token jurisdiction has changed', null);
  req.user = user;
  req.tokenPayload = payload;
  return next();
});

function requireScope(...requiredScopes) {
  return (req, res, next) => {
    const granted = req.user?.scopes || [];
    if (!requiredScopes.some(scope => granted.includes(scope))) {
      return sendError(res, 403, 'INSUFFICIENT_SCOPE', 'The token does not have the required scope', { requiredScopes });
    }
    next();
  };
}

function deviceOwnsInstallation(req, res, next) {
  if (req.user?.role !== 'device' || idString(req.user.installation) !== req.params.installationId) {
    return sendError(res, 403, 'INSTALLATION_SCOPE_DENIED', 'A device can only access its own installation', null);
  }
  next();
}

function sameJurisdiction(user, installation) {
  if (!user) return false;
  if (user.scope === 'national' || user.role === 'national-analyst') return true;
  if (user.scope === 'installation' || user.role === 'device') {
    return idString(user.installation) === idString(installation._id || installation);
  }
  const substation = installation.substation;
  const district = substation?.district;
  const province = district?.province;
  if (user.scope === 'district' || user.role === 'district-analyst') {
    return idString(user.district) === idString(district);
  }
  if (user.scope === 'province' || user.role === 'province-analyst') {
    return idString(user.province) === idString(province);
  }
  return false;
}

async function populateInstallation(installationId) {
  return SolarInstallation.findById(installationId)
    .populate({ path: 'substation', populate: { path: 'district', populate: { path: 'province' } } });
}

async function authorizeProvinceRead(req, res, next) {
  try {
    if (req.user.scope === 'national') return next();
    if (req.user.scope === 'province' && idString(req.user.province) === req.params.provinceId) return next();
    if (req.user.scope === 'district') {
      const district = await District.findById(req.user.district);
      if (idString(district?.province) === req.params.provinceId) return next();
    }
    if (req.user.scope === 'installation') {
      const installation = await populateInstallation(req.user.installation);
      const provinceId = idString(installation?.substation?.district?.province);
      if (provinceId === req.params.provinceId) return next();
    }
    return sendError(res, 403, 'JURISDICTION_DENIED', 'The requested province is outside your jurisdiction', null);
  } catch (error) {
    next(error);
  }
}

async function authorizeDistrictRead(req, res, next) {
  try {
    if (req.user.scope === 'national') return next();
    const district = await District.findById(req.params.districtId);
    if (!district) return sendError(res, 404, 'NOT_FOUND', 'District not found', null);
    if (req.user.scope === 'province' && idString(req.user.province) === idString(district.province)) return next();
    if (req.user.scope === 'district' && idString(req.user.district) === req.params.districtId) return next();
    if (req.user.scope === 'installation') {
      const installation = await populateInstallation(req.user.installation);
      if (idString(installation?.substation?.district) === req.params.districtId) return next();
    }
    return sendError(res, 403, 'JURISDICTION_DENIED', 'The requested district is outside your jurisdiction', null);
  } catch (error) {
    next(error);
  }
}

async function authorizeSubstationRead(req, res, next) {
  try {
    if (req.user.scope === 'national') return next();
    const substation = await Substation.findById(req.params.substationId);
    if (!substation) return sendError(res, 404, 'NOT_FOUND', 'Substation not found', null);
    const district = await District.findById(substation.district);
    if (req.user.scope === 'province' && idString(req.user.province) === idString(district.province)) return next();
    if (req.user.scope === 'district' && idString(req.user.district) === idString(district._id)) return next();
    if (req.user.scope === 'installation') {
      const installation = await populateInstallation(req.user.installation);
      if (idString(installation?.substation) === req.params.substationId) return next();
    }
    return sendError(res, 403, 'JURISDICTION_DENIED', 'The requested substation is outside your jurisdiction', null);
  } catch (error) {
    next(error);
  }
}

async function authorizeInstallationRead(req, res, next) {
  try {
    if (req.user.role === 'device' && idString(req.user.installation) !== req.params.installationId) {
      return sendError(res, 403, 'INSTALLATION_SCOPE_DENIED', 'A device can only access its own installation', null);
    }
    const installation = await populateInstallation(req.params.installationId);
    if (!installation) return sendError(res, 404, 'NOT_FOUND', 'Installation not found', null);
    if (!sameJurisdiction(req.user, installation)) {
      return sendError(res, 403, 'JURISDICTION_DENIED', 'The requested installation is outside your jurisdiction', null);
    }
    req.authorizedInstallation = installation;
    next();
  } catch (error) {
    next(error);
  }
}

module.exports = {
  authenticate,
  requireScope,
  deviceOwnsInstallation,
  authorizeProvinceRead,
  authorizeDistrictRead,
  authorizeSubstationRead,
  authorizeInstallationRead,
  sameJurisdiction,
  populateInstallation
};
