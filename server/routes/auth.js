const express = require('express');
const router = express.Router();
const supabase = require('../services/supabase');
const authenticate = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');
const logger = require('../services/logger');

// POST /api/auth/signup — create a new account (super_admin only)
router.post('/signup', authenticate, requireRole('super_admin'), async (req, res) => {
  const { email, password, name, role, firm_id } = req.body;

  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Email, password, and name are required' });
  }

  if (!supabase) {
    return res.status(500).json({ error: 'Database not configured' });
  }

  try {
    // Create Supabase Auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError) {
      logger.error('auth', `Signup failed: ${authError.message}`, {
        details: { email, error: authError.message },
        source: 'routes.auth.signup',
      });
      return res.status(400).json({ error: authError.message });
    }

    // Create user record in our users table
    const { data: dbUser, error: dbError } = await supabase
      .from('users')
      .insert({
        id: authData.user.id,
        email,
        name,
        role: role || 'admin',
        firm_id: firm_id || null,
      })
      .select()
      .single();

    if (dbError) {
      logger.error('auth', `Failed to create user record: ${dbError.message}`, {
        details: { email, error: dbError.message },
        source: 'routes.auth.signup',
      });
      return res.status(500).json({ error: 'Failed to create user profile' });
    }

    logger.info('auth', `User created: ${email} (${role || 'admin'})`, {
      firmId: firm_id,
      userId: dbUser.id,
      source: 'routes.auth.signup',
    });

    res.status(201).json({ user: dbUser });
  } catch (err) {
    logger.error('auth', `Signup error: ${err.message}`, {
      details: { error: err.message, stack: err.stack },
      source: 'routes.auth.signup',
    });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/login — sign in with email + password
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  if (!supabase) {
    return res.status(500).json({ error: 'Database not configured' });
  }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      logger.warn('auth', `Login failed: ${email} — ${error.message}`, {
        details: { email, error: error.message },
        ip: req.ip,
        source: 'routes.auth.login',
      });
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Fetch user profile
    const { data: dbUser } = await supabase
      .from('users')
      .select('id, email, name, role, firm_id')
      .eq('id', data.user.id)
      .single();

    logger.info('auth', `Login success: ${email}`, {
      userId: data.user.id,
      firmId: dbUser?.firm_id,
      ip: req.ip,
      source: 'routes.auth.login',
    });

    res.json({
      user: dbUser,
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at,
      },
    });
  } catch (err) {
    logger.error('auth', `Login error: ${err.message}`, {
      details: { error: err.message, stack: err.stack },
      source: 'routes.auth.login',
    });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/auth/me — get current user + firm config
router.get('/me', authenticate, async (req, res) => {
  try {
    // Fetch industry config if firm has an industry
    let industryConfig = null;
    if (req.firm?.industry && supabase) {
      const { data } = await supabase
        .from('industry_configs')
        .select('*')
        .eq('industry', req.firm.industry)
        .single();
      industryConfig = data;
    }

    res.json({
      user: req.user,
      firm: req.firm,
      industry_config: industryConfig,
    });
  } catch (err) {
    logger.error('auth', `Failed to fetch user profile: ${err.message}`, {
      userId: req.user?.id,
      source: 'routes.auth.me',
    });
    res.status(500).json({ error: 'Failed to load profile' });
  }
});

module.exports = router;
