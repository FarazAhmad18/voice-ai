const express = require('express');
const router = express.Router();
const supabase = require('../services/supabase');
const logger = require('../services/logger');
const { verifySignature } = require('../services/twilio');

// ── POST /api/twilio/sms ─────────────────────────────────────
// Inbound SMS webhook from Twilio. No JWT auth — verified via Twilio signature.
router.post('/sms', express.urlencoded({ extended: false }), async (req, res) => {
  const start = Date.now();

  // Verify Twilio signature
  if (!verifySignature(req)) {
    logger.error('sms', 'Twilio webhook signature verification failed', {
      ip: req.ip,
      details: { headers: { host: req.headers.host } },
      source: 'twilioWebhook.sms',
    });
    return res.status(403).send('Forbidden');
  }

  const { From: fromNumber, To: toNumber, Body: body } = req.body;

  if (!fromNumber || !toNumber || !body) {
    logger.warn('sms', 'Inbound SMS missing required fields', {
      details: { from: fromNumber, to: toNumber, hasBody: !!body },
      source: 'twilioWebhook.sms',
    });
    // Return 200 to Twilio so it doesn't retry
    res.set('Content-Type', 'text/xml');
    return res.send('<Response></Response>');
  }

  logger.info('sms', `Inbound SMS from ${fromNumber} to ${toNumber}`, {
    details: { from: fromNumber, to: toNumber, bodyLength: body.length },
    source: 'twilioWebhook.sms',
  });

  try {
    // Find the firm by the phone number that received the SMS
    const { data: firm, error: firmError } = await supabase
      .from('firms')
      .select('id, name')
      .eq('retell_phone_number', toNumber)
      .single();

    if (firmError || !firm) {
      logger.warn('sms', `No firm found for phone number ${toNumber}`, {
        details: { to: toNumber, error: firmError?.message },
        source: 'twilioWebhook.sms',
      });
      res.set('Content-Type', 'text/xml');
      return res.send('<Response></Response>');
    }

    // Find the lead by caller phone number within this firm
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('id, caller_name')
      .eq('firm_id', firm.id)
      .eq('caller_phone', fromNumber)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (leadError || !lead) {
      logger.warn('sms', `No lead found for phone ${fromNumber} in firm ${firm.name}`, {
        firmId: firm.id,
        details: { from: fromNumber, firmName: firm.name, error: leadError?.message },
        source: 'twilioWebhook.sms',
      });
      // Still return 200 so Twilio doesn't retry — message is just not matched
      res.set('Content-Type', 'text/xml');
      return res.send('<Response></Response>');
    }

    // Save the inbound message
    const messageRecord = {
      firm_id: firm.id,
      lead_id: lead.id,
      direction: 'inbound',
      channel: 'sms',
      sender: fromNumber,
      sender_id: null, // Inbound from external party
      body,
      subject: null,
      status: 'received',
      external_id: req.body.MessageSid || null,
    };

    const { error: insertError } = await supabase
      .from('messages')
      .insert(messageRecord);

    if (insertError) {
      logger.error('sms', `Failed to save inbound SMS: ${insertError.message}`, {
        firmId: firm.id,
        leadId: lead.id,
        details: { error: insertError.message, from: fromNumber },
        source: 'twilioWebhook.sms',
      });
    } else {
      logger.info('sms', `Inbound SMS saved: ${fromNumber} → ${lead.caller_name} (${firm.name})`, {
        firmId: firm.id,
        leadId: lead.id,
        details: { from: fromNumber, leadName: lead.caller_name },
        durationMs: Date.now() - start,
        source: 'twilioWebhook.sms',
      });
    }
  } catch (err) {
    logger.error('sms', `Inbound SMS processing error: ${err.message}`, {
      details: { error: err.message, stack: err.stack, from: fromNumber, to: toNumber },
      source: 'twilioWebhook.sms',
    });
  }

  // Always return empty TwiML to Twilio (no auto-reply)
  res.set('Content-Type', 'text/xml');
  res.send('<Response></Response>');
});

module.exports = router;
