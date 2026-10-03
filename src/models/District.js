const mongoose = require('mongoose');
const { applyJsonId } = require('./plugins/jsonId');

const schema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  code: { type: String, required: true, unique: true, uppercase: true, trim: true },
  province: { type: mongoose.Schema.Types.ObjectId, ref: 'Province', required: true, index: true }
}, { timestamps: true, versionKey: false });

schema.index({ province: 1, name: 1 }, { unique: true });
applyJsonId(schema);
module.exports = mongoose.model('District', schema);
