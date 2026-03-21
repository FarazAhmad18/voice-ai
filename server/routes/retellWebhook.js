const express = require('express');
const router = express.Router();
const { verifyWebhookSignature } = require('../services/retell');
const logger = require('../services/logger');
const {
  handleWebhook,
  handleCheckAvailability,
  handleBookAppointment,
  handleSaveIntakeData,
  handleGetAppointment,
  handleRescheduleAppointment,
} = require('../controllers/webhookController');

/**
 * Middleware to verify Retell signature on tool call endpoints.
 * Rejects requests if RETELL_API_KEY is not set or signature is invalid.
 */
function verifyRetellToolSignature(req, res, next) {
  if (!process.env.RETELL_API_KEY) {
    logger.error('tool_call', 'RETELL_API_KEY not set — rejecting tool call', {
      ip: req.ip,
      source: 'retellWebhook.verifyRetellToolSignature',
    });
    return res.status(500).json({ error: 'Server misconfiguration' });
  }

  const signature = req.headers['x-retell-signature'];
  const isValid = verifyWebhookSignature(JSON.stringify(req.body), signature);
  if (!isValid) {
    logger.warn('tool_call', 'Tool call signature verification failed', {
      details: { signature: signature || 'missing', path: req.path },
      ip: req.ip,
      source: 'retellWebhook.verifyRetellToolSignature',
    });
    return res.status(401).json({ error: 'Invalid signature' });
  }

  next();
}

// Main webhook endpoint — receives ALL Retell call events
// Retell sends POST to: /api/retell/webhook
router.post('/webhook', handleWebhook);

// Tool call endpoints — called by Retell mid-call
// Each tool has its own URL configured in Retell dashboard
// All tool endpoints require valid Retell signature
router.post('/tool/check-availability', handleCheckAvailability);
router.post('/tool/book-appointment', handleBookAppointment);
router.post('/tool/save-intake-data', handleSaveIntakeData);
router.post('/tool/get-appointment', handleGetAppointment);
router.post('/tool/reschedule-appointment', handleRescheduleAppointment);

module.exports = router;
