const mongoose = require('mongoose');

function isObjectId(value) {
  return typeof value === 'string'
    && mongoose.Types.ObjectId.isValid(value)
    && String(new mongoose.Types.ObjectId(value)) === value;
}

function idString(value) {
  if (value == null) return null;
  if (typeof value === 'string') return value;
  if (value._id) return value._id.toString();
  if (typeof value.toString === 'function') return value.toString();
  return null;
}

module.exports = { isObjectId, idString };
