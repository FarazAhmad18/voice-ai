const supabase = require('../services/supabase');
const { calculateLeadScore, getScoreLabel } = require('../services/leadScoring');
const { getAvailableSlots, createAppointmentEvent } = require('../services/googleCalendar');
const { verifyWebhookSignature } = require('../services/retell');
const logger = require('../services/logger');

// Default firm ID for MVP (Mitchell Family Law)
// In multi-tenant mode, this will be looked up from firms table via agent_id
const DEFAULT_FIRM_ID = 'a0000000-0000-0000-0000-000000000001';

// In-memory storage fallback (will be removed in multi-tenant phase)
const localStore = {
  leads: [],
  calls: [],
  appointments: [],
};

/**
 * Main Retell webhook handler — receives all call events.
 * Events: call_started, call_ended, call_analyzed
 */
async function handleWebhook(req, res) {
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
 */
async function handleCallEnded(call) {
  const start = Date.now();
  const callerPhone = call.from_number || 'unknown';
  const agentId = call.agent_id;

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
  if (supabase) {
    const { data } = await supabase
      .from('appointments')
      .select('*')
      .eq('caller_phone', callerPhone)
      .order('created_at', { ascending: false })
      .limit(1);
    recentAppointment = data?.[0] || null;
  } else {
    recentAppointment = localStore.appointments.find(
      (apt) => apt.caller_phone === callerPhone
    );
  }

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

  const lead = {
    id: `lead_${Date.now()}`,
    firm_id: DEFAULT_FIRM_ID,
    ...leadData,
    score,
    score_label: scoreLabel,
    status: recentAppointment ? 'booked' : 'new',
    source: 'phone',
    created_at: new Date().toISOString(),
  };

  const callRecord = {
    id: `call_${Date.now()}`,
    lead_id: lead.id,
    firm_id: DEFAULT_FIRM_ID,
    retell_call_id: call.call_id,
    transcript: transcriptText,
    summary: '',
    recording_url: call.recording_url || null,
    duration: durationSec,
    ended_reason: call.disconnection_reason || 'unknown',
    created_at: new Date().toISOString(),
  };

  // Link appointment to lead
  if (recentAppointment && supabase) {
    await supabase
      .from('appointments')
      .update({ lead_id: lead.id })
      .eq('id', recentAppointment.id);
  }

  // Save to Supabase or local store
  if (supabase) {
    try {
      await supabase.from('leads').insert(lead);
      await supabase.from('calls').insert(callRecord);

      logger.info('lead_scoring', `Lead created: ${lead.caller_name} (score: ${score}, ${scoreLabel})`, {
        firmId: lead.firm_id,
        leadId: lead.id,
        callId: call.call_id,
        details: { score, scoreLabel, caseType: lead.case_type, urgency: lead.urgency, booked: lead.appointment_booked },
        durationMs: Date.now() - start,
        source: 'webhookController.handleCallEnded',
      });
    } catch (err) {
      logger.error('database', `Failed to save lead: ${err.message}`, {
        firmId: DEFAULT_FIRM_ID,
        callId: call.call_id,
        details: { error: err.message, leadId: lead.id },
        source: 'webhookController.handleCallEnded',
      });
      localStore.leads.push(lead);
      localStore.calls.push(callRecord);
    }
  } else {
    localStore.leads.push(lead);
    localStore.calls.push(callRecord);

    logger.info('lead_scoring', `Lead created (local): ${lead.caller_name} (score: ${score}, ${scoreLabel})`, {
      leadId: lead.id,
      callId: call.call_id,
      details: { score, scoreLabel, caseType: lead.case_type },
      durationMs: Date.now() - start,
      source: 'webhookController.handleCallEnded',
    });
  }
}

/**
 * call_analyzed — enrichment after post-call analysis.
 * Updates the call and lead with summary and sentiment.
 */
async function handleCallAnalyzed(call) {
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

  if (supabase) {
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
  } else {
    const callRecord = localStore.calls.find((c) => c.retell_call_id === retellCallId);
    if (callRecord) {
      callRecord.summary = summary;
      callRecord.sentiment = sentiment;
      const lead = localStore.leads.find((l) => l.id === callRecord.lead_id);
      if (lead) {
        lead.notes = summary;
        lead.sentiment = sentiment;
      }
    }
    logger.info('retell_webhook', `Call analyzed (local): sentiment=${sentiment}`, {
      callId: retellCallId,
      details: { summary: summary.slice(0, 200), sentiment },
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
 */
async function handleBookAppointment(req, res) {
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

  logger.info('tool_call', `book_appointment: ${caller_name} on ${appointment_date} at ${appointment_time}`, {
    callId: call?.call_id,
    details: { caller_name, caller_phone, case_type, appointment_date, appointment_time, urgency },
    source: 'webhookController.handleBookAppointment',
  });

  const appointment = {
    id: `apt_${Date.now()}`,
    firm_id: DEFAULT_FIRM_ID,
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

  if (supabase) {
    try {
      await supabase.from('appointments').insert(appointment);
      logger.info('appointment', `Booked: ${caller_name} — ${appointment_date} ${appointment_time}`, {
        firmId: DEFAULT_FIRM_ID,
        callId: call?.call_id,
        details: { appointmentId: appointment.id, caseType: case_type },
        source: 'webhookController.handleBookAppointment',
      });
    } catch (err) {
      logger.error('database', `Failed to save appointment: ${err.message}`, {
        firmId: DEFAULT_FIRM_ID,
        callId: call?.call_id,
        details: { error: err.message, appointment },
        source: 'webhookController.handleBookAppointment',
      });
      localStore.appointments.push(appointment);
    }
  } else {
    localStore.appointments.push(appointment);
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
 */
async function handleSaveIntakeData(req, res) {
  const { args, call } = req.body;

  const answerCount = args ? Object.keys(args).length : 0;
  logger.info('tool_call', `save_intake_data: ${answerCount} answers`, {
    callId: call?.call_id,
    details: args,
    source: 'webhookController.handleSaveIntakeData',
  });

  if (supabase && args) {
    try {
      const answers = Object.entries(args).map(([question, answer]) => ({
        call_id: null,
        lead_id: null,
        firm_id: DEFAULT_FIRM_ID,
        question: question.replace(/_/g, ' '),
        answer: String(answer),
        created_at: new Date().toISOString(),
      }));

      if (!global._pendingIntakeAnswers) global._pendingIntakeAnswers = {};
      global._pendingIntakeAnswers[call?.call_id] = answers;

      logger.info('intake', `Stored ${answers.length} intake answers for call ${call?.call_id}`, {
        callId: call?.call_id,
        details: { answerCount: answers.length },
        source: 'webhookController.handleSaveIntakeData',
      });
    } catch (err) {
      logger.error('intake', `Failed to store intake data: ${err.message}`, {
        callId: call?.call_id,
        details: { error: err.message, args },
        source: 'webhookController.handleSaveIntakeData',
      });
    }
  }

  return res.json({
    success: true,
    message: 'Thank you, I have recorded all the details.',
  });
}

// Export for API routes
function getLocalStore() {
  return localStore;
}

module.exports = {
  handleWebhook,
  handleCheckAvailability,
  handleBookAppointment,
  handleSaveIntakeData,
  getLocalStore,
};
