const supabase = require('../services/supabase');
const { calculateLeadScore, getScoreLabel } = require('../services/leadScoring');
const { getAvailableSlots, createAppointmentEvent } = require('../services/googleCalendar');
const { verifyWebhookSignature } = require('../services/retell');
const logger = require('../services/logger');
const { maybePushToCRM } = require('./crmPushController');
const { sendMissedCallFollowUp, sendBookingConfirmation } = require('../services/scheduler');

/**
 * Look up the firm associated with a Retell agent_id.
 * Returns the firm record or null if not found.
 */
async function lookupFirmByAgentId(agentId) {
  if (!supabase || !agentId) return null;

  const { data, error } = await supabase
    .from('firms')
    .select('*')
    .eq('retell_agent_id', agentId)
    .single();

  if (error || !data) return null;
  return data;
}

/**
 * Main Retell webhook handler — receives all call events.
 * Events: call_started, call_ended, call_analyzed
 */
async function handleWebhook(req, res) {
  // --- Signature verification ---
  const signature = req.headers['x-retell-signature'];
  if (process.env.RETELL_API_KEY) {
    const isValid = verifyWebhookSignature(JSON.stringify(req.body), signature);
    if (!isValid) {
      logger.warn('retell_webhook', 'Webhook signature verification failed', {
        details: { signature: signature || 'missing' },
        ip: req.ip,
        source: 'webhookController.handleWebhook',
      });
      return res.status(401).json({ error: 'Invalid signature' });
    }
  } else if (process.env.NODE_ENV === 'development') {
    logger.warn('retell_webhook', 'RETELL_API_KEY not set — skipping webhook signature verification (dev mode)', {
      ip: req.ip,
      source: 'webhookController.handleWebhook',
    });
  } else {
    logger.error('retell_webhook', 'RETELL_API_KEY not set in production — rejecting webhook', {
      ip: req.ip,
      source: 'webhookController.handleWebhook',
    });
    return res.status(500).json({ error: 'Server misconfiguration: webhook verification unavailable' });
  }

  const { event, call } = req.body;

  if (!event || !call) {
    logger.warn('retell_webhook', 'Invalid payload — missing event or call', {
      details: { body: req.body },
      ip: req.ip,
      source: 'webhookController.handleWebhook',
    });
    return res.status(400).json({ error: 'Invalid payload' });
  }

  logger.info('retell_webhook', `${event} received`, {
    callId: call.call_id,
    details: { event, agentId: call.agent_id, from: call.from_number },
    source: 'webhookController.handleWebhook',
  });

  switch (event) {
    case 'call_started':
      return handleCallStarted(call, res);

    case 'call_ended':
      await handleCallEnded(call);
      return res.status(200).json({ received: true });

    case 'call_analyzed':
      await handleCallAnalyzed(call);
      return res.status(200).json({ received: true });

    default:
      logger.warn('retell_webhook', `Unhandled event: ${event}`, {
        callId: call.call_id,
        source: 'webhookController.handleWebhook',
      });
      return res.status(200).json({ received: true });
  }
}

/**
 * call_started — log that a call has begun.
 */
function handleCallStarted(call, res) {
  logger.info('retell_webhook', `Call started from ${call.from_number || 'web'}`, {
    callId: call.call_id,
    details: { from: call.from_number, to: call.to_number, direction: call.direction },
    source: 'webhookController.handleCallStarted',
  });
  return res.status(200).json({ received: true });
}

/**
 * call_ended — main processing.
 * Creates lead + call record from the completed call data.
 * Looks up the firm via agent_id for proper multi-tenant routing.
 */
