const { sendError } = require('../utils/http');

function notFound(req, res) {
  return sendError(res, 404, 'NOT_FOUND', 'Resource not found', `No route matches ${req.method} ${req.originalUrl}`);
}

function errorHandler(err, req, res, _next) {
  if (process.env.NODE_ENV !== 'test') {
    if (!err.status || err.status >= 500) console.error('Request failed:', err.name);
  }
  if (err.code === 50 || err.name === 'MongoOperationTimeoutError') return sendError(res, 503, 'QUERY_TIMEOUT', 'Database operation exceeded its time budget; narrow the query or retry', null);
  if (err.type === 'entity.too.large') return sendError(res, 413, 'PAYLOAD_TOO_LARGE', 'JSON body exceeds 100kb', null);
  if (err.status && err.code) {
    return sendError(res, err.status, err.code, err.message, err.detail || null);
  }
  if (err.name === 'ValidationError') {
    return sendError(res, 400, 'VALIDATION_ERROR', 'Request validation failed', Object.values(err.errors).map(e => e.message));
  }
  if (err.name === 'CastError') {
    return sendError(res, 400, 'INVALID_ID', 'Invalid resource identifier', { field: err.path, value: err.value });
  }
  if (err.code === 11000) {
    return sendError(res, 409, 'DUPLICATE_RESOURCE', 'A resource with the same unique value already exists', err.keyValue);
  }
  if (err.type === 'entity.parse.failed' || (err instanceof SyntaxError && err.status === 400 && 'body' in err)) {
    return sendError(res, 400, 'INVALID_JSON', 'Request body is not valid JSON', null);
  }
  return sendError(res, 500, 'INTERNAL_ERROR', 'An unexpected server error occurred', process.env.NODE_ENV === 'production' ? null : err.message);
}

module.exports = { notFound, errorHandler };
