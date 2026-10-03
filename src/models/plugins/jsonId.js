function applyJsonId(schema) {
  schema.set('toJSON', {
    virtuals: true,
    transform(_doc, ret) {
      ret.id = ret._id.toString();
      delete ret._id;
      return ret;
    }
  });
  schema.set('toObject', { virtuals: true });
}

module.exports = { applyJsonId };
