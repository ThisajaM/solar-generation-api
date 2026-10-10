const crypto = require('crypto');
const Snapshot = require('../models/ReadingSnapshot');
const { binding, signature, invalid } = require('./cursorService');
const MAX_RECORDS = 150000;
const LIFETIME_SECONDS = 900;
const fail = (status, code, message) => Object.assign(new Error(message), { status, code });
function encode(session, position, bound) {
  const body = Buffer.from(JSON.stringify({ v: 2, snapshot: session.nonce, position, bound, exp: Math.floor(+session.expiresAt / 1000) })).toString('base64url');
  return `${body}.${signature(body).toString('base64url')}`;
}
function decode(token, bound) {
  try {
    if (typeof token !== 'string' || token.length > 2048 || !/^[\w-]+\.[\w-]+$/.test(token)) throw invalid();
    const [body, tag] = token.split('.'); const actual = Buffer.from(tag, 'base64url');
    if (actual.length !== 32 || actual.toString('base64url') !== tag || !crypto.timingSafeEqual(signature(body), actual)) throw invalid();
    const value = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (value.v !== 2 || value.bound !== bound || typeof value.snapshot !== 'string' || !Number.isSafeInteger(value.position) || value.position < 0 || !Number.isInteger(value.exp) || value.exp <= Date.now() / 1000) throw invalid();
    return value;
  } catch { throw invalid(); }
}
async function capture(req, model, query, direction, bound) {
  try {
    if (!await Snapshot.collection.indexExists('expiresAt_1')) throw new Error('Missing TTL index');
  } catch { throw fail(503, 'SNAPSHOT_NOT_READY', 'Snapshot indexes must be prepared before using snapshot pagination'); }
  const session = await model.startSession(); let snapshot;
  try {
    await session.withTransaction(async () => {
      // IDs alone fit below 16 MiB. Stream the bounded batch rather than using
      // toArray(): this driver's bulk spread exceeds JS argument limits at 134400 rows.
      // A single batch also avoids CSOT adding unsupported maxTimeMS to getMore.
      const cursor = model.collection.find(query, { projection: { _id: 1 }, sort: { timestamp: direction, _id: direction }, limit: MAX_RECORDS + 1, batchSize: MAX_RECORDS + 1, maxTimeMS: 8000, session });
      const readingIds = [];
      for await (const row of cursor) readingIds.push(row._id);
      if (readingIds.length > MAX_RECORDS) throw fail(422, 'SNAPSHOT_TOO_LARGE', 'Narrow the date range or installation filter to at most 150000 readings');
      // Values are all server-generated and typed; native storage avoids hydrating a huge Mongoose array.
      snapshot = await Snapshot.collection.findOneAndReplace({ _id: req.user._id }, { _id: req.user._id, nonce: crypto.randomUUID(), binding: bound, total: readingIds.length, readingIds, expiresAt: new Date(Date.now() + LIFETIME_SECONDS * 1000) }, { session, upsert: true, returnDocument: 'after' });
    }, { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' }, maxCommitTimeMS: 5000, timeoutMS: 15000 });
  } finally { await session.endSession(); }
  return snapshot;
}
async function snapshotPage(req, model, query, limit, direction) {
  if (req.query.page !== undefined) throw fail(400, 'INVALID_PARAMETER', 'page cannot be combined with snapshot pagination');
  const bound = binding(req, limit, direction);
  const cursor = req.query.cursor ? decode(req.query.cursor, bound) : null;
  const snapshot = cursor ? await Snapshot.findById(req.user._id).select({ nonce: 1, binding: 1, expiresAt: 1, total: 1, readingIds: { $slice: [cursor.position, limit] } }) : await capture(req, model, query, direction, bound);
  if (!snapshot || snapshot.binding !== bound || +snapshot.expiresAt <= Date.now() || (cursor && snapshot.nonce !== cursor.snapshot)) throw fail(410, 'SNAPSHOT_EXPIRED', 'Snapshot expired or was replaced by a new snapshot for this account');
  const position = cursor?.position || 0; const total = snapshot.total;
  if (position > total || (total > 0 && position === total)) throw invalid();
  const ids = cursor ? snapshot.readingIds : snapshot.readingIds.slice(position, position + limit);
  const rows = await model.find({ $and: [query, { _id: { $in: ids } }] });
  if (rows.length !== ids.length) throw fail(409, 'SNAPSHOT_INVALIDATED', 'Snapshot records are no longer available within your authorized query');
  const byId = new Map(rows.map(r => [String(r._id), r]));
  const link = offset => {
    const url = new URL(req.originalUrl, 'http://local'); url.searchParams.delete('page');
    url.searchParams.set('pagination', 'snapshot'); url.searchParams.set('limit', String(limit)); url.searchParams.set('cursor', encode(snapshot, offset, bound));
    return url.pathname + '?' + url.searchParams;
  };
  return { data: ids.map(id => byId.get(String(id))), meta: { total, limit, pagination: 'snapshot', consistency: 'fixed-membership', snapshotExpiresAt: snapshot.expiresAt.toISOString() },
    links: { self: req.originalUrl, previous: position ? link(Math.max(0, position - limit)) : null, next: position + limit < total ? link(position + limit) : null } };
}
module.exports = { snapshotPage, MAX_RECORDS, LIFETIME_SECONDS };
