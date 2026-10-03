const { paginateItems } = require('../services/collectionService');
const geographyService = require('../services/geographyService');
const { sendError } = require('../utils/http');
const { applyValidators, isNotModified } = require('../utils/etag');

function sendResource(req, res, payload, lastModified) {
  const etag = applyValidators(res, payload, lastModified);
  if (isNotModified(req, etag, lastModified)) return res.status(304).end();
  return res.json(payload);
}

function representationStamp(item) {
  const stamps = [item.updatedAt];
  for (const related of [item.province, item.district, item.substation]) {
    if (related?.updatedAt) stamps.push(representationStamp(related));
  }
  return new Date(Math.max(...stamps.filter(Boolean).map(value => new Date(value).getTime())));
}

function collectionStamp(items, fallback) {
  return items.reduce((latest, item) => {
    const stamp = item.updatedAt || item.createdAt;
    return stamp && stamp > latest ? stamp : latest;
  }, fallback || new Date(0));
}

async function listProvinces(req, res) {
  const items = await geographyService.listProvinces(req.user);
  return sendResource(req, res, paginateItems(req, items), collectionStamp(items));
}

async function getProvince(req, res) {
  const item = await geographyService.getProvince(req.params.provinceId);
  if (!item) return sendError(res, 404, 'NOT_FOUND', 'Province not found', null);
  return sendResource(req, res, { data: item }, representationStamp(item));
}

async function listDistricts(req, res) {
  const province = await geographyService.getProvince(req.params.provinceId);
  if (!province) return sendError(res, 404, 'NOT_FOUND', 'Province not found', null);
  const items = await geographyService.listDistricts(req.user, province._id);
  return sendResource(req, res, paginateItems(req, items), collectionStamp(items, province.updatedAt));
}

async function getDistrict(req, res) {
  const item = await geographyService.getDistrict(req.params.districtId);
  if (!item) return sendError(res, 404, 'NOT_FOUND', 'District not found', null);
  return sendResource(req, res, { data: item }, representationStamp(item));
}

async function listSubstations(req, res) {
  const district = await geographyService.getDistrict(req.params.districtId);
  if (!district) return sendError(res, 404, 'NOT_FOUND', 'District not found', null);
  const items = await geographyService.listSubstations(req.user, district._id);
  return sendResource(req, res, paginateItems(req, items), collectionStamp(items, district.updatedAt));
}

async function getSubstation(req, res) {
  const item = await geographyService.getSubstation(req.params.substationId);
  if (!item) return sendError(res, 404, 'NOT_FOUND', 'Substation not found', null);
  return sendResource(req, res, { data: item }, representationStamp(item));
}

async function listInstallations(req, res) {
  const substation = await geographyService.getSubstation(req.params.substationId);
  if (!substation) return sendError(res, 404, 'NOT_FOUND', 'Substation not found', null);
  const items = await geographyService.listInstallations(req.user, substation._id);
  return sendResource(req, res, paginateItems(req, items), collectionStamp(items, substation.updatedAt));
}

async function getInstallation(req, res) {
  const item = req.authorizedInstallation || await geographyService.getInstallation(req.params.installationId);
  if (!item) return sendError(res, 404, 'NOT_FOUND', 'Installation not found', null);
  return sendResource(req, res, { data: item }, representationStamp(item));
}

async function getComposite(req, res) {
  const payloadData = await geographyService.getComposite(req.params.installationId);
  if (!payloadData) return sendError(res, 404, 'NOT_FOUND', 'Installation not found', null);
  const lastModified = undefined; // Composite dependencies are validated by ETag.
  return sendResource(req, res, { data: payloadData }, lastModified);
}

module.exports = {
  listProvinces,
  getProvince,
  listDistricts,
  getDistrict,
  listSubstations,
  getSubstation,
  listInstallations,
  getInstallation,
  getComposite
};
