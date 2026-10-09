const { freshness, dailyEnergy } = require('../src/utils/readingQuality');
const { startOfColomboDay } = require('../src/utils/sriLankaTime');
const start = new Date('2030-01-01T18:30:00Z'); // 2 January, midnight in Colombo.
const at = minutes => new Date(+start + minutes * 60000);
const row = (minute, counter, id = minute) => ({ _id: String(id), timestamp: at(minute), cumulativeEnergyKwh: counter });

test.each([
  [0, 'fresh'], [29, 'fresh'], [30, 'fresh'], [30.001, 'stale'], [90, 'stale'], [-1, 'future']
])('freshness at age %s minutes is %s', (age, status) => {
  const r = freshness({ timestamp: new Date(+at(120) - age * 60000) }, at(120));
  expect(r.status).toBe(status); expect(r.isStale).toBe(status !== 'fresh');
});
test('missing, invalid and equivalent timezone timestamps are explicit', () => {
  expect(freshness(null).status).toBe('missing');
  expect(freshness({ timestamp: 'invalid' }).status).toBe('invalid');
  expect(freshness({ timestamp: '2030-01-02T00:00:00+05:30' }, start).readingAgeSeconds).toBe(0);
  expect(startOfColomboDay(at(120))).toEqual(start);
});
test.each([
  ['normal', [row(0, 100), row(15, 102), row(30, 105)], 5, 'complete-through-last-reading'],
  ['zero reset', [row(0, 100), row(15, 102), row(30, 0), row(45, 3)], 5, 'partial'],
  ['nonzero reset', [row(0, 100), row(15, 102), row(30, 7), row(45, 10)], 5, 'partial'],
  ['missing midnight', [row(-15, 90), row(15, 102), row(30, 105)], 3, 'partial'],
  ['missing interval', [row(0, 100), row(15, 102), row(45, 110), row(60, 111)], 3, 'partial'],
  ['out of order', [row(30, 105), row(0, 100), row(15, 102)], 5, 'complete-through-last-reading'],
  ['negative invalid', [row(0, 100), row(15, -1), row(30, 105)], 0, 'partial'],
  ['no readings', [], 0, 'partial'],
  ['unproven rollover', [row(0, 9999), row(15, 2), row(30, 3)], 1, 'partial'],
  ['future excluded', [row(0, 100), row(15, 102), row(1000, 900)], 2, 'complete-through-last-reading']
])('energy: %s', (_label, rows, expected, status) => {
  const now = at(rows.some(r => +r.timestamp === +at(60)) ? 60 : rows.some(r => +r.timestamp === +at(45)) ? 45 : 30);
  const result = dailyEnergy(rows, start, now);
  expect(result.energyKwh).toBe(expected); expect(result.quality.status).toBe(status);
});
test('duplicate timestamps are excluded and flagged deterministically', () => {
  const rows = [row(0, 100), row(15, 102, 'a'), row(15, 102, 'b'), row(30, 105)];
  const result = dailyEnergy(rows, start, at(30));
  expect(result.energyKwh).toBe(5); expect(result.quality.reasons).toContain('duplicate-timestamp');
  expect(dailyEnergy([...rows].reverse(), start, at(30))).toEqual(result);
});
test('no cross-day attribution and stopped reporting is partial', () => {
  const result = dailyEnergy([row(-15, 90), row(0, 100), row(15, 102)], start, at(120));
  expect(result.energyKwh).toBe(2); expect(result.quality.reasons).toContain('missing-recent-reading');
});
test('conflicting duplicate counters cannot invent an energy increment', () => {
  const result = dailyEnergy([row(0, 100), row(15, 102, 'a'), row(15, 200, 'b'), row(30, 205)], start, at(30));
  expect(result.energyKwh).toBe(0); expect(result.quality.reasons).toContain('conflicting-duplicate');
});
test('an invalid lone midnight counter is partial', () => {
  expect(dailyEnergy([row(0, -1)], start, start).quality.reasons).toContain('invalid-counter');
});
