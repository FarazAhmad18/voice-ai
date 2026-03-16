const logger = require('../services/logger');

function requestLogger(req, res, next) {
  const start = Date.now();

  // Log when response finishes
  res.on('finish', () => {
    // Skip logging for GET /api/logs to avoid recursion
    if (req.method === 'GET' && req.originalUrl.startsWith('/api/logs')) {
      return;
    }

    const duration = Date.now() - start;
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';

    logger[level]('http', `${req.method} ${req.originalUrl} ${res.statusCode}`, {
      details: {
        method: req.method,
        url: req.originalUrl,
        status: res.statusCode,
        duration,
        userAgent: req.headers['user-agent']?.slice(0, 100),
        requestId: req.requestId,
      },
      ip: req.ip,
      userId: req.user?.id,
      firmId: req.firm?.id,
      durationMs: duration,
      source: 'middleware.requestLogger',
    });
  });

  next();
}

module.exports = requestLogger;
