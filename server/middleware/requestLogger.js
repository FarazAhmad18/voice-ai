const logger = require('../services/logger');

/**
 * Sensitive query/body parameter names to redact from logs.
 */
const SENSITIVE_KEYS = [
  'password', 'token', 'access_token', 'refresh_token', 'api_key',
  'apikey', 'api-key', 'secret', 'authorization', 'crm_api_key',
  'crm_access_token', 'twilio_auth_token', 'auth_token',
];

/**
 * Redact sensitive values from a URL string's query parameters.
 *
 * @param {string} urlString - Original URL (may include query params)
 * @returns {string} URL with sensitive query param values replaced with [REDACTED]
 */
function redactUrl(urlString) {
  if (!urlString || !urlString.includes('?')) return urlString;

  try {
    const [path, queryString] = urlString.split('?', 2);
    if (!queryString) return urlString;

    const params = new URLSearchParams(queryString);
    for (const key of params.keys()) {
      if (SENSITIVE_KEYS.includes(key.toLowerCase())) {
        params.set(key, '[REDACTED]');
      }
    }
    return `${path}?${params.toString()}`;
  } catch {
    return urlString;
  }
}

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
    const safeUrl = redactUrl(req.originalUrl);

    logger[level]('http', `${req.method} ${safeUrl} ${res.statusCode}`, {
      details: {
        method: req.method,
        url: safeUrl,
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
