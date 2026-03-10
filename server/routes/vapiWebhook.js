const express = require('express');
const router = express.Router();
const { handleWebhook } = require('../controllers/webhookController');

// Main webhook endpoint - receives ALL VAPI events
// VAPI sends POST to: /api/vapi/webhook
router.post('/webhook', handleWebhook);

module.exports = router;
