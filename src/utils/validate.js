const { sendError } = require('./http');
const { isObjectId } = require('./ids');

const MAX_LIMIT = 100;

function asFiniteNumber(value, field) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    const error = new Error(`${field} must be a finite number`);
    error.status = 400;
    error.code = 'INVALID_PARAMETER';
    error.detail = { field, value };
    throw error;
  }
  return value;
}

function asNonNegativeNumber(value, field) {
  const number = asFiniteNumber(value, field);
  if (number < 0) {
    const error = new Error(`${field} must be greater than or equal to 0`);
    error.status = 400;
    error.code = 'INVALID_PARAMETER';
    error.detail = { field, value };
    throw error;
  }
  return number;
}

function parseIsoDate(value, field) {
  if (value == null) return null;
  if (typeof value !== 'string') {
    const error = new Error(`${field} must be an ISO-8601 date-time string`);
    error.status = 400;
    error.code = 'INVALID_DATE';
    error.detail = { field, value };
    throw error;
  }
  const date = new Date(value);
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/);
  const validDay = match && Number(match[2]) >= 1 && Number(match[2]) <= 12 && Number(match[3]) >= 1 && Number(match[3]) <= new Date(Date.UTC(Number(match[1]), Number(match[2]), 0)).getUTCDate();
  if (!match || !validDay || Number(match[4]) > 23 || Number(match[5]) > 59 || Number(match[6]) > 59 || Number.isNaN(date.getTime())) {
    const error = new Error(`${field} must be a valid ISO-8601 date-time`);
    error.status = 400;
    error.code = 'INVALID_DATE';
    error.detail = { field, value };
    throw error;
  }
  return date;
}

function parsePagination(query) {
  for (const field of ['page', 'limit']) {
    if (query[field] !== undefined && (typeof query[field] !== 'string' || !/^[1-9]\d*$/.test(query[field]))) {
      throw Object.assign(new Error(`${field} must be a positive integer`), { status: 400, code: 'INVALID_PARAMETER', detail: { field } });
    }
  }
  const pageRaw = query.page == null || query.page === '' ? 1 : Number(query.page);
  const limitRaw = query.limit == null || query.limit === '' ? 50 : Number(query.limit);
  if (!Number.isSafeInteger(pageRaw) || pageRaw < 1 || !Number.isSafeInteger((pageRaw - 1) * limitRaw)) {
    const error = new Error('The page parameter must be an integer greater than or equal to 1');
    error.status = 400;
    error.code = 'INVALID_PARAMETER';
    error.detail = { field: 'page', value: query.page };
    throw error;
  }
  if (!Number.isInteger(limitRaw) || limitRaw < 1 || limitRaw > MAX_LIMIT) {
    const error = new Error(`The limit parameter must be between 1 and ${MAX_LIMIT}.`);
    error.status = 400;
    error.code = 'INVALID_PARAMETER';
    error.detail = { field: 'limit', value: query.limit };
    throw error;
  }
  return { page: pageRaw, limit: limitRaw };
}

function parseSort(value, allowed = ['timestamp']) {
  const sort = value == null ? '-timestamp' : value;
  if (typeof sort !== 'string') throw Object.assign(new Error('sort must be a string'), { status: 400, code: 'INVALID_SORT' });
  const descending = sort.startsWith('-');
  const field = descending ? sort.slice(1) : sort;
  const normalised = descending ? `-${field}` : field;
  if (!allowed.includes(field) || sort !== normalised) {
    const error = new Error(`sort must be one of: ${allowed.flatMap(name => [name, `-${name}`]).join(', ')}`);
    error.status = 400;
    error.code = 'INVALID_SORT';
    error.detail = { field: 'sort', value };
    throw error;
  }
  return normalised;
}

function validateObjectIdParam(paramName) {
  return (req, res, next, value) => {
    if (!isObjectId(value)) {
      return sendError(res, 400, 'INVALID_ID', 'Invalid resource identifier', { field: paramName, value });
    }
    return next();
  };
}

function validateOptionalObjectIdQuery(req, names) {
  for (const name of names) {
    const value = req.query[name];
    if (value != null && !isObjectId(value)) {
      const error = new Error(`${name} must be a valid MongoDB ObjectId`);
      error.status = 400;
      error.code = 'INVALID_ID';
      error.detail = { field: name, value };
      throw error;
    }
  }
}

module.exports = {
  MAX_LIMIT,
  asFiniteNumber,
  asNonNegativeNumber,
  parseIsoDate,
  parsePagination,
  parseSort,
  validateObjectIdParam,
  validateOptionalObjectIdQuery
};
