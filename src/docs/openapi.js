const ref = name => ({ $ref: `#/components/schemas/${name}` });
const str = { type: 'string' };
const id = { type: 'string', pattern: '^[a-f0-9]{24}$' };
const date = { type: 'string', format: 'date-time' };
const num = { type: 'number', minimum: 0 };
const object = properties => ({ type: 'object', properties });
const base = { id, name: str, code: str, createdAt: date, updatedAt: date };
const nullable = schema => ({ ...schema, nullable: true });
const resource = name => object({ data: ref(name) });
const collection = name => object({ data: { type: 'array', items: ref(name) }, meta: ref('Page'), links: ref('Links') });
const json = schema => ({ content: { 'application/json': { schema } } });
const error = description => ({ description, ...json(ref('Error')) });
const validators = { ETag: { schema: str, description: 'Representation hash. Supports weak comparison for If-None-Match.' }, 'Last-Modified': { schema: str, description: 'HTTP date, where a reliable modification time is available. Omitted for reading collections, composite and summary.' } };
const query = (name, schema, description) => ({ name, in: 'query', schema, description });
const pagination = [query('page', { type: 'integer', minimum: 1, default: 1 }), query('limit', { type: 'integer', minimum: 1, maximum: 100, default: 50 })];
const filters = ['provinceId', 'districtId', 'substationId'].map(name => query(name, id, 'Narrows the server-enforced jurisdiction; never expands access.'));
const history = [...pagination, ...filters, query('sort', { type: 'string', enum: ['timestamp', '-timestamp'], default: '-timestamp' }), query('from', date, 'Inclusive timestamp lower bound.'), query('to', date, 'Inclusive timestamp upper bound; must be >= from.')];
const conditional = [
  { name: 'If-None-Match', in: 'header', schema: str, description: 'Matching tag, weak tag or * returns bodyless 304; takes precedence over If-Modified-Since.' },
  { name: 'If-Modified-Since', in: 'header', schema: str, description: 'HTTP-date; used only where Last-Modified is supplied.' },
  { name: 'If-Match', in: 'header', schema: str, description: 'Strong comparison on GET; a mismatch returns 412.' }
];
const errors = { 400: error('Invalid input'), 401: error('Missing, expired or invalid JWT'), 403: error('Scope or jurisdiction denied'), 404: error('Resource not found'), 406: error('Accept excludes application/json'), 429: error('Rate limit exceeded'), 500: error('Internal error'), 503: error('Database unavailable') };
const schemas = {
  Error: object({ error: { ...object({ code: str, message: str, detail: { nullable: true, description: 'Optional diagnostic field/value object, string, or array; never a stack trace.' } }), required: ['code', 'message', 'detail'] } }),
  Page: object({ total: { type: 'integer' }, page: { type: 'integer' }, limit: { type: 'integer' }, pages: { type: 'integer' } }),
  Links: object({ self: str, next: nullable(str), previous: nullable(str) }),
  Province: object(base),
  District: object({ ...base, province: { oneOf: [id, ref('Province')] } }),
  Substation: object({ ...base, district: { oneOf: [id, ref('District')] }, location: object({ type: { type: 'string', enum: ['Point'] }, coordinates: { type: 'array', items: { type: 'number' }, description: '[longitude, latitude]' } }) }),
  SolarInstallation: object({ ...base, meterId: str, inverterId: str, capacityKw: num, latitude: { type: 'number' }, longitude: { type: 'number' }, status: { type: 'string', enum: ['active', 'inactive', 'commissioning'] }, substation: { oneOf: [id, ref('Substation')] } }),
  ReadingInput: { ...object({ timestamp: date, powerKw: num, cumulativeEnergyKwh: num, voltage: num, frequencyHz: { ...num, default: 50 } }), required: ['timestamp', 'powerKw', 'cumulativeEnergyKwh', 'voltage'], additionalProperties: false },
  GenerationReading: object({ id, installation: id, timestamp: date, powerKw: num, cumulativeEnergyKwh: num, voltage: num, frequencyHz: num, createdAt: date, updatedAt: date }),
  Composite: object({ installation: ref('SolarInstallation'), substation: nullable(object({ id, name: str, code: str })), district: nullable(object({ id, name: str, code: str })), province: nullable(object({ id, name: str, code: str })), latestReading: { allOf: [ref('GenerationReading')], nullable: true } }),
  User: object({ id, name: str, email: { type: 'string', format: 'email' }, role: { type: 'string', enum: ['national-analyst', 'province-analyst', 'district-analyst', 'device'] }, scope: { type: 'string', enum: ['national', 'province', 'district', 'installation'] }, scopes: { type: 'array', items: str }, province: nullable(id), district: nullable(id), substation: nullable(id), installation: nullable(id), active: { type: 'boolean' } }),
  Login: object({ tokenType: { type: 'string', enum: ['Bearer'] }, expiresIn: str, token: str, user: ref('User') }),
  DistrictSummary: object({ district: object({ id, name: str, code: str }), summary: object({ currentPowerKw: num, todayEnergyKwh: num, installationCount: { type: 'integer' }, latestReadingAt: nullable(date), window: object({ timeZone: str, from: date, to: date }), method: str }) }),
  Health: object({ status: { type: 'string', enum: ['ok', 'degraded'] }, database: { type: 'string', enum: ['connected', 'unavailable'] }, version: str }),
  Api: object({ name: str, version: str, docs: str })
};
const paths = {};
function read(path, summary, schema, parameters = [], device = false) {
  const pathParams = [...path.matchAll(/\{(\w+)\}/g)].map(match => ({ name: match[1], in: 'path', required: true, schema: id }));
  paths[path] = { get: {
    tags: [path.includes('readings') || path.includes('last-reading') ? 'Readings' : 'Resources'], summary,
    description: `${device ? 'Analysts within their jurisdiction and the owning device.' : 'Analysts only, restricted to their jurisdiction.'} JSON field names use camelCase (powerKw, cumulativeEnergyKwh, meterId/inverterId).`,
    parameters: [...pathParams, ...parameters, ...conditional],
    responses: { 200: { description: 'Success', headers: validators, ...json(schema) }, 304: { description: 'Not modified; empty body', headers: validators }, 412: error('If-Match precondition failed'), ...errors }
  } };
}
read('/api/v1/provinces', 'Visible provinces', collection('Province'), pagination);
read('/api/v1/provinces/{provinceId}', 'Province', resource('Province'));
read('/api/v1/provinces/{provinceId}/districts', 'Visible districts in province', collection('District'), pagination);
read('/api/v1/districts', 'Visible districts', collection('District'), [...pagination, filters[0]]);
read('/api/v1/districts/{districtId}', 'District with province', resource('District'));
read('/api/v1/districts/{districtId}/substations', 'Substations in district', collection('Substation'), pagination);
read('/api/v1/districts/{districtId}/generation-summary', 'District power and daily cumulative energy delta', resource('DistrictSummary'));
read('/api/v1/substations', 'Visible substations', collection('Substation'), [...pagination, ...filters.slice(0, 2)]);
read('/api/v1/substations/{substationId}', 'Substation with district', resource('Substation'));
read('/api/v1/substations/{substationId}/installations', 'Installations at substation', collection('SolarInstallation'), pagination);
read('/api/v1/installations', 'Visible installations', collection('SolarInstallation'), [...pagination, ...filters]);
read('/api/v1/installations/{installationId}', 'Installation with hierarchy', resource('SolarInstallation'), [], true);
read('/api/v1/installations/{installationId}/composite', 'Installation, ancestors and latest reading', resource('Composite'), [], true);
read('/api/v1/installations/{installationId}/last-reading', 'Most recent historical record by timestamp', resource('GenerationReading'), [], true);
read('/api/v1/readings', 'Visible historical readings across installations', collection('GenerationReading'), history);
read('/api/v1/installations/{installationId}/readings', 'Installation historical readings', collection('GenerationReading'), history, true);
read('/api/v1/installations/{installationId}/readings/{readingId}', 'One immutable reading', resource('GenerationReading'), [], true);
paths['/api/v1/installations/{installationId}/readings'].post = {
  tags: ['Readings'], summary: 'Append a reading (owning device only)',
  parameters: [{ name: 'installationId', in: 'path', required: true, schema: id }],
  requestBody: { required: true, ...json(ref('ReadingInput')) },
  responses: { 201: { description: 'Created', headers: { Location: { schema: str, description: 'GET URI of created reading' } }, ...json(resource('GenerationReading')) }, ...errors, 409: error('Duplicate installation and timestamp'), 413: error('Body exceeds 100kb'), 415: error('Content-Type must be application/json') }
};
paths['/api/v1/auth/login'] = { post: {
  tags: ['Authentication'], summary: 'Issue JWT', security: [],
  requestBody: { required: true, ...json({ ...object({ email: { type: 'string', format: 'email' }, password: { type: 'string', format: 'password' } }), required: ['email', 'password'] }) },
  responses: { 200: { description: 'Authenticated; never cached', ...json(resource('Login')) }, ...errors, 413: error('Body exceeds 100kb'), 415: error('Content-Type must be application/json') }
} };
paths['/health'] = { get: { tags: ['Health'], summary: 'API and database health', security: [], responses: { 200: { description: 'Connected', ...json(ref('Health')) }, 503: { description: 'Database unavailable', ...json(ref('Health')) } } } };
paths['/api/v1'] = { get: { tags: ['Health'], summary: 'API metadata', security: [], responses: { 200: { description: 'API metadata', ...json(resource('Api')) }, 503: errors[503] } } };
module.exports = {
  openapi: '3.0.3',
  info: { title: 'SLSEA Real-Time Solar Generation Data API', version: '1.0.0', description: 'Richardson Level 2. Append-only GenerationReading history: no PUT, PATCH or DELETE. Unknown query fields and repeated values return 400. Device JWTs permit own installation reads and POST only. Top-level collection filters intersect with jurisdiction; nested history filters must match its installation (403 otherwise). Summary uses latest non-future power and cumulative energy delta from the last reading at/before Colombo midnight, falling back to the first today. Missing boundary data and counter resets may undercount; stale readings remain visible. 204 occurs on CORS preflight only.' },
  servers: [{ url: '/', description: 'Current local or deployed host' }],
  security: [{ BearerAuth: [] }],
  components: { securitySchemes: { BearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } }, schemas }, paths
};
