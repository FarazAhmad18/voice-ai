const crypto = require('crypto');

function requestId(req, res, next) {
  const clientId = req.headers['x-request-id'];
  // Validate client-provided request ID: max 64 chars, alphanumeric + hyphens only
  if (clientId && /^[a-zA-Z0-9_-]{1,64}$/.test(clientId)) {
    req.requestId = clientId;
  } else {
    req.requestId = crypto.randomUUID().slice(0, 12);
  }
  res.setHeader('X-Request-ID', req.requestId);
  next();
}

module.exports = requestId;
