const { dailyEnergy } = require('./readingQuality');
const { reportingIntervalSeconds } = require('../config/env');
// No interpolation: coverage counts only consecutive, valid observed counter intervals.
function energyCoverage(readings, from, to) {
  const result = dailyEnergy(readings, from, to);
  const q = result.quality;
  const reasons = q.reasons.map(r => r === 'missing-midnight-baseline' ? 'missing-window-baseline' : r === 'missing-recent-reading' ? 'missing-end-boundary' : r);
  if (q.observedThrough && +new Date(q.observedThrough) < +to && !reasons.includes('missing-end-boundary')) reasons.push('missing-end-boundary');
  const duration = Math.max(0, +to - +from);
  const expectedIntervals = Math.ceil(duration / (reportingIntervalSeconds * 1000));
  const isComplete = duration > 0 && q.coveredMilliseconds === duration && q.reasons.length === 0;
  return { energyKwh: result.energyKwh, coveragePercent: duration ? Math.floor(10000 * q.coveredMilliseconds / duration) / 100 : 0,
    expectedReadings: expectedIntervals + 1, actualReadings: q.actualReadings,
    missingIntervals: Math.ceil(Math.max(0, duration - q.coveredMilliseconds) / (reportingIntervalSeconds * 1000)),
    hasMeterReset: q.counterDecreases > 0, hasCounterDecrease: q.counterDecreases > 0,
    isComplete, qualityStatus: isComplete ? 'complete' : q.acceptedIntervals ? 'partial' : 'unavailable',
    measurementType: 'measured', estimatedEnergyKwh: null, reasons, counterDecreases: q.counterDecreases };
}
module.exports = { energyCoverage };
