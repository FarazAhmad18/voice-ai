const express = require('express');
const router = express.Router();
const supabase = require('../services/supabase');
const authenticate = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');
const validateBody = require('../middleware/validateBody');
const logger = require('../services/logger');
const { sanitizeText } = require('../utils/sanitize');
const { updateFirmAgent } = require('../controllers/agentController');

// Client-facing settings — admin can update their own firm
const CLIENT_UPDATABLE = ['name', 'email', 'phone', 'address', 'website', 'business_hours', 'crm_mode', 'crm_type', 'crm_webhook_url', 'crm_api_key', 'calendar_mode', 'google_calendar_id'];

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

  if (error) {
    logger.error('database', `Failed to update settings: ${error.message}`, {
      firmId: req.firm.id,
      userId: req.user.id,
      source: 'routes.settings.patch',
    });
    return res.status(500).json({ error: 'Failed to update settings. Please try again.' });
  }

  logger.info('settings', `Firm settings updated: ${data.name}`, {
    firmId: req.firm.id,
    userId: req.user.id,
    details: sanitizedBody,
    source: 'routes.settings.patch',
  });

  res.json(data);
});

// POST /api/settings/test-webhook — test webhook URL server-side (prevents SSRF from browser)
router.post('/test-webhook', async (req, res) => {
  const { webhook_url } = req.body;
  if (!webhook_url) {
    return res.status(400).json({ error: 'webhook_url is required' });
  }

  if (isPrivateUrl(webhook_url)) {
    return res.status(400).json({ error: 'Webhook URL cannot target private or internal addresses' });
  }

  const testPayload = {
    event: 'test',
    timestamp: new Date().toISOString(),
    firm: { id: req.firm?.id || 'test', name: req.firm?.name || 'Test Firm' },
    lead: {
      id: 'test_lead',
      name: 'Test Lead',
      phone: '+10000000000',
      service_type: 'other',
      urgency: 'low',
      score: 50,
      score_label: 'warm',
      summary: 'This is a test webhook payload from VoibixAI.',
    },
    appointment: null,
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const headers = { 'Content-Type': 'application/json', 'User-Agent': 'VoibixAI/1.0' };
    if (req.firm?.crm_api_key) {
      headers['Authorization'] = `Bearer ${req.firm.crm_api_key}`;
    }

    const response = await fetch(webhook_url, {
      method: 'POST',
      headers,
      body: JSON.stringify(testPayload),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (response.ok) {
      res.json({ success: true, status: response.status });
    } else {
      res.status(response.status).json({ success: false, status: response.status });
    }
  } catch (err) {
    clearTimeout(timeout);
    const isTimeout = err.name === 'AbortError';
    res.status(502).json({ error: isTimeout ? 'Webhook timed out after 5s' : err.message });
  }
});

// POST /api/settings/sync-agent — save Retell IDs and push rendered prompt to Retell LLM
router.post('/sync-agent', requireRole('admin', 'super_admin'), async (req, res) => {
  if (!supabase || !req.firm) return res.status(400).json({ error: 'No firm associated' });

  const { agent_id, llm_id } = req.body;

  // Update stored IDs if provided
  const updates = {};
  if (agent_id && typeof agent_id === 'string') updates.retell_agent_id = agent_id.trim();
  if (llm_id && typeof llm_id === 'string') updates.retell_llm_id = llm_id.trim();

  if (Object.keys(updates).length > 0) {
    const { error } = await supabase.from('firms').update(updates).eq('id', req.firm.id);
    if (error) {
      logger.error('retell_api', `Failed to save Retell IDs: ${error.message}`, { firmId: req.firm.id });
      return res.status(500).json({ error: 'Failed to save IDs' });
    }
  }

  // Re-render prompt and push to Retell LLM
  try {
    const result = await updateFirmAgent(req.firm.id);
    logger.info('retell_api', `Manual agent sync triggered by ${req.user.email}`, {
      firmId: req.firm.id,
      userId: req.user.id,
      details: { agentId: result?.agentId, llmId: result?.llmId, promptLength: result?.renderedPrompt?.length },
    });
    res.json({ success: true, agentId: result?.agentId, llmId: result?.llmId, promptLength: result?.renderedPrompt?.length });
  } catch (err) {
    logger.error('retell_api', `Manual agent sync failed: ${err.message}`, { firmId: req.firm.id });
    res.status(500).json({ error: err.message || 'Sync failed' });
  }
});

module.exports = router;
