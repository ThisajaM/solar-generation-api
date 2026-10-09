const { freshness, dailyEnergy } = require('../utils/readingQuality');
const District = require('../models/District');
const Substation = require('../models/Substation');
const SolarInstallation = require('../models/SolarInstallation');
const { startOfColomboDay } = require('../utils/sriLankaTime');
const { idString } = require('../utils/ids');

async function districtSummary(districtId, now = new Date()) {
  const district = await District.findById(districtId);
  if (!district) return null;

  const substations = await Substation.find({ district: district._id }).select('_id');
  const substationIds = substations.map(s => s._id);
  const installations = await SolarInstallation.find({ substation: { $in: substationIds } }).select('_id');
  const installationIds = installations.map(i => i._id);
  const start = startOfColomboDay(now);

  const rows = await SolarInstallation.aggregate([
    { $match: { _id: { $in: installationIds } } },
    { $lookup: {
      from: 'generationreadings', localField: '_id', foreignField: 'installation',
      pipeline: [{ $match: { timestamp: { $lte: now } } }, { $sort: { timestamp: -1 } }, { $limit: 1 }], as: 'latest'
    } },
    { $lookup: {
      from: 'generationreadings', localField: '_id', foreignField: 'installation',
      pipeline: [{ $match: { timestamp: { $gte: start, $lte: now } } }, { $sort: { timestamp: 1, _id: 1 } }], as: 'today'
    } }
  ]);
  let currentPowerKw = 0;
  let todayEnergyKwh = 0;
  let latestReadingAt = null;
  let lastKnownPowerKw = 0;
  const powerQuality = { freshInstallations: 0, staleInstallations: 0, missingInstallations: 0 };
  const energyQuality = { status: 'complete-through-last-reading', partialInstallations: 0, counterDecreases: 0, gapIntervals: 0, reasons: [] };
  const reasons = new Set();
  for (const row of rows) {
    const last = row.latest[0];
    const state = freshness(last, now);
    if (state.status === 'fresh') { currentPowerKw += last.powerKw; powerQuality.freshInstallations++; }
    else if (last) powerQuality.staleInstallations++;
    else powerQuality.missingInstallations++;
    if (last) {
      lastKnownPowerKw += last.powerKw;
      if (!latestReadingAt || last.timestamp > latestReadingAt) latestReadingAt = last.timestamp;
    }
    const energy = dailyEnergy(row.today, start, now);
    todayEnergyKwh += energy.energyKwh;
    if (energy.quality.status === 'partial') energyQuality.partialInstallations++;
    energyQuality.counterDecreases += energy.quality.counterDecreases;
    energyQuality.gapIntervals += energy.quality.gapIntervals;
    energy.quality.reasons.forEach(reason => reasons.add(reason));
  }
  if (energyQuality.partialInstallations) energyQuality.status = 'partial';
  energyQuality.reasons = [...reasons].sort();

  return {
    district: {
      id: idString(district),
      name: district.name,
      code: district.code
    },
    summary: {
      currentPowerKw: Math.round(currentPowerKw * 100) / 100,
      todayEnergyKwh: Math.round(todayEnergyKwh * 100) / 100,
      lastKnownPowerKw: Math.round(lastKnownPowerKw * 100) / 100,
      powerQuality,
      energyQuality,
      installationCount: installations.length,
      latestReadingAt,
      window: {
        timeZone: 'Asia/Colombo',
        from: start.toISOString(),
        to: new Date(start.getTime() + 86400000).toISOString()
      },
      method: 'Current power includes only fresh non-future readings; lastKnownPowerKw includes stale values. Energy sums non-negative consecutive counter deltas wholly within the Colombo day and no more than one reporting interval apart. Cross-midnight, missing intervals and counter decreases are excluded, never interpolated. Quality describes observed coverage, not an exact whole-day total.'
    }
  };
}

module.exports = { districtSummary };
