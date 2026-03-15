const express = require('express');
const router = express.Router();
const {
  handleWebhook,
  handleCheckAvailability,
  handleBookAppointment,
  handleSaveIntakeData,
} = require('../controllers/webhookController');

// Main webhook endpoint — receives ALL Retell call events
// Retell sends POST to: /api/retell/webhook
router.post('/webhook', handleWebhook);

// Tool call endpoints — called by Retell mid-call
// Each tool has its own URL configured in Retell dashboard
router.post('/tool/check-availability', handleCheckAvailability);
router.post('/tool/book-appointment', handleBookAppointment);
router.post('/tool/save-intake-data', handleSaveIntakeData);

module.exports = router;
