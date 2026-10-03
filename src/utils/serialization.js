function idOf(value) {
  return value?._id?.toString?.() || value?.toString?.() || value;
}

function publicUser(user) {
  return {
    id: idOf(user._id),
    name: user.name,
    email: user.email,
    role: user.role,
    scope: user.scope,
    scopes: user.scopes,
    province: user.province ? idOf(user.province) : null,
    district: user.district ? idOf(user.district) : null,
    substation: user.substation ? idOf(user.substation) : null,
    installation: user.installation ? idOf(user.installation) : null,
    active: user.active
  };
}

module.exports = { idOf, publicUser };
