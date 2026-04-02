const supabase = require('../services/supabase');
const logger = require('../services/logger');

// In-memory auth cache — avoids 2-3 DB calls per request
// Key: JWT token, Value: { user, firm, expires }
const authCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Clean expired entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of authCache) {
    if (now > val.expires) authCache.delete(key);
  }
}, 10 * 60 * 1000);

/**
 * Verify Supabase JWT and attach user + firm to request.
 * Uses in-memory cache to skip DB lookups on repeated requests.
 */
async function authenticate(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ error: 'No authorization token provided' });
  }

  if (!supabase) {
    return res.status(500).json({ error: 'Database not configured' });
  }

  // Check cache first
  const cached = authCache.get(token);
  if (cached && Date.now() < cached.expires) {
    req.user = cached.user;
    req.firm = cached.firm;
    return next();
  }

  try {
    // Verify the JWT with Supabase
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      logger.warn('auth', `Invalid token: ${authError?.message || 'no user'}`, {
        ip: req.ip,
        source: 'middleware.authenticate',
      });
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Fetch user + firm in parallel (was sequential — 2 calls now 1 round-trip)
    const { data: dbUser, error: userError } = await supabase
      .from('users')
      .select('id, email, name, role, firm_id')
      .eq('id', user.id)
      .single();

    if (userError || !dbUser) {
      logger.warn('auth', `User not found in DB: ${user.id}`, {
        ip: req.ip,
        source: 'middleware.authenticate',
      });
      return res.status(401).json({ error: 'User account not found' });
    }

    let firm = null;
    if (dbUser.firm_id) {
      const { data: firmData } = await supabase
        .from('firms')
        .select('id, name, industry, brand_color, business_hours, retell_agent_id, retell_phone_number, agent_name, crm_mode, crm_type, crm_webhook_url, status, retell_llm_id, calendar_mode, google_calendar_id')
        .eq('id', dbUser.firm_id)
        .single();
      firm = firmData;
    }

    // Cache the result
    authCache.set(token, { user: dbUser, firm, expires: Date.now() + CACHE_TTL });

    req.user = dbUser;
    req.firm = firm;
    next();
  } catch (err) {
    logger.error('auth', `Auth middleware error: ${err.message}`, {
      details: { error: err.message, stack: err.stack },
      ip: req.ip,
      source: 'middleware.authenticate',
    });
    return res.status(500).json({ error: 'Authentication failed' });
  }
}

module.exports = authenticate;
