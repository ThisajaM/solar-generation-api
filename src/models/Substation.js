const mongoose = require('mongoose');
const { applyJsonId } = require('./plugins/jsonId');

const schema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  code: { type: String, required: true, unique: true, uppercase: true, trim: true },
  district: { type: mongoose.Schema.Types.ObjectId, ref: 'District', required: true, index: true },
  location: {
    type: { type: String, enum: ['Point'] },
    coordinates: { type: [Number] }
  }
}, { timestamps: true, versionKey: false });

schema.index({ district: 1, name: 1 }, { unique: true });
applyJsonId(schema);
module.exports = mongoose.model('Substation', schema);
