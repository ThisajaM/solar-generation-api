const { idString } = require('../utils/ids');
const District = require('../models/District');
const Substation = require('../models/Substation');
const SolarInstallation = require('../models/SolarInstallation');

async function filterDistrictsQuery(user, provinceId) {
  const pid = idString(provinceId);
  if (user.scope === 'national') return { province: provinceId };
  if (user.scope === 'province' && idString(user.province) === pid) return { province: provinceId };
  if (user.scope === 'district') {
    const district = await District.findById(user.district);
    if (idString(district?.province) !== pid) return { _id: null };
    return { _id: user.district };
  }
  return { _id: null };
}

async function filterSubstationsQuery(user, districtId) {
  const did = idString(districtId);
  if (user.scope === 'national') return { district: districtId };
  if (user.scope === 'province') {
    const district = await District.findById(districtId);
    if (idString(district?.province) !== idString(user.province)) return { _id: null };
    return { district: districtId };
  }
  if (user.scope === 'district') {
    if (idString(user.district) !== did) return { _id: null };
    return { district: districtId };
  }
  if (user.scope === 'installation') {
    const installation = await SolarInstallation.findById(user.installation);
    const substation = await Substation.findById(installation?.substation);
    if (idString(substation?.district) !== did) return { _id: null };
    return { _id: installation.substation };
  }
  return { _id: null };
}

async function filterInstallationsQuery(user, substationId) {
  const sid = idString(substationId);
  if (user.scope === 'national') return { substation: substationId };
  if (user.scope === 'province') {
    const substation = await Substation.findById(substationId).populate('district');
    if (idString(substation?.district?.province) !== idString(user.province)) return { _id: null };
    return { substation: substationId };
  }
  if (user.scope === 'district') {
    const substation = await Substation.findById(substationId);
    if (idString(substation?.district) !== idString(user.district)) return { _id: null };
    return { substation: substationId };
  }
  if (user.scope === 'installation') {
    const installation = await SolarInstallation.findById(user.installation);
    if (idString(installation?.substation) !== sid) return { _id: null };
    return { _id: user.installation };
  }
  return { _id: null };
}

function assertFilterInsideJurisdiction(user, { provinceId, districtId, substationId }, installation) {
  const substation = installation.substation;
  const district = substation?.district;
  const province = district?.province;
  if (provinceId && idString(province) !== idString(provinceId)) return 'provinceId';
  if (districtId && idString(district) !== idString(districtId)) return 'districtId';
  if (substationId && idString(substation) !== idString(substationId)) return 'substationId';
  if (user.scope === 'province' && provinceId && idString(provinceId) !== idString(user.province)) return 'provinceId';
  if (user.scope === 'district' && districtId && idString(districtId) !== idString(user.district)) return 'districtId';
  return null;
}

module.exports = {
  filterDistrictsQuery,
  filterSubstationsQuery,
  filterInstallationsQuery,
  assertFilterInsideJurisdiction
};
