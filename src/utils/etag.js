const crypto = require('crypto');

function buildEtag(value) {
  return `"${crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')}"`;
}

function applyValidators(res, payload, lastModified) {
  const etag = buildEtag(payload);
  res.set('ETag', etag);
  if (lastModified) res.set('Last-Modified', new Date(lastModified).toUTCString());
  return etag;
}

function matches(header, etag, weak = false) {
  return header.split(',').some(part => {
    const tag = part.trim();
    return tag === '*' || (weak ? tag.replace(/^W\//, '') : tag) === etag;
  });
}

function isNotModified(req, etag, lastModified) {
  const ifMatch = req.get('If-Match');
  if (ifMatch && !matches(ifMatch, etag)) {
    const error = new Error('If-Match does not match the current representation');
    Object.assign(error, { status: 412, code: 'PRECONDITION_FAILED' });
    throw error;
  }
  const inm = req.get('If-None-Match');
  if (inm) return matches(inm, etag, true);
  const ims = req.get('If-Modified-Since');
  return Boolean(ims && lastModified && Date.parse(ims) >= Math.floor(new Date(lastModified).getTime() / 1000) * 1000);
}

module.exports = { buildEtag, applyValidators, isNotModified };
