const supabase = require('../services/supabase');
const logger = require('../services/logger');

/**
 * Verify Supabase JWT and attach user + firm to request.
 *
 * After this middleware:
 *   req.user = { id, email, name, role, firm_id }
 *   req.firm = { id, name, industry, ... } or null (for super_admin)
 */
async function authenticate(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ error: 'No authorization token provided' });
  }

  if (!supabase) {
    return res.status(500).json({ error: 'Database not configured' });
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

    // Fetch user record with role and firm
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

    // Fetch firm if user has one (super_admin has firm_id = null)
    let firm = null;
    if (dbUser.firm_id) {
      const { data: firmData } = await supabase
        .from('firms')
        .select('*')
        .eq('id', dbUser.firm_id)
        .single();
      firm = firmData;
    }

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
