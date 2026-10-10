const SolarInstallation = require('../models/SolarInstallation');
const Substation = require('../models/Substation');
const { sameJurisdiction } = require('../middleware/auth');
const { isObjectId } = require('../utils/ids');
const { asFiniteNumber } = require('../utils/validate');
const fail = (status, code, message) => Object.assign(new Error(message), { status, code });
const mutable = ['name', 'capacityKw', 'latitude', 'longitude', 'status'];
const identifiers = ['code', 'meterId', 'inverterId', 'substation'];
function installationInput(body, patch = false) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || !Object.keys(body).length) throw fail(400, 'VALIDATION_ERROR', 'A nonempty JSON object is required');
  const allowed = patch ? mutable : [...mutable, ...identifiers];
  if (Object.keys(body).some(k => !allowed.includes(k))) throw fail(400, 'VALIDATION_ERROR', 'Unknown or immutable installation field');
  const result = {};
  for (const [k, value] of Object.entries(body)) {
    if (['capacityKw', 'latitude', 'longitude'].includes(k)) {
      result[k] = asFiniteNumber(value, k);
      if ((k === 'capacityKw' && value <= 0) || (k === 'latitude' && Math.abs(value) > 90) || (k === 'longitude' && Math.abs(value) > 180)) throw fail(400, 'VALIDATION_ERROR', 'Installation numeric value is out of range');
    } else {
      if (typeof value !== 'string' || !value.trim() || value.length > 120) throw fail(400, 'VALIDATION_ERROR', 'Installation fields must be nonempty strings of at most 120 characters');
      result[k] = value.trim();
    }
  }
  if (result.status && !['active', 'inactive', 'commissioning'].includes(result.status)) throw fail(400, 'VALIDATION_ERROR', 'Use DELETE to archive; status must be active, inactive or commissioning');
  if (!patch && (['code', 'name', 'capacityKw', 'latitude', 'longitude', 'substation'].some(k => result[k] === undefined) || (!result.meterId && !result.inverterId))) throw fail(400, 'VALIDATION_ERROR', 'Required installation fields or meter/inverter identifier are missing');
  if (!patch && !isObjectId(result.substation)) throw fail(400, 'INVALID_ID', 'Invalid substation identifier');
  return result;
}
async function createInstallation(user, body) {
  const input = installationInput(body);
  const substation = await Substation.findById(input.substation).populate({ path: 'district', populate: { path: 'province' } });
  if (!substation) throw fail(404, 'NOT_FOUND', 'Grid substation not found');
  if (!sameJurisdiction(user, { substation })) throw fail(403, 'JURISDICTION_DENIED', 'Grid substation is outside your jurisdiction');
  return SolarInstallation.create(input);
}
async function patchInstallation(id, body) {
  const input = installationInput(body, true);
  const result = await SolarInstallation.findOneAndUpdate({ _id: id, status: { $ne: 'archived' } }, { $set: input }, { new: true, runValidators: true });
  if (!result) throw fail(409, 'INSTALLATION_ARCHIVED', 'Archived installations cannot be changed');
  return result;
}
async function archiveInstallation(id) {
  // Same document is written by transactional ingestion, serializing archive versus POST.
  await SolarInstallation.updateOne({ _id: id, status: { $ne: 'archived' } }, { $set: { status: 'archived', archivedAt: new Date() } });
}
function installationFilters(query) {
  const result = {};
  if (query.status !== undefined) {
    if (!['active', 'inactive', 'commissioning', 'archived'].includes(query.status)) throw fail(400, 'INVALID_PARAMETER', 'Invalid installation status');
    result.status = query.status;
  } else result.status = { $ne: 'archived' };
  if (query.search !== undefined) {
    if (!query.search.trim() || query.search.length > 80) throw fail(400, 'INVALID_PARAMETER', 'search must contain 1 to 80 characters');
    const escaped = query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    result.$or = ['name', 'code', 'meterId', 'inverterId'].map(k => ({ [k]: { $regex: escaped, $options: 'i' } }));
  }
  return result;
}
module.exports = { createInstallation, patchInstallation, archiveInstallation, installationFilters };
