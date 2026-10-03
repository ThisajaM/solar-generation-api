const mongoose = require('mongoose');
const { applyJsonId } = require('./plugins/jsonId');

const schema = new mongoose.Schema({
  installation: { type: mongoose.Schema.Types.ObjectId, ref: 'SolarInstallation', required: true },
  timestamp: { type: Date, required: true },
  powerKw: { type: Number, required: true, min: 0, validate: Number.isFinite },
  cumulativeEnergyKwh: { type: Number, required: true, min: 0, validate: Number.isFinite },
  voltage: { type: Number, required: true, min: 0, validate: Number.isFinite },
  frequencyHz: { type: Number, required: true, min: 0, validate: Number.isFinite, default: 50 }
}, { timestamps: true, versionKey: false });

schema.index({ installation: 1, timestamp: 1 }, { unique: true });
schema.index({ timestamp: -1 });

applyJsonId(schema);
module.exports = mongoose.model('GenerationReading', schema);
