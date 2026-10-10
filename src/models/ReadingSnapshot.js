const mongoose = require('mongoose');
// Operational cache, not a new coursework domain entity. One bounded session per principal.
const schema = new mongoose.Schema({
  _id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  total: { type: Number, required: true },
  nonce: { type: String, required: true },
  binding: { type: String, required: true },
  readingIds: [{ type: mongoose.Schema.Types.ObjectId }],
  expiresAt: { type: Date, required: true }
}, { versionKey: false, autoCreate: false, autoIndex: false });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
module.exports = mongoose.model('ReadingSnapshot', schema);