async function handleCallEnded(call) {
  const start = Date.now();

  if (!supabase) {
    logger.error('database', 'Supabase not available — cannot process call_ended', {
      callId: call.call_id,
      source: 'webhookController.handleCallEnded',
    });
    return;
  }

  const callerPhone = call.from_number || 'unknown';
  const agentId = call.agent_id;

  // Look up firm by agent_id — multi-tenant routing
  const firm = await lookupFirmByAgentId(agentId);
  if (!firm) {
    logger.error('retell_webhook', `No firm found for agent_id: ${agentId} — skipping lead creation`, {
      callId: call.call_id,
      details: { agentId, from: callerPhone },
      source: 'webhookController.handleCallEnded',
    });
    return;
  }

  const firmId = firm.id;

  // Calculate duration from timestamps
  const durationMs = (call.end_timestamp && call.start_timestamp)
    ? call.end_timestamp - call.start_timestamp
    : 0;
  const durationSec = Math.round(durationMs / 1000);

  // Build transcript string from transcript_object if available
  let transcriptText = call.transcript || '';
  if (!transcriptText && call.transcript_object && Array.isArray(call.transcript_object)) {
    transcriptText = call.transcript_object
      .map((t) => `${t.role === 'agent' ? 'Agent' : 'User'}: ${t.content}`)
      .join('\n');
  }

  // Find if this caller booked an appointment during the call
  let recentAppointment = null;
  const { data: aptData } = await supabase
    .from('appointments')
    .select('*')
    .eq('caller_phone', callerPhone)
    .eq('firm_id', firmId)
    .order('created_at', { ascending: false })
    .limit(1);
  recentAppointment = aptData?.[0] || null;

  // Build lead data
  const leadData = {
    caller_name: recentAppointment?.caller_name || 'Unknown Caller',
    caller_phone: callerPhone,
    caller_email: recentAppointment?.caller_email || null,
    case_type: recentAppointment?.case_type || 'other',
    urgency: recentAppointment?.urgency || 'low',
    appointment_booked: !!recentAppointment,
    notes: recentAppointment?.notes || '',
  };

  // Calculate lead score
  const score = calculateLeadScore(leadData);
  const scoreLabel = getScoreLabel(score);

  // Check for existing lead with same phone + firm within last 24 hours
  let lead = null;
  let isExistingLead = false;
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  if (callerPhone && callerPhone !== 'unknown') {
    const { data: existingLead } = await supabase
      .from('leads')
      .select('*')
      .eq('caller_phone', callerPhone)
      .eq('firm_id', firmId)
      .gte('created_at', twentyFourHoursAgo)
      .order('created_at', { ascending: false })
      .limit(1);

    if (existingLead && existingLead.length > 0) {
      lead = existingLead[0];
      isExistingLead = true;

      // Update existing lead with new data
      const updates = {
        score,
        score_label: scoreLabel,
        appointment_booked: lead.appointment_booked || !!recentAppointment,
      };
      if (leadData.notes && !lead.notes) updates.notes = leadData.notes;
      if (lead.status === 'new' && recentAppointment) updates.status = 'booked';
      if (leadData.caller_name !== 'Unknown Caller' && lead.caller_name === 'Unknown Caller') {
        updates.caller_name = leadData.caller_name;
      }
      if (leadData.caller_email && !lead.caller_email) updates.caller_email = leadData.caller_email;

      await supabase.from('leads').update(updates).eq('id', lead.id);
      Object.assign(lead, updates);

      logger.info('lead_scoring', `Existing lead updated: ${lead.caller_name} (score: ${score}, ${scoreLabel})`, {
        firmId,
        leadId: lead.id,
        callId: call.call_id,
        details: { score, scoreLabel, duplicatePrevented: true },
        source: 'webhookController.handleCallEnded',
      });
    }
  }

  if (!lead) {
    lead = {
      id: `lead_${Date.now()}`,
      firm_id: firmId,
      ...leadData,
      score,
      score_label: scoreLabel,
      status: recentAppointment ? 'booked' : 'new',
      source: 'phone',
      created_at: new Date().toISOString(),
    };
  }

  const callRecord = {
    id: `call_${Date.now()}`,
    lead_id: lead.id,
    firm_id: firmId,
    retell_call_id: call.call_id,
    transcript: transcriptText,
    summary: '',
    recording_url: call.recording_url || null,
    duration: durationSec,
    ended_reason: call.disconnection_reason || 'unknown',
    created_at: new Date().toISOString(),
  };

  // Link appointment to lead
  if (recentAppointment) {
    await supabase
      .from('appointments')
      .update({ lead_id: lead.id })
      .eq('id', recentAppointment.id);
  }

  // Save to Supabase
  try {
    if (!isExistingLead) {
      await supabase.from('leads').insert(lead);
    }
    await supabase.from('calls').insert(callRecord);

    logger.info('lead_scoring', `Lead created: ${lead.caller_name} (score: ${score}, ${scoreLabel})`, {
      firmId,
      leadId: lead.id,
      callId: call.call_id,
      details: { score, scoreLabel, caseType: lead.case_type, urgency: lead.urgency, booked: lead.appointment_booked },
      durationMs: Date.now() - start,
      source: 'webhookController.handleCallEnded',
    });

    // Update pending intake answers with lead_id and call_id (already inserted by handleSaveIntakeData)
    if (global._pendingIntakeAnswers && global._pendingIntakeAnswers[call.call_id]) {
      const { insertedIds } = global._pendingIntakeAnswers[call.call_id];

      if (insertedIds && insertedIds.length > 0) {
        const { error: intakeErr } = await supabase
          .from('intake_answers')
          .update({ call_id: callRecord.id, lead_id: lead.id, firm_id: firmId })
          .in('id', insertedIds);

        if (intakeErr) {
          logger.error('intake', `Failed to update intake answers: ${intakeErr.message}`, {
            firmId,
            callId: call.call_id,
            leadId: lead.id,
            details: { error: intakeErr.message, answerCount: insertedIds.length },
            source: 'webhookController.handleCallEnded',
          });
        } else {
          logger.info('intake', `Updated ${insertedIds.length} intake answers for lead ${lead.id}`, {
            firmId,
            callId: call.call_id,
            leadId: lead.id,
            source: 'webhookController.handleCallEnded',
          });
        }
      }
      delete global._pendingIntakeAnswers[call.call_id];
    }

    // Push to external CRM if configured (non-blocking, never throws)
    maybePushToCRM(firm, lead, callRecord, recentAppointment);

    // Send booking confirmation if appointment was booked during call
    if (recentAppointment && lead.caller_phone) {
      sendBookingConfirmation(recentAppointment, lead, firm);
    }

    // Send missed call follow-up for unanswered calls
    const missedReasons = ['no_answer', 'dial_no_answer', 'voicemail_reached'];
    if (missedReasons.includes(call.disconnection_reason) && lead.caller_phone) {
      sendMissedCallFollowUp(lead, firm);
    }
  } catch (err) {
    logger.error('database', `Failed to save lead: ${err.message}`, {
      firmId,
      callId: call.call_id,
      details: { error: err.message, leadId: lead.id },
      source: 'webhookController.handleCallEnded',
    });
  }
}

