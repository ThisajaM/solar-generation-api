const mongoose = require('mongoose');
const { applyJsonId } = require('./plugins/jsonId');

const schema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, trim: true, uppercase: true },
  name: { type: String, required: true, trim: true },
  meterId: { type: String, trim: true, unique: true, sparse: true },
  inverterId: { type: String, trim: true, unique: true, sparse: true },
  capacityKw: { type: Number, required: true, min: 0 },
  latitude: { type: Number, required: true, min: -90, max: 90 },
  longitude: { type: Number, required: true, min: -180, max: 180 },
  substation: { type: mongoose.Schema.Types.ObjectId, ref: 'Substation', required: true, index: true },
  status: { type: String, enum: ['active', 'inactive', 'commissioning'], default: 'active' }
}, { timestamps: true, versionKey: false });

schema.pre('validate', function requireMeterOrInverter(next) {
  if (!this.meterId && !this.inverterId) {
    return next(new Error('A solar installation must have meterId or inverterId'));
  }
  return next();
});

applyJsonId(schema);
module.exports = mongoose.model('SolarInstallation', schema);
