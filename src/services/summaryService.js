const District = require('../models/District');
const Substation = require('../models/Substation');
const SolarInstallation = require('../models/SolarInstallation');
const { startOfColomboDay } = require('../utils/sriLankaTime');
const { idString } = require('../utils/ids');

async function districtSummary(districtId) {
  const district = await District.findById(districtId);
  if (!district) return null;

  const substations = await Substation.find({ district: district._id }).select('_id');
  const substationIds = substations.map(s => s._id);
  const installations = await SolarInstallation.find({ substation: { $in: substationIds } }).select('_id');
  const installationIds = installations.map(i => i._id);
  const start = startOfColomboDay(new Date());
  const now = new Date();

  const rows = await SolarInstallation.aggregate([
    { $match: { _id: { $in: installationIds } } },
    { $lookup: {
      from: 'generationreadings', localField: '_id', foreignField: 'installation',
      pipeline: [{ $match: { timestamp: { $lte: now } } }, { $sort: { timestamp: -1 } }, { $limit: 1 }], as: 'latest'
    } },
    { $lookup: {
      from: 'generationreadings', localField: '_id', foreignField: 'installation',
      pipeline: [{ $match: { timestamp: { $lte: start } } }, { $sort: { timestamp: -1 } }, { $limit: 1 }], as: 'baseline'
    } },
    { $lookup: {
      from: 'generationreadings', localField: '_id', foreignField: 'installation',
      pipeline: [{ $match: { timestamp: { $gte: start, $lte: now } } }, { $sort: { timestamp: 1 } }, { $limit: 1 }], as: 'firstToday'
    } }
  ]);
  let currentPowerKw = 0;
  let todayEnergyKwh = 0;
  let latestReadingAt = null;
  for (const row of rows) {
    const last = row.latest[0];
    if (!last) continue;
    currentPowerKw += last.powerKw;
    if (!latestReadingAt || last.timestamp > latestReadingAt) latestReadingAt = last.timestamp;
    const baseline = row.baseline[0] || row.firstToday[0];
    if (last.timestamp >= start && baseline) todayEnergyKwh += Math.max(0, last.cumulativeEnergyKwh - baseline.cumulativeEnergyKwh);
  }

  return {
    district: {
      id: idString(district),
      name: district.name,
      code: district.code
    },
    summary: {
      currentPowerKw: Math.round(currentPowerKw * 100) / 100,
      todayEnergyKwh: Math.round(todayEnergyKwh * 100) / 100,
      installationCount: installations.length,
      latestReadingAt,
      window: {
        timeZone: 'Asia/Colombo',
        from: start.toISOString(),
        to: new Date(start.getTime() + 86400000).toISOString()
      },
      method: 'Power sums the latest reading per installation at or before now (may be stale). Daily energy sums latest minus the last cumulative meter value at or before Colombo midnight; if unavailable, first reading today is the baseline. Negative deltas are clamped to zero. No interpolation; counter resets may undercount. Window.to is exclusive next midnight.'
    }
  };
}

module.exports = { districtSummary };