/**
 * call_analyzed — enrichment after post-call analysis.
 * Updates the call and lead with summary and sentiment.
 */
async function handleCallAnalyzed(call) {
  if (!supabase) {
    logger.error('database', 'Supabase not available — cannot process call_analyzed', {
      callId: call.call_id,
      source: 'webhookController.handleCallAnalyzed',
    });
    return;
  }

  const analysis = call.call_analysis;
  if (!analysis) {
    logger.warn('retell_webhook', 'call_analyzed received with no analysis data', {
      callId: call.call_id,
      source: 'webhookController.handleCallAnalyzed',
    });
    return;
  }

  const summary = analysis.call_summary || '';
  const sentiment = analysis.user_sentiment || null;
  const retellCallId = call.call_id;

  try {
    const { data: callData } = await supabase
      .from('calls')
      .update({ summary, sentiment })
      .eq('retell_call_id', retellCallId)
      .select('lead_id')
      .single();

    if (callData?.lead_id) {
      await supabase
        .from('leads')
        .update({ notes: summary, sentiment })
        .eq('id', callData.lead_id);
    }

    logger.info('retell_webhook', `Call analyzed: sentiment=${sentiment}`, {
      callId: retellCallId,
      leadId: callData?.lead_id,
      details: { summary: summary.slice(0, 200), sentiment },
      source: 'webhookController.handleCallAnalyzed',
    });
  } catch (err) {
    logger.error('database', `Failed to update call analysis: ${err.message}`, {
      callId: retellCallId,
      details: { error: err.message },
      source: 'webhookController.handleCallAnalyzed',
    });
  }
}

