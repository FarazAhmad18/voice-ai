const express = require('express');
const router = express.Router();
const supabase = require('../services/supabase');
const authenticate = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');
const validateBody = require('../middleware/validateBody');
const logger = require('../services/logger');
const { sanitizeText } = require('../utils/sanitize');

// Client-facing settings — admin can update their own firm
const CLIENT_UPDATABLE = ['name', 'email', 'phone', 'address', 'website', 'business_hours', 'crm_mode', 'crm_type', 'crm_webhook_url', 'crm_api_key'];

/**
 * Validate a URL is not targeting a private/internal IP (SSRF prevention).
 */
function isPrivateUrl(urlString) {
  let parsed;
  try {
    parsed = new URL(urlString);
  } catch {
    return true; // malformed URL treated as invalid
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return true;
  const hostname = parsed.hostname.toLowerCase();
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === '[::1]') return true;
  const ipParts = hostname.split('.').map(Number);
  if (ipParts.length === 4 && ipParts.every(p => !isNaN(p) && p >= 0 && p <= 255)) {
    const [a, b] = ipParts;
    if (a === 10) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true;
    if (a === 127) return true;
    if (a === 0) return true;
  }
  return false;
}

router.use(authenticate, requireRole('admin', 'super_admin'));

// PATCH /api/settings — update own firm's settings
router.patch('/', validateBody(CLIENT_UPDATABLE), async (req, res) => {
  if (!supabase) {
    return res.status(503).json({ error: 'Database service unavailable' });
  }
  if (!req.firm) {
    return res.status(400).json({ error: 'No firm associated with your account — contact support' });
  }

  // BUG 4: Validate CRM webhook URL before saving (SSRF prevention)
  if (req.body.crm_webhook_url) {
    if (isPrivateUrl(req.body.crm_webhook_url)) {
      return res.status(400).json({ error: 'CRM webhook URL cannot target private or internal addresses' });
    }
  }

  // Sanitize all text fields to prevent XSS
  const sanitizedBody = { ...req.body };
  if (sanitizedBody.name) sanitizedBody.name = sanitizeText(sanitizedBody.name, 200);
  if (sanitizedBody.email) sanitizedBody.email = sanitizeText(sanitizedBody.email, 200);
  if (sanitizedBody.phone) sanitizedBody.phone = sanitizeText(sanitizedBody.phone, 30);
  if (sanitizedBody.address) sanitizedBody.address = sanitizeText(sanitizedBody.address, 500);
  if (sanitizedBody.website) sanitizedBody.website = sanitizeText(sanitizedBody.website, 300);
  if (sanitizedBody.business_hours) sanitizedBody.business_hours = sanitizeText(sanitizedBody.business_hours, 200);

  const { data, error } = await supabase
    .from('firms')
    .update(sanitizedBody)
    .eq('id', req.firm.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });

  logger.info('settings', `Firm settings updated: ${data.name}`, {
    firmId: req.firm.id,
    userId: req.user.id,
    details: sanitizedBody,
    source: 'routes.settings.patch',
  });

  res.json(data);
});

module.exports = router;
