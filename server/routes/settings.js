const express = require('express');
const router = express.Router();
const supabase = require('../services/supabase');
const authenticate = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');
const validateBody = require('../middleware/validateBody');
const logger = require('../services/logger');

// Client-facing settings — admin can update their own firm
const CLIENT_UPDATABLE = ['name', 'email', 'phone', 'address', 'website', 'business_hours', 'crm_mode', 'crm_type', 'crm_webhook_url', 'crm_api_key'];

router.use(authenticate, requireRole('admin', 'super_admin'));

// PATCH /api/settings — update own firm's settings
router.patch('/', validateBody(CLIENT_UPDATABLE), async (req, res) => {
  if (!supabase || !req.firm) {
    return res.status(500).json({ error: 'Not available' });
  }

  const { data, error } = await supabase
    .from('firms')
    .update(req.body)
    .eq('id', req.firm.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });

  logger.info('settings', `Firm settings updated: ${data.name}`, {
    firmId: req.firm.id,
    userId: req.user.id,
    details: req.body,
    source: 'routes.settings.patch',
  });

  res.json(data);
});

module.exports = router;