// ============================================================
// TOOL CALL HANDLERS (called by Retell mid-call)
// ============================================================

/**
 * Handle check_availability tool call.
 */
async function handleCheckAvailability(req, res) {
  const { args, call } = req.body;
  const date = args?.date;

  logger.info('tool_call', `check_availability called for ${date}`, {
    callId: call?.call_id,
    details: { date },
    source: 'webhookController.handleCheckAvailability',
  });

  try {
    const slots = await getAvailableSlots(date);

    logger.info('calendar', `${slots.length} slots available on ${date}`, {
      callId: call?.call_id,
      details: { date, slotCount: slots.length, slots },
      source: 'webhookController.handleCheckAvailability',
    });

    if (slots.length === 0) {
      return res.json({
        available: false,
        date,
        slots: [],
        message: `Unfortunately, we don't have any available times on ${date}. Would you like to try another day?`,
      });
    }

    return res.json({
      available: true,
      date,
      slots,
      message: `We have the following times available on ${date}: ${slots.join(', ')}`,
    });
  } catch (err) {
    logger.error('calendar', `Failed to check availability: ${err.message}`, {
      callId: call?.call_id,
      details: { error: err.message, date },
      source: 'webhookController.handleCheckAvailability',
    });
    return res.json({ available: true, date, slots: ['9:00 AM', '10:30 AM', '1:00 PM', '2:30 PM', '4:00 PM'], message: 'Here are our available times.' });
  }
}

/**
 * Handle book_appointment tool call.
 * Looks up firm by agent_id for multi-tenant support.
 */
async function handleBookAppointment(req, res) {
  if (!supabase) {
    return res.status(503).json({ error: 'Database unavailable' });
  }

  const { args, call } = req.body;
  const {
    caller_name,
    caller_phone,
    caller_email,
    case_type,
    appointment_date,
    appointment_time,
    urgency,
    notes,
  } = args || {};

  // Look up firm by agent_id
  const firm = await lookupFirmByAgentId(call?.agent_id);
  if (!firm) {
    logger.error('tool_call', `book_appointment: No firm found for agent_id ${call?.agent_id}`, {
      callId: call?.call_id,
      source: 'webhookController.handleBookAppointment',
    });
    return res.json({
      success: false,
      message: 'Sorry, I was unable to book the appointment. Please try again later.',
    });
  }

  const firmId = firm.id;

  logger.info('tool_call', `book_appointment: ${caller_name} on ${appointment_date} at ${appointment_time}`, {
    callId: call?.call_id,
    details: { caller_name, caller_phone, case_type, appointment_date, appointment_time, urgency, firmId },
    source: 'webhookController.handleBookAppointment',
  });

  const appointment = {
    id: `apt_${Date.now()}`,
    firm_id: firmId,
    caller_name: caller_name || 'Unknown',
    caller_phone: caller_phone || call?.from_number || 'unknown',
    caller_email: caller_email || null,
    case_type: case_type || 'other',
    appointment_date,
    appointment_time,
    urgency: urgency || 'low',
    notes: notes || '',
    status: 'confirmed',
    created_at: new Date().toISOString(),
  };

  try {
    await supabase.from('appointments').insert(appointment);
    logger.info('appointment', `Booked: ${caller_name} — ${appointment_date} ${appointment_time}`, {
      firmId,
      callId: call?.call_id,
      details: { appointmentId: appointment.id, caseType: case_type },
      source: 'webhookController.handleBookAppointment',
    });
  } catch (err) {
    logger.error('database', `Failed to save appointment: ${err.message}`, {
      firmId,
      callId: call?.call_id,
      details: { error: err.message, appointment },
      source: 'webhookController.handleBookAppointment',
    });
  }

  // Create Google Calendar event
  try {
    await createAppointmentEvent(appointment);
    logger.info('calendar', `Calendar event created for ${caller_name}`, {
      callId: call?.call_id,
      details: { date: appointment_date, time: appointment_time },
      source: 'webhookController.handleBookAppointment',
    });
  } catch (err) {
    logger.error('calendar', `Failed to create calendar event: ${err.message}`, {
      callId: call?.call_id,
      details: { error: err.message },
      source: 'webhookController.handleBookAppointment',
    });
  }

  return res.json({
    success: true,
    appointment_id: appointment.id,
    message: `Your consultation has been booked for ${appointment_date} at ${appointment_time}. Please arrive 10 minutes early and bring a photo ID and any relevant documents.`,
  });
}

