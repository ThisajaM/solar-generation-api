const { cursorPage } = require('./cursorService');
const District = require('../models/District');
const Substation = require('../models/Substation');
const SolarInstallation = require('../models/SolarInstallation');
const GenerationReading = require('../models/GenerationReading');
const { parsePagination, parseSort, parseIsoDate, validateOptionalObjectIdQuery } = require('../utils/validate');
const { buildPageLinks, paginated } = require('../utils/pagination');

// The permitted hierarchy is computed first; client filters only narrow it.
async function visibleFilters(user, filters = {}) {
  const districtQuery = user.scope === 'national' ? {} : user.scope === 'province' ? { province: user.province } : user.scope === 'district' ? { _id: user.district } : { _id: null };
  if (filters.provinceId) districtQuery.province = districtQuery.province ? { $in: [districtQuery.province].filter(id => String(id) === filters.provinceId) } : filters.provinceId;
  if (filters.districtId) districtQuery._id = districtQuery._id ? { $in: [districtQuery._id].filter(id => String(id) === filters.districtId) } : filters.districtId;
  const districts = await District.find(districtQuery).select('_id');
  const substationQuery = { district: { $in: districts.map(d => d._id) } };
  if (filters.substationId) substationQuery._id = filters.substationId;
  const substations = await Substation.find(substationQuery).select('_id');
  const installationQuery = { substation: { $in: substations.map(s => s._id) } };
  return { districtQuery, substationQuery, installationQuery };
}

async function listCollection(req, kind) {
  validateOptionalObjectIdQuery(req, ['provinceId', 'districtId', 'substationId']);
  const { page, limit } = parsePagination(req.query);
  const { districtQuery, substationQuery, installationQuery } = await visibleFilters(req.user, req.query);
  const models = { districts: District, substations: Substation, installations: SolarInstallation, readings: GenerationReading };
  const model = models[kind];
  let query = { districts: districtQuery, substations: substationQuery, installations: installationQuery }[kind];
  let sort = { name: 1, _id: 1 };
  if (kind === 'readings') {
    const installations = await SolarInstallation.find(installationQuery).select('_id');
    query = { installation: { $in: installations.map(i => i._id) } };
    const from = parseIsoDate(req.query.from, 'from');
    const to = parseIsoDate(req.query.to, 'to');
    if (from && to && from > to) throw Object.assign(new Error('from must be earlier than or equal to to'), { status: 400, code: 'INVALID_PARAMETER' });
    if (from || to) query.timestamp = { ...(from && { $gte: from }), ...(to && { $lte: to }) };
    const direction = parseSort(req.query.sort).startsWith('-') ? -1 : 1;
    sort = { timestamp: direction, _id: direction };
  }
  if (kind === 'readings' && req.query.pagination === 'cursor') return cursorPage(req, model, query, limit, sort.timestamp);
  const total = await model.countDocuments(query);
  const data = await model.find(query).sort(sort).skip((page - 1) * limit).limit(limit);
  const pages = Math.ceil(total / limit);
  return paginated({ data, total, page, limit, links: buildPageLinks(req, { page, limit, pages }) });
}

function paginateItems(req, items) {
  const { page, limit } = parsePagination(req.query);
  const total = items.length;
  const pages = Math.ceil(total / limit);
  return paginated({ data: items.slice((page - 1) * limit, page * limit), total, page, limit, links: buildPageLinks(req, { page, limit, pages }) });
}

module.exports = { listCollection, paginateItems };
