const { energyCoverage } = require('../src/utils/energyCoverage');
const { reportingWindow } = require('../src/services/reportingService');
const from = new Date('2026-10-01T18:30:00Z');
const row = (minute, cumulativeEnergyKwh, id = minute) => ({ _id: id, timestamp: new Date(+from + minute * 60000), cumulativeEnergyKwh });
test.each([
  ['continuous', [row(0,100),row(15,105),row(30,109)],9,100,'complete',0],
  ['zero generation', [row(0,100),row(15,100),row(30,100)],0,100,'complete',0],
  ['missing interval', [row(0,100),row(30,109)],0,0,'unavailable',2],
  ['missing boundary', [row(15,105),row(30,109)],4,50,'partial',1],
  ['reset', [row(0,100),row(15,0),row(30,4)],4,50,'partial',1],
  ['nonzero reset', [row(0,100),row(15,2),row(30,6)],4,50,'partial',1],
  ['out of order', [row(30,109),row(0,100),row(15,105)],9,100,'complete',0],
  ['identical duplicate', [row(0,100),row(15,105,'a'),row(15,105,'b'),row(30,109)],9,100,'partial',0],
  ['conflicting duplicate', [row(0,100),row(15,105,'a'),row(15,500,'b'),row(30,109)],0,0,'unavailable',2],
  ['no readings', [],0,0,'unavailable',2]
])('measured coverage: %s', (_label, rows, expected, percent, quality, missing) => {
  const result = energyCoverage(rows,from,new Date(+from+30*60000));
  expect(result.energyKwh).toBe(expected); expect(result.coveragePercent).toBe(percent);
  expect(result.qualityStatus).toBe(quality); expect(result.missingIntervals).toBe(missing);
  expect(result.expectedReadings).toBe(3); expect(result.estimatedEnergyKwh).toBeNull();
});
test('multiple resets preserve only justified increments', () => {
  const r=energyCoverage([row(0,100),row(15,0),row(30,4),row(45,1),row(60,3)],from,new Date(+from+3600000));
  expect(r.energyKwh).toBe(6); expect(r.counterDecreases).toBe(2); expect(r.coveragePercent).toBe(50);expect(r.hasMeterReset).toBe(true);
});
test('adjacent windows share a baseline without double counting', () => {
  const rows=[row(0,100),row(15,105),row(30,109)];const middle=new Date(+from+900000),end=new Date(+from+1800000);
  expect(energyCoverage(rows,from,middle).energyKwh+energyCoverage(rows,middle,end).energyKwh).toBe(9);
});
test('a 31-day zero-generation window is completely measured', () => {
  const rows=Array.from({length:31*96+1},(_,n)=>row(n*15,100));
  const r=energyCoverage(rows,from,new Date(+from+31*86400000));expect(r.energyKwh).toBe(0);expect(r.isComplete).toBe(true);expect(r.coveragePercent).toBe(100);
});
test('Colombo day boundaries stay UTC+05:30 through northern DST dates', () => {
  for(const date of ['2026-03-29','2026-10-25']) {
    const w=reportingWindow({mode:'historical',date},new Date('2027-01-01T00:00:00Z'));
    expect(+w.to-+w.from).toBe(86400000);expect(w.from.toISOString().slice(11)).toBe('18:30:00.000Z');
  }
});
test.each([{}, {from:'invalid',to:'2026-10-02T00:00:00Z'}, {date:'2026-02-30'}, {date:'2026-10-02',from:'2026-10-01T00:00:00Z'}, {from:'2026-01-01T00:00:00Z',to:'2026-10-02T00:00:00Z'}, {from:'2026-10-02T00:00:00Z',to:'2026-10-01T00:00:00Z'}, {date:'2099-01-01'}])('invalid historical window %j', query => {
 expect(()=>reportingWindow({mode:'historical',...query},new Date('2026-10-10T00:00:00Z'))).toThrow();
});
test('bursty samples cannot conceal a long missing interval',()=>{
  const r=energyCoverage([row(0,100),row(1,101),row(2,102),row(30,105)],from,new Date(+from+1800000));
  expect(r.energyKwh).toBe(2);expect(r.coveragePercent).toBe(6.66);expect(r.missingIntervals).toBe(2);expect(r.isComplete).toBe(false);
});