/**
 * Handle save_intake_data tool call.
 * Stores structured Q&A from the AI intake conversation.
 * Saves directly to intake_answers table if possible, otherwise holds in memory
 * until the lead is created in handleCallEnded.
 */
async function handleSaveIntakeData(req, res) {
  if (!supabase) {
    return res.status(503).json({ error: 'Database unavailable' });
  }

  const { args, call } = req.body;

  const answerCount = args ? Object.keys(args).length : 0;
  logger.info('tool_call', `save_intake_data: ${answerCount} answers`, {
    callId: call?.call_id,
    details: args,
    source: 'webhookController.handleSaveIntakeData',
  });

  if (args) {
    // Look up firm by agent_id
    const firm = await lookupFirmByAgentId(call?.agent_id);
    const firmId = firm?.id || null;

    const answers = Object.entries(args).map(([question, answer]) => ({
      call_id: null,   // will be set in handleCallEnded when the call record is created
      lead_id: null,   // will be set in handleCallEnded when the lead is created
      firm_id: firmId,
      question: question.replace(/_/g, ' '),
      answer: String(answer),
      created_at: new Date().toISOString(),
    }));

    // Save to intake_answers table immediately (lead_id and call_id will be updated later)
    const { data: insertedRows, error: insertErr } = await supabase
      .from('intake_answers')
      .insert(answers)
      .select('id');

    if (insertErr) {
      logger.error('intake', `Failed to insert intake answers: ${insertErr.message}`, {
        callId: call?.call_id,
        details: { error: insertErr.message, answerCount: answers.length },
        source: 'webhookController.handleSaveIntakeData',
      });
    } else {
      logger.info('intake', `Saved ${answers.length} intake answers to DB`, {
        callId: call?.call_id,
        firmId,
        details: { answerCount: answers.length },
        source: 'webhookController.handleSaveIntakeData',
      });
    }

    // Store inserted IDs in memory so handleCallEnded can UPDATE (not re-INSERT) with lead_id and call_id
    if (!global._pendingIntakeAnswers) global._pendingIntakeAnswers = {};
    const insertedIds = insertedRows ? insertedRows.map((r) => r.id) : [];
    global._pendingIntakeAnswers[call?.call_id] = { answers, insertedIds };

    // TTL cleanup: remove from memory after 1 hour to prevent memory leaks
    setTimeout(() => {
      if (global._pendingIntakeAnswers && global._pendingIntakeAnswers[call?.call_id]) {
        delete global._pendingIntakeAnswers[call?.call_id];
      }
    }, 60 * 60 * 1000);
  }

  return res.json({
    success: true,
    message: 'Thank you, I have recorded all the details.',
  });
}

module.exports = {
  handleWebhook,
  handleCheckAvailability,
  handleBookAppointment,
  handleSaveIntakeData,
};
