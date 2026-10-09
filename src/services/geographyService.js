const { freshness } = require('../utils/readingQuality');
const Province = require('../models/Province');
const District = require('../models/District');
const Substation = require('../models/Substation');
const SolarInstallation = require('../models/SolarInstallation');
const GenerationReading = require('../models/GenerationReading');
const { populateInstallation } = require('../middleware/auth');
const { filterDistrictsQuery, filterSubstationsQuery, filterInstallationsQuery } = require('./accessService');
const { idString } = require('../utils/ids');

async function listProvinces(user) {
  if (user.scope === 'national') return Province.find().sort({ name: 1 });
  if (user.scope === 'province') return Province.find({ _id: user.province }).sort({ name: 1 });
  if (user.scope === 'district') {
    const district = await District.findById(user.district);
    if (!district) return [];
    return Province.find({ _id: district.province }).sort({ name: 1 });
  }
  if (user.scope === 'installation') {
    const installation = await populateInstallation(user.installation);
    const provinceId = installation?.substation?.district?.province?._id || installation?.substation?.district?.province;
    if (!provinceId) return [];
    return Province.find({ _id: provinceId }).sort({ name: 1 });
  }
  return [];
}

async function getProvince(provinceId) {
  return Province.findById(provinceId);
}

async function listDistricts(user, provinceId) {
  const query = await filterDistrictsQuery(user, provinceId);
  return District.find(query).sort({ name: 1 });
}

async function getDistrict(districtId) {
  return District.findById(districtId).populate('province');
}

async function listSubstations(user, districtId) {
  const query = await filterSubstationsQuery(user, districtId);
  return Substation.find(query).sort({ name: 1 });
}

async function getSubstation(substationId) {
  return Substation.findById(substationId).populate('district');
}

async function listInstallations(user, substationId) {
  const query = await filterInstallationsQuery(user, substationId);
  return SolarInstallation.find(query).sort({ name: 1 });
}

async function getInstallation(installationId) {
  return populateInstallation(installationId);
}

async function getComposite(installationId) {
  const installation = await populateInstallation(installationId);
  if (!installation) return null;
  const latestReading = await GenerationReading.findOne({ installation: installation._id }).sort({ timestamp: -1 });
  const installationJson = installation.toJSON();
  delete installationJson.substation;
  return {
    installation: installationJson,
    substation: installation.substation ? {
      id: idString(installation.substation),
      name: installation.substation.name,
      code: installation.substation.code
    } : null,
    district: installation.substation?.district ? {
      id: idString(installation.substation.district),
      name: installation.substation.district.name,
      code: installation.substation.district.code
    } : null,
    province: installation.substation?.district?.province ? {
      id: idString(installation.substation.district.province),
      name: installation.substation.district.province.name,
      code: installation.substation.district.province.code
    } : null,
    latestReading,
    latestReadingFreshness: freshness(latestReading)
  };
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
