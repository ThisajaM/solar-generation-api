const GenerationReading = require('../models/GenerationReading');
const SolarInstallation = require('../models/SolarInstallation');
const { visibleFilters } = require('./collectionService');
const { parseIsoDate, validateOptionalObjectIdQuery } = require('../utils/validate');
const { startOfColomboDay } = require('../utils/sriLankaTime');
const { energyCoverage } = require('../utils/energyCoverage');
const { freshness } = require('../utils/readingQuality');
const fail = message => Object.assign(new Error(message), { status: 400, code: 'INVALID_PARAMETER' });
function reportingWindow(query, now = new Date()) {
  const mode = query.mode || 'live';
  if (!['live', 'historical'].includes(mode)) throw fail('mode must be live or historical');
  if (mode === 'live') {
    if (query.date || query.from || query.to) throw fail('Date parameters require mode=historical');
    return { mode, from: startOfColomboDay(now), to: now };
  }
  let from; let to;
  if (query.date !== undefined) {
    if (query.from || query.to || !/^\d{4}-\d{2}-\d{2}$/.test(query.date)) throw fail('Use either date=YYYY-MM-DD or from and to');
    from = parseIsoDate(`${query.date}T00:00:00+05:30`, 'date'); to = new Date(+from + 86400000);
  } else {
    if (!query.from || !query.to) throw fail('Historical mode requires date or both from and to');
    from = parseIsoDate(query.from, 'from'); to = parseIsoDate(query.to, 'to');
  }
  if (+to <= +from || +to - +from > 31 * 86400000 || +to > +now) throw fail('Historical window must be positive, no more than 31 days, and end at or before server time');
  return { mode, from, to };
}
async function report(user, query, options = {}, now = new Date()) {
  const window = reportingWindow(query, now);
  validateOptionalObjectIdQuery({ query }, ['provinceId', 'districtId', 'substationId']);
  let filter;
  if (options.installation) filter = { _id: options.installation._id };
  else {
    const filters = { ...query, ...(options.districtId && { districtId: String(options.districtId) }) };
    filter = (await visibleFilters(user, filters)).installationQuery;
  }
  if (window.mode === 'live') filter.status = { $ne: 'archived' };
  const installations = await SolarInstallation.find(filter).select('_id');
  const ids = installations.map(i => i._id);
  const readingQuery = { installation: { $in: ids }, timestamp: { $gte: window.from, $lte: window.to } };
  const rows = await GenerationReading.find(readingQuery).sort({ installation: 1, timestamp: 1, _id: 1 }).limit(150001).maxTimeMS(8000).lean();
  if (rows.length > 150000) throw Object.assign(new Error('Narrow the reporting range or geographical scope to at most 150000 readings'), { status: 422, code: 'REPORT_TOO_LARGE' });
  const groups = new Map(ids.map(id => [String(id), []]));
  for (const row of rows) groups.get(String(row.installation)).push(row);
  const perInstallation = ids.map(id => ({ installationId: String(id), ...energyCoverage(groups.get(String(id)), window.from, window.to) }));
  const sum = key => perInstallation.reduce((total, item) => total + item[key], 0);
  const available = perInstallation.some(i => i.qualityStatus !== 'unavailable');
  const isComplete = perInstallation.length > 0 && perInstallation.every(i => i.isComplete);
  const energyQuality = { coveragePercent: perInstallation.length ? Math.floor(sum('coveragePercent') / perInstallation.length * 100) / 100 : 0,
    expectedReadings: sum('expectedReadings'), actualReadings: sum('actualReadings'), missingIntervals: sum('missingIntervals'),
    hasMeterReset: perInstallation.some(i => i.hasMeterReset), hasCounterDecrease: perInstallation.some(i => i.hasCounterDecrease),
    isComplete, qualityStatus: isComplete ? 'complete' : available ? 'partial' : 'unavailable', measurementType: 'measured', estimatedEnergyKwh: null };
  const summary = { mode: window.mode, energyKwh: Math.round(sum('energyKwh') * 100) / 100, energyQuality, installationCount: ids.length,
    window: { from: window.from.toISOString(), to: window.to.toISOString(), timeZone: 'Asia/Colombo', boundaryPolicy: 'Counter intervals have both endpoints inside [from,to]; adjacent windows share only a baseline, never an interval.' } };
  if (window.mode === 'live') {
    const latest = await GenerationReading.aggregate([{ $match: { installation: { $in: ids }, timestamp: { $lte: now } } }, { $sort: { installation: 1, timestamp: -1 } }, { $group: { _id: '$installation', reading: { $first: '$$ROOT' } } }]).option({ maxTimeMS: 8000 });
    summary.currentPowerKw = latest.filter(r => freshness(r.reading, now).status === 'fresh').reduce((n, r) => n + r.reading.powerKw, 0);
    summary.freshInstallations = latest.filter(r => freshness(r.reading, now).status === 'fresh').length;
    summary.staleInstallations = latest.length - summary.freshInstallations; summary.missingInstallations = ids.length - latest.length;
  }
  return { summary, installations: perInstallation };
}
module.exports = { reportingWindow, report };
