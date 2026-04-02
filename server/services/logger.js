const supabase = require('./supabase');

const LOG_LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const CURRENT_LEVEL = process.env.LOG_LEVEL || 'info';

/**
 * Log an event to console + database.
 *
 * @param {'error'|'warn'|'info'|'debug'} level
 * @param {string} category - e.g. 'retell_webhook', 'sms', 'crm_push', 'system'
 * @param {string} message - human-readable: "Lead created: John Smith (score: 85)"
 * @param {object} opts
 * @param {string} opts.firmId
 * @param {object} opts.details - full context (request body, error stack, etc.)
 * @param {string} opts.source - file/function: "webhookController.handleCallEnded"
 * @param {string} opts.callId - Retell call ID
 * @param {string} opts.leadId - Lead ID
 * @param {string} opts.userId - User who triggered
 * @param {string} opts.ip - Request IP
 * @param {number} opts.durationMs - How long the operation took
 */
async function log(level, category, message, opts = {}) {
  const { firmId, details, source, callId, leadId, userId, ip, durationMs, requestId } = opts;

  // Always print to console (full details, no truncation)
  const timestamp = new Date().toISOString().slice(11, 19);
  const prefix = `${timestamp} [${level.toUpperCase()}] [${category}]`;
  const detailStr = details ? JSON.stringify(details) : '';

  if (level === 'error') {
    console.error(`${prefix} ${message}`, detailStr);
  } else if (level === 'warn') {
    console.warn(`${prefix} ${message}`, detailStr);
  } else {
    console.log(`${prefix} ${message}`, detailStr);
  }

  // Skip DB write if level is below threshold
  if (LOG_LEVELS[level] > LOG_LEVELS[CURRENT_LEVEL]) return;

  // Only write error and warn to DB — info/debug stay console-only
  // This prevents system_logs table from bloating with routine info logs
  if (LOG_LEVELS[level] > 1) return; // 0=error, 1=warn go to DB; 2=info, 3=debug skip

  // Build details with requestId included for traceability
  const dbDetails = { ...(details || {}) };
  if (requestId) {
    dbDetails._requestId = requestId;
  }

  // Write to database (non-blocking — fire and forget)
  if (supabase) {
    supabase.from('system_logs').insert({
      firm_id: firmId || null,
      level,
      category,
      message,
      details: dbDetails,
      source: source || null,
      call_id: callId || null,
      lead_id: leadId || null,
      user_id: userId || null,
      ip_address: ip || null,
      duration_ms: durationMs || null,
      request_id: requestId || null,
    }).then(({ error }) => {
      if (error) console.error(`[Logger DB Error] ${error.message}`);
    });
  }
}

module.exports = {
  error: (category, message, opts) => log('error', category, message, opts),
  warn:  (category, message, opts) => log('warn', category, message, opts),
  info:  (category, message, opts) => log('info', category, message, opts),
  debug: (category, message, opts) => log('debug', category, message, opts),
};
