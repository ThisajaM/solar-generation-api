const mongoose = require('mongoose');
const { applyJsonId } = require('./plugins/jsonId');

const schema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  role: {
    type: String,
    enum: ['national-analyst', 'province-analyst', 'district-analyst', 'device'],
    required: true
  },
  scope: { type: String, enum: ['national', 'province', 'district', 'installation'], required: true },
  province: { type: mongoose.Schema.Types.ObjectId, ref: 'Province', default: null },
  district: { type: mongoose.Schema.Types.ObjectId, ref: 'District', default: null },
  substation: { type: mongoose.Schema.Types.ObjectId, ref: 'Substation', default: null },
  installation: { type: mongoose.Schema.Types.ObjectId, ref: 'SolarInstallation', default: null },
  scopes: { type: [String], default: [] },
  active: { type: Boolean, default: true }
}, { timestamps: true, versionKey: false });

schema.pre('validate', function validateScope(next) {
  const mapping = { 'national-analyst': ['national', null, 'analyst-read'], 'province-analyst': ['province', 'province', 'analyst-read'], 'district-analyst': ['district', 'district', 'analyst-read'], device: ['installation', 'installation', 'installation-write'] };
  const rule = mapping[this.role];
  if (rule && (this.scope !== rule[0] || (rule[1] && !this[rule[1]]) || this.scopes.length !== 1 || this.scopes[0] !== rule[2])) {
    this.invalidate('scope', 'Role, jurisdiction and granted scopes must agree');
  }
  next();
});

applyJsonId(schema);
module.exports = mongoose.model('User', schema);
