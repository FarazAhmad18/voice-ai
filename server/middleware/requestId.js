const crypto = require('crypto');

function requestId(req, res, next) {
  req.requestId = req.headers['x-request-id'] || crypto.randomUUID().slice(0, 12);
  res.setHeader('X-Request-ID', req.requestId);
  next();
}

module.exports = requestId;
