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
const validators = { ETag: { schema: str, description: 'Representation hash. Supports weak comparison for If-None-Match.' }, 'Last-Modified': { schema: str, description: 'HTTP date, where a reliable modification time is available. Omitted for reading collections, composite, last-reading and summary.' } };
const query = (name, schema, description) => ({ name, in: 'query', schema, description });
const pagination = [query('page', { type: 'integer', minimum: 1, default: 1 }), query('limit', { type: 'integer', minimum: 1, maximum: 100, default: 50 })];
const filters = ['provinceId', 'districtId', 'substationId'].map(name => query(name, id, 'Narrows the server-enforced jurisdiction; never expands access.'));
const history = [...pagination, query('pagination', { type: 'string', enum: ['offset', 'cursor'], default: 'offset' }, 'Cursor mode omits page/pages. Follow signed next/previous links unchanged; do not combine with page.'), query('cursor', str, 'Opaque signed boundary; expires after one hour; bound to user, jurisdiction, filters, ordering and limit. Invalid or mismatched cursors return 400 INVALID_CURSOR.'), ...filters, query('sort', { type: 'string', enum: ['timestamp', '-timestamp'], default: '-timestamp' }), query('from', date, 'Inclusive timestamp lower bound.'), query('to', date, 'Inclusive timestamp upper bound; must be >= from.')];
const conditional = [
  { name: 'If-None-Match', in: 'header', schema: str, description: 'Matching tag, weak tag or * returns bodyless 304; takes precedence over If-Modified-Since.' },
  { name: 'If-Modified-Since', in: 'header', schema: str, description: 'HTTP-date; used only where Last-Modified is supplied.' },
  { name: 'If-Match', in: 'header', schema: str, description: 'Strong comparison on GET; a mismatch returns 412.' }
];
const errors = { 400: error('Invalid input'), 401: error('Missing, expired or invalid JWT'), 403: error('Scope or jurisdiction denied'), 404: error('Resource not found'), 406: error('Accept excludes application/json'), 429: error('Rate limit exceeded'), 500: error('Internal error'), 503: error('Database unavailable') };
const schemas = {
  Error: object({ error: { ...object({ code: str, message: str, detail: { nullable: true, description: 'Optional diagnostic field/value object, string, or array; never a stack trace.' } }), required: ['code', 'message', 'detail'] } }),
  Page: object({ total: { type: 'integer' }, page: { type: 'integer' }, limit: { type: 'integer' }, pages: { type: 'integer' }, pagination: { type: 'string', enum: ['cursor'] }, consistency: { type: 'string', enum: ['live-keyset'] } }),
  Links: object({ self: str, next: nullable(str), previous: nullable(str) }),
  Province: object(base),
  District: object({ ...base, province: { oneOf: [id, ref('Province')] } }),
  Substation: object({ ...base, district: { oneOf: [id, ref('District')] }, location: object({ type: { type: 'string', enum: ['Point'] }, coordinates: { type: 'array', items: { type: 'number' }, description: '[longitude, latitude]' } }) }),
  SolarInstallation: object({ ...base, meterId: str, inverterId: str, capacityKw: num, latitude: { type: 'number' }, longitude: { type: 'number' }, status: { type: 'string', enum: ['active', 'inactive', 'commissioning'] }, substation: { oneOf: [id, ref('Substation')] } }),
  ReadingInput: { ...object({ timestamp: date, powerKw: num, cumulativeEnergyKwh: num, voltage: num, frequencyHz: { ...num, default: 50 } }), required: ['timestamp', 'powerKw', 'cumulativeEnergyKwh', 'voltage'], additionalProperties: false },
  GenerationReading: object({ id, installation: id, timestamp: date, powerKw: num, cumulativeEnergyKwh: num, voltage: num, frequencyHz: num, createdAt: date, updatedAt: date }),
  Freshness: object({ readingTimestamp: nullable(date), readingAgeSeconds: nullable({ type: 'integer' }), isStale: { type: 'boolean' }, status: { type: 'string', enum: ['fresh', 'stale', 'missing', 'future', 'invalid'] }, freshnessThresholdSeconds: { type: 'integer' } }),
  Composite: object({ installation: ref('SolarInstallation'), substation: nullable(object({ id, name: str, code: str })), district: nullable(object({ id, name: str, code: str })), province: nullable(object({ id, name: str, code: str })), latestReading: { allOf: [ref('GenerationReading')], nullable: true }, latestReadingFreshness: ref('Freshness') }),
  User: object({ id, name: str, email: { type: 'string', format: 'email' }, role: { type: 'string', enum: ['national-analyst', 'province-analyst', 'district-analyst', 'device'] }, scope: { type: 'string', enum: ['national', 'province', 'district', 'installation'] }, scopes: { type: 'array', items: str }, province: nullable(id), district: nullable(id), substation: nullable(id), installation: nullable(id), active: { type: 'boolean' } }),
  Login: object({ tokenType: { type: 'string', enum: ['Bearer'] }, expiresIn: str, token: str, user: ref('User') }),
  DistrictSummary: object({ district: object({ id, name: str, code: str }), summary: object({ currentPowerKw: num, todayEnergyKwh: num, lastKnownPowerKw: num, powerQuality: object({ freshInstallations: num, staleInstallations: num, missingInstallations: num }), energyQuality: object({ status: { type: 'string', enum: ['partial', 'complete-through-last-reading'] }, partialInstallations: num, counterDecreases: num, gapIntervals: num, reasons: { type: 'array', items: str } }), installationCount: { type: 'integer' }, latestReadingAt: nullable(date), window: object({ timeZone: str, from: date, to: date }), method: str }) }),
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
read('/api/v1/installations/{installationId}/last-reading', 'Most recent historical record with server-time freshness', object({ data: ref('GenerationReading'), freshness: ref('Freshness') }), [], true);
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
const freshnessPolicy = 'Freshness uses trusted server UTC time and measurement timestamp, not receipt time. READING_FRESHNESS_SECONDS defaults to 1800 (30 minutes); exactly the threshold is fresh. Delayed valid historical ingestion is retained. Future/invalid records are never fresh. Missing last-reading remains 404 with freshness in error.detail; composite can return null with missing status. Age-dependent representations use ETag and omit Last-Modified.';
paths['/api/v1/installations/{installationId}/last-reading'].get.description += ' ' + freshnessPolicy;
paths['/api/v1/installations/{installationId}/composite'].get.description += ' ' + freshnessPolicy;
paths['/api/v1/districts/{districtId}/generation-summary'].get.description += ' Current power excludes readings older than the freshness threshold; lastKnownPowerKw retains stale last-known values. todayEnergyKwh sums nonnegative consecutive cumulative counter deltas wholly inside the Asia/Colombo day, at most READING_INTERVAL_SECONDS (default 900) apart. Counter decreases (unproven resets/rollovers), gaps and cross-midnight intervals are excluded without interpolation or adding the post-reset value. Missing midnight baseline or recent intervals produce partial quality. Subsequent valid increments after a decrease are counted. This is observed energy, not an exact whole-day total; inspect energyQuality. A complete-through-last-reading status covers observed intervals only.';
for (const path of ['/api/v1/readings', '/api/v1/installations/{installationId}/readings']) paths[path].get.description += ' Offset pagination remains the default and can shift under concurrent insertion. Optional cursor mode sorts by timestamp and unique public reading ID. It traverses existing immutable rows without offset shifts; new rows behind the boundary are not revisited and new rows ahead may appear. This is a live traversal, not a snapshot. Total is a live filtered count and can change; next/previous links are evaluated at request time. Authorization is checked on every request.';
paths['/api/v1/auth/login'].post.description = 'HS256 JWTs require signature, expiry, issued-at, subject, role, scope and scopes. Claims must match the current active database user and device installation or analyst jurisdiction. Devices may write only their assigned installation; analysts remain read-only. Passwords are bcrypt hashed. Tokens issued by this login remain compatible; disable a user to revoke access. No separate Device entity.';
module.exports = {
  openapi: '3.0.3',
  info: { title: 'SLSEA Real-Time Solar Generation Data API', version: '1.0.0', description: 'Richardson Level 2. Append-only GenerationReading history: no PUT, PATCH or DELETE. Unknown query fields and repeated values return 400. Device JWTs permit own installation reads and POST only. Top-level collection filters intersect with jurisdiction; nested history filters must match its installation (403 otherwise). Summary reports fresh current power and conservative observed counter deltas with explicit data quality. Historical readings remain accessible. Full mutable-resource CRUD requires lecturer clarification because the brief assigns read-only analyst roles and append-only device writes. 204 occurs on CORS preflight only.' },
  servers: [{ url: '/', description: 'Current local or deployed host' }],
  security: [{ BearerAuth: [] }],
  components: { securitySchemes: { BearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } }, schemas }, paths
};
