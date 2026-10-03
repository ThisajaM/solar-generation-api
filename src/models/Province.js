const mongoose = require('mongoose');
const { applyJsonId } = require('./plugins/jsonId');

const schema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true },
  code: { type: String, required: true, unique: true, uppercase: true, trim: true }
}, { timestamps: true, versionKey: false });

applyJsonId(schema);
module.exports = mongoose.model('Province', schema);
