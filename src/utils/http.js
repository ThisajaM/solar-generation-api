function sendError(res, status, code, message, detail = null) {
  return res.status(status).json({
    error: {
      code,
      message,
      detail
    }
  });
}

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

module.exports = { sendError, asyncHandler };
