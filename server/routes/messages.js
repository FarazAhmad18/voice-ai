const express = require('express');
const router = express.Router();
const supabase = require('../services/supabase');
const logger = require('../services/logger');
const authenticate = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');
const validateBody = require('../middleware/validateBody');
const { sendSMS } = require('../services/twilio');
const { sendEmail } = require('../services/email');
const { normalizePhone } = require('../utils/phone');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// All message routes require authentication and admin/staff role
router.use(authenticate);
router.use(requireRole('admin', 'staff', 'super_admin'));

// ── GET /api/messages?lead_id=xxx ────────────────────────────
// Returns all messages for a lead, scoped to the user's firm.
router.get('/', async (req, res) => {
  const start = Date.now();
  const { lead_id } = req.query;

  if (!lead_id) {
    return res.status(400).json({ error: 'lead_id query parameter is required' });
  }

  try {
    let query = supabase
      .from('messages')
      .select('*')
      .eq('lead_id', lead_id)
      .order('created_at', { ascending: true });

    // Scope to firm (super_admin can see all if they pass firm context)
    if (req.user.role !== 'super_admin' && req.firm) {
      query = query.eq('firm_id', req.firm.id);
    }

    const { data, error } = await query;

    if (error) {
      logger.error('sms', `Failed to fetch messages for lead ${lead_id}: ${error.message}`, {
        firmId: req.firm?.id,
        leadId: lead_id,
        userId: req.user.id,
        source: 'routes.messages.GET',
      });
      return res.status(500).json({ error: 'Failed to fetch messages' });
    }

    logger.info('sms', `Fetched ${data?.length || 0} messages for lead ${lead_id}`, {
      firmId: req.firm?.id,
      userId: req.user?.id,
      leadId: lead_id,
      details: { count: data?.length || 0, duration: Date.now() - start },
      durationMs: Date.now() - start,
      source: 'routes.messages.getAll',
    });

    res.json(data || []);
  } catch (err) {
    logger.error('sms', `Messages fetch error: ${err.message}`, {
      details: { error: err.message, stack: err.stack },
      firmId: req.firm?.id,
      leadId: lead_id,
      source: 'routes.messages.GET',
    });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/messages ───────────────────────────────────────
// Send a message (SMS, email, or internal note).
// Body: { lead_id, channel, body, subject? }
const MESSAGE_FIELDS = ['lead_id', 'channel', 'body', 'subject'];

router.post('/', validateBody(MESSAGE_FIELDS), async (req, res) => {
  const { lead_id, channel, body, subject } = req.body;

  // Validate required fields
  if (!lead_id || !channel || !body) {
    return res.status(400).json({ error: 'lead_id, channel, and body are required' });
  }

  // FIX 6: Body length limit
  if (body.length > 5000) {
    return res.status(400).json({ error: 'Message too long. Maximum 5000 characters.' });
  }

  const validChannels = ['sms', 'email', 'note'];
  if (!validChannels.includes(channel)) {
    return res.status(400).json({ error: `Invalid channel. Must be one of: ${validChannels.join(', ')}` });
  }

  const firmId = req.firm?.id;
  if (!firmId && req.user.role !== 'super_admin') {
    return res.status(400).json({ error: 'No firm associated with this account' });
  }

  try {
    // FIX 5: Rate limit — max 10 outbound SMS/email per lead per hour
    if (channel === 'sms' || channel === 'email') {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { count } = await supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('lead_id', lead_id)
        .eq('channel', channel)
        .eq('direction', 'outbound')
        .gte('created_at', oneHourAgo);

      if (count >= 10) {
        return res.status(429).json({ error: `Too many ${channel} messages to this lead. Max 10 per hour.` });
      }
    }
    // Look up the lead to get their phone number and verify firm ownership
    let leadQuery = supabase
      .from('leads')
      .select('id, caller_name, caller_phone, caller_email, firm_id')
      .eq('id', lead_id)
      .single();

    if (req.user.role !== 'super_admin' && firmId) {
      leadQuery = leadQuery.eq('firm_id', firmId);
    }

    const { data: lead, error: leadError } = await leadQuery;

    if (leadError || !lead) {
      return res.status(404).json({ error: 'Lead not found or access denied' });
    }

    const messageFirmId = lead.firm_id;
    let externalId = null;
    let status = 'sent';

    // ── Channel: SMS ──
    if (channel === 'sms') {
      if (!lead.caller_phone) {
        return res.status(400).json({ error: 'Lead has no phone number on file' });
      }

      // FIX 1: Normalize phone number to E.164 format
      const normalizedPhone = normalizePhone(lead.caller_phone);
      if (!normalizedPhone) {
        return res.status(400).json({ error: 'Lead has an invalid phone number' });
      }

      // Get the firm's phone number to send from
      const { data: firm } = await supabase
        .from('firms')
        .select('retell_phone_number')
        .eq('id', messageFirmId)
        .single();

      const fromNumber = firm?.retell_phone_number || null;

      try {
        const sid = await sendSMS(normalizedPhone, body, fromNumber);
        externalId = sid;
        status = 'sent';

        logger.info('sms', `SMS sent to ${lead.caller_phone} for lead ${lead_id}`, {
          firmId: messageFirmId,
          leadId: lead_id,
          userId: req.user.id,
          details: { to: lead.caller_phone, from: fromNumber, sid },
          source: 'routes.messages.POST.sms',
        });
      } catch (smsErr) {
        status = 'failed';
        logger.error('sms', `SMS send failed for lead ${lead_id}: ${smsErr.message}`, {
          firmId: messageFirmId,
          leadId: lead_id,
          userId: req.user.id,
          details: { error: smsErr.message, to: lead.caller_phone },
          source: 'routes.messages.POST.sms',
        });
        // Continue to save the message record with 'failed' status
      }
    }

    // ── Channel: Email ──
    if (channel === 'email') {
      if (!lead.caller_email) {
        return res.status(400).json({ error: 'Lead has no email address on file' });
      }

      // FIX 2: Validate email format before sending
      if (!EMAIL_REGEX.test(lead.caller_email)) {
        return res.status(400).json({ error: 'Lead has no valid email address' });
      }

      try {
        const resendId = await sendEmail(lead.caller_email, subject || '(No subject)', body);
        externalId = resendId;
        status = 'sent';

        logger.info('email', `Email sent to ${lead.caller_email} for lead ${lead_id}`, {
          firmId: messageFirmId,
          leadId: lead_id,
          userId: req.user.id,
          details: { to: lead.caller_email, subject, resendId },
          source: 'routes.messages.POST.email',
        });
      } catch (emailErr) {
        status = 'failed';
        logger.error('email', `Email send failed for lead ${lead_id}: ${emailErr.message}`, {
          firmId: messageFirmId,
          leadId: lead_id,
          userId: req.user.id,
          details: { error: emailErr.message, to: lead.caller_email },
          source: 'routes.messages.POST.email',
        });
        // Continue to save the message record with 'failed' status
      }
    }

    // ── Channel: Note ──
    if (channel === 'note') {
      status = 'sent'; // Internal notes are always "sent"
      logger.info('sms', `Internal note added for lead ${lead_id}`, {
        firmId: messageFirmId,
        leadId: lead_id,
        userId: req.user.id,
        source: 'routes.messages.POST.note',
      });
    }

    // Save message to database
    const messageRecord = {
      firm_id: messageFirmId,
      lead_id,
      direction: 'outbound',
      channel,
      sender: req.user.name || req.user.email,
      sender_id: req.user.id,
      body,
      subject: channel === 'email' ? (subject || null) : null,
      status,
      external_id: externalId,
    };

    const { data: savedMessage, error: insertError } = await supabase
      .from('messages')
      .insert(messageRecord)
      .select()
      .single();

    if (insertError) {
      logger.error('sms', `Failed to save message record: ${insertError.message}`, {
        firmId: messageFirmId,
        leadId: lead_id,
        userId: req.user.id,
        details: { error: insertError.message },
        source: 'routes.messages.POST',
      });
      return res.status(500).json({ error: 'Message sent but failed to save record' });
    }

    res.status(201).json(savedMessage);
  } catch (err) {
    logger.error('sms', `Message send error: ${err.message}`, {
      details: { error: err.message, stack: err.stack },
      firmId,
      leadId: lead_id,
      userId: req.user.id,
      source: 'routes.messages.POST',
    });
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
