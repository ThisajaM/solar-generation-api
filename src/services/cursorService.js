const crypto = require('crypto');
const { jwtSecret } = require('../config/env');
const { isObjectId } = require('../utils/ids');
const key = crypto.createHmac('sha256', jwtSecret).update('slsea-history-cursors-v1').digest();
function invalid() { return Object.assign(new Error('Invalid, expired or query-mismatched cursor'), { status: 400, code: 'INVALID_CURSOR' }); }
function signature(body) { return crypto.createHmac('sha256', key).update(body).digest(); }
function binding(req, limit, direction) {
  const filters = Object.fromEntries(Object.entries(req.query).filter(([k]) => !['cursor', 'page', 'limit', 'sort', 'pagination'].includes(k)).sort(([a], [b]) => a.localeCompare(b)));
  const user = req.user;
  return crypto.createHash('sha256').update(JSON.stringify([req.originalUrl.split('?')[0], filters, limit, direction,
    String(user._id), user.role, user.scope, [...user.scopes].sort(), String(user.province), String(user.district), String(user.installation)])).digest('hex');
}
function encode(row, move, bound) {
  const body = Buffer.from(JSON.stringify({ v: 1, t: new Date(row.timestamp).toISOString(), id: String(row._id), move, bound, exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url');
  return `${body}.${signature(body).toString('base64url')}`;
}
function decode(token, bound) {
  try {
    if (typeof token !== 'string' || token.length > 2048 || !/^[\w-]+\.[\w-]+$/.test(token)) throw invalid();
    const [body, tag] = token.split('.'); const actual = Buffer.from(tag, 'base64url');
    if (actual.length !== 32 || actual.toString('base64url') !== tag || !crypto.timingSafeEqual(signature(body), actual)) throw invalid();
    const value = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (value.v !== 1 || value.bound !== bound || !isObjectId(value.id) || !['next', 'previous'].includes(value.move) ||
        !Number.isFinite(Date.parse(value.t)) || !Number.isInteger(value.exp) || value.exp <= Date.now() / 1000) throw invalid();
    return value;
  } catch { throw invalid(); }
}
function boundary(row, direction) {
  const op = direction === 1 ? '$gt' : '$lt'; const timestamp = new Date(row.t || row.timestamp);
  return { $or: [{ timestamp: { [op]: timestamp } }, { timestamp, _id: { [op]: row.id || row._id } }] };
}
async function cursorPage(req, model, query, limit, direction) {
  if (req.query.page !== undefined) throw Object.assign(new Error('page cannot be combined with cursor pagination'), { status: 400, code: 'INVALID_PARAMETER' });
  const bound = binding(req, limit, direction);
  const cursor = req.query.cursor ? decode(req.query.cursor, bound) : null;
  const travel = cursor?.move === 'previous' ? -direction : direction;
  const selected = cursor ? { $and: [query, boundary(cursor, travel)] } : query;
  let data = await model.find(selected).sort({ timestamp: travel, _id: travel }).limit(limit);
  if (cursor?.move === 'previous') data = data.reverse();
  const total = await model.countDocuments(query);
  const link = token => {
    const url = new URL(req.originalUrl, 'http://local');
    url.searchParams.delete('page'); url.searchParams.delete('cursor');
    url.searchParams.set('pagination', 'cursor'); url.searchParams.set('limit', String(limit));
    if (token) url.searchParams.set('cursor', token);
    return url.pathname + '?' + url.searchParams;
  };
  const first = data[0]; const last = data.at(-1);
  const before = first && await model.exists({ $and: [query, boundary(first, -direction)] });
  const after = last && await model.exists({ $and: [query, boundary(last, direction)] });
  return { data, meta: { total, limit, pagination: 'cursor', consistency: 'live-keyset' },
    links: { self: req.originalUrl, previous: before ? link(encode(first, 'previous', bound)) : null, next: after ? link(encode(last, 'next', bound)) : null } };
}
module.exports = { cursorPage, binding, signature, invalid };
