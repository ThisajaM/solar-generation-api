const { execFile } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const { readingInput } = require('../src/services/readingService');
const User = require('../src/models/User');
const SolarInstallation = require('../src/models/SolarInstallation');
const GenerationReading = require('../src/models/GenerationReading');

test('OpenAPI 3 document validates, including all references', async () => {
  // Run the validator with Node's native ESM interoperability, outside Jest 29's loader.
  const result = await promisify(execFile)(process.execPath, [path.resolve(__dirname, '../scripts/validate-openapi.js')]);
  expect(result.stdout).toContain('validated');
});
test.each([NaN, Infinity, -Infinity])('rejects nonfinite power %s', value => {
  expect(() => readingInput({ timestamp: '2026-09-26T00:00:00Z', powerKw: value, cumulativeEnergyKwh: 1, voltage: 230 })).toThrow();
});
test('schema rejects nonfinite stored readings', async () => {
  const reading = new GenerationReading({ installation: 'aaaaaaaaaaaaaaaaaaaaaaaa', timestamp: new Date(), powerKw: Infinity, cumulativeEnergyKwh: 1, voltage: 230 });
  await expect(reading.validate()).rejects.toThrow();
});
test('role and jurisdiction cannot disagree', async () => {
  const user = new User({ name: 'Invalid', email: 'invalid@example.test', passwordHash: 'test', role: 'device', scope: 'national', scopes: ['analyst-read'] });
  await expect(user.validate()).rejects.toThrow();
});
test('installation requires a meter or inverter', async () => {
  const installation = new SolarInstallation({ name: 'Missing identifier', code: 'MISSING', capacityKw: 1, latitude: 7, longitude: 80, substation: 'aaaaaaaaaaaaaaaaaaaaaaaa' });
  await expect(installation.validate()).rejects.toThrow();
});
test('Vercel uses an exported Node handler and packages Swagger assets', () => {
  const config = require('../vercel.json');
  expect(config.framework).toBeNull();
  expect(config.functions['api/index.js'].includeFiles).toContain('swagger-ui-dist');
  expect(config.rewrites[0].destination).toBe('/api');
  expect(typeof require('../api/index')).toBe('function');
});
