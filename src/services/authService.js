const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { jwtSecret, jwtExpiresIn } = require('../config/env');
const { publicUser } = require('../utils/serialization');

async function login(email, password) {
  if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
    const error = new Error('email and password are required');
    error.status = 400;
    error.code = 'VALIDATION_ERROR';
    error.detail = { field: !email ? 'email' : 'password' };
    throw error;
  }
  const user = await User.findOne({ email: email.trim().toLowerCase() });
  if (!user || !user.active || !(await bcrypt.compare(password, user.passwordHash))) {
    const error = new Error('Email or password is incorrect');
    error.status = 401;
    error.code = 'INVALID_CREDENTIALS';
    throw error;
  }
  const token = jwt.sign({
    sub: user._id.toString(),
    role: user.role,
    scope: user.scopes.includes('analyst-read') ? 'analyst-read' : user.scopes[0],
    scopes: user.scopes,
    provinceId: user.province ? user.province.toString() : undefined,
    districtId: user.district ? user.district.toString() : undefined,
    installationId: user.installation ? user.installation.toString() : undefined
  }, jwtSecret, { expiresIn: jwtExpiresIn, algorithm: 'HS256' });
  return { tokenType: 'Bearer', expiresIn: jwtExpiresIn, token, user: publicUser(user) };
}

module.exports = { login };
