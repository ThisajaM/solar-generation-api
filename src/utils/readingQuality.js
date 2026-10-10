const { freshnessSeconds, reportingIntervalSeconds } = require('../config/env');

function freshness(reading, now = new Date(), threshold = freshnessSeconds) {
  const time = reading ? new Date(reading.timestamp).getTime() : NaN;
  const age = Number.isFinite(time) ? (now.getTime() - time) / 1000 : null;
  const status = !reading ? 'missing' : age === null ? 'invalid' : age < 0 ? 'future' : age > threshold ? 'stale' : 'fresh';
  return { readingTimestamp: Number.isFinite(time) ? new Date(time).toISOString() : null,
    readingAgeSeconds: age === null ? null : Math.floor(age), isStale: status !== 'fresh', status, freshnessThresholdSeconds: threshold };
}

// Only observed, non-decreasing intervals wholly inside the day are attributed.
// A decrease is ambiguous (reset, rollover or bad data), so its interval is excluded.
function dailyEnergy(readings, start, now, interval = reportingIntervalSeconds) {
  const rows = readings.filter(r => +new Date(r.timestamp) >= +start && +new Date(r.timestamp) <= +now)
    .sort((a, b) => +new Date(a.timestamp) - +new Date(b.timestamp) || String(a._id).localeCompare(String(b._id)));
  let energy = 0;
  const reasons = new Set();
  const ambiguousTimes = new Set();
  const countersByTime = new Map();
  for (const row of rows) {
    const time = +new Date(row.timestamp);
    if (!Number.isFinite(row.cumulativeEnergyKwh) || row.cumulativeEnergyKwh < 0) reasons.add('invalid-counter');
    if (countersByTime.has(time) && countersByTime.get(time) !== row.cumulativeEnergyKwh) ambiguousTimes.add(time);
    countersByTime.set(time, row.cumulativeEnergyKwh);
  }
  if (ambiguousTimes.size) reasons.add('conflicting-duplicate');
  let decreases = 0; let gaps = 0; let acceptedIntervals = 0; let coveredMilliseconds = 0;
  if (!rows.length || +new Date(rows[0].timestamp) !== +start) reasons.add('missing-midnight-baseline');
  for (let i = 1; i < rows.length; i++) {
    const previous = rows[i - 1]; const current = rows[i];
    const elapsed = (+new Date(current.timestamp) - +new Date(previous.timestamp)) / 1000;
    const delta = current.cumulativeEnergyKwh - previous.cumulativeEnergyKwh;
    if (elapsed <= 0) { reasons.add('duplicate-timestamp'); continue; }
    if (ambiguousTimes.has(+new Date(previous.timestamp)) || ambiguousTimes.has(+new Date(current.timestamp))) continue;
    if (![previous.cumulativeEnergyKwh, current.cumulativeEnergyKwh].every(v => Number.isFinite(v) && v >= 0)) { reasons.add('invalid-counter'); continue; }
    if (delta < 0) { decreases++; reasons.add('counter-decrease'); continue; }
    if (elapsed > interval) { gaps++; reasons.add('missing-intervals'); continue; }
    energy += delta; acceptedIntervals++; coveredMilliseconds += elapsed * 1000;
  }
  const last = rows.at(-1);
  if (!last || (+now - +new Date(last.timestamp)) / 1000 > interval) reasons.add('missing-recent-reading');
  return { energyKwh: energy, quality: { status: reasons.size ? 'partial' : 'complete-through-last-reading',
    reasons: [...reasons].sort(), counterDecreases: decreases, gapIntervals: gaps, acceptedIntervals,
    coveredMilliseconds, actualReadings: countersByTime.size,
    observedThrough: last ? new Date(last.timestamp).toISOString() : null } };
}
module.exports = { freshness, dailyEnergy };
