const authService = require('../services/authService');
const { sendError } = require('../utils/http');

async function login(req, res) {
  try {
    const result = await authService.login(req.body?.email, req.body?.password);
    res.set('Cache-Control', 'no-store');
    return res.json({ data: result });
  } catch (error) {
    if (error.status) return sendError(res, error.status, error.code, error.message, error.detail || null);
    throw error;
  }
}

module.exports = { login };
