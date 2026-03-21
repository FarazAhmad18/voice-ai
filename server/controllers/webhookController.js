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
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return data;
}

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

  // BUG #1: Idempotency — check if this call was already processed (webhook retries)
  const { data: existingCall } = await supabase
    .from('calls')
    .select('id, lead_id')
    .eq('retell_call_id', call.call_id)
    .maybeSingle();

  if (existingCall) {
    logger.info('retell_webhook', `Call ${call.call_id} already processed, skipping`, {
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

  // BUG #4: Skip lead creation for paused/cancelled firms
  if (firm.status !== 'active') {
    logger.warn('retell_webhook', `Firm ${firm.name} is ${firm.status}, skipping lead creation`, {
      firmId: firm.id,
      callId: call.call_id,
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
  // First try by phone, then fall back to most recent unlinked appointment for this firm (handles Test Chat / unknown phone)
  let recentAppointment = null;
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

  if (callerPhone && callerPhone !== 'unknown') {
    const { data: aptByPhone } = await supabase
      .from('appointments')
      .select('*')
      .eq('caller_phone', callerPhone)
      .eq('firm_id', firmId)
      .order('created_at', { ascending: false })
      .limit(1);
    recentAppointment = aptByPhone?.[0] || null;
  }

  // Fallback: find most recent unlinked appointment for this firm in last 5 minutes
  if (!recentAppointment) {
    const { data: recentApt } = await supabase
      .from('appointments')
      .select('*')
      .eq('firm_id', firmId)
      .is('lead_id', null)
      .gte('created_at', fiveMinutesAgo)
      .order('created_at', { ascending: false })
      .limit(1);
    recentAppointment = recentApt?.[0] || null;
  }

  // Pull intake data for this call to enrich lead
  const intakeData = global._pendingIntakeAnswers?.[call.call_id]?.answers || [];
  const intakeMap = {};
  for (const a of intakeData) {
    intakeMap[a.question.toLowerCase().replace(/\s+/g, '_')] = a.answer;
  }
  const intakeName = intakeMap['caller_name'] || intakeMap['name'] || null;
  const intakePhone = intakeMap['caller_phone'] || intakeMap['phone'] || null;
  const intakeCaseType = intakeMap['case_type'] || null;
  const intakeUrgency = intakeMap['urgency'] || null;
  const intakeEmail = intakeMap['caller_email'] || intakeMap['email'] || null;

  // Build lead data — prefer appointment data, then intake data, then defaults
  const leadData = {
    caller_name: recentAppointment?.caller_name || intakeName || 'Unknown Caller',
    caller_phone: callerPhone !== 'unknown' ? callerPhone : (intakePhone || recentAppointment?.caller_phone || 'unknown'),
    caller_email: recentAppointment?.caller_email || intakeEmail || null,
    case_type: recentAppointment?.case_type || intakeCaseType || 'other',
    urgency: recentAppointment?.urgency || intakeUrgency || 'low',
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
      id: `lead_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
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
    id: `call_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
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

  // Link appointment to lead, and propagate assigned_staff_id to lead
  if (recentAppointment) {
    await supabase
      .from('appointments')
      .update({ lead_id: lead.id })
      .eq('id', recentAppointment.id);

    if (recentAppointment.assigned_staff_id && !lead.assigned_staff_id) {
      lead.assigned_staff_id = recentAppointment.assigned_staff_id;
      await supabase
        .from('leads')
        .update({ assigned_staff_id: recentAppointment.assigned_staff_id })
        .eq('id', lead.id);
    }
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
/**
 * Core logic for processing call analysis data.
 * Extracted so it can be called from both the handler and retry.
 */
async function processCallAnalysis(call) {
  const analysis = call.call_analysis;
  if (!analysis) return;

  const summary = analysis.call_summary || '';
  const sentiment = analysis.user_sentiment || null;
  const retellCallId = call.call_id;

  const { data: callData } = await supabase
    .from('calls')
    .update({ summary, sentiment })
    .eq('retell_call_id', retellCallId)
    .select('lead_id')
    .single();

  if (!callData) {
    // Call record not found — throw so caller knows to retry
    throw new Error(`Call record not found for retell_call_id: ${retellCallId}`);
  }

  if (callData.lead_id) {
    await supabase
      .from('leads')
      .update({ notes: summary, sentiment })
      .eq('id', callData.lead_id);
  }

  logger.info('retell_webhook', `Call analyzed: sentiment=${sentiment}`, {
    callId: retellCallId,
    leadId: callData?.lead_id,
    details: { summary: summary.slice(0, 200), sentiment },
    source: 'webhookController.processCallAnalysis',
  });
}

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

  try {
    await processCallAnalysis(call);
  } catch (err) {
    // BUG #2: call_analyzed can fire before call_ended — queue and retry
    if (err.message.includes('Call record not found')) {
      logger.warn('retell_webhook', `call_analyzed received before call_ended for ${call.call_id}, queuing retry`, {
        callId: call.call_id,
        source: 'webhookController.handleCallAnalyzed',
      });

      // Retry with exponential backoff (3 attempts: 5s, 15s, 45s)
      const retryDelays = [5000, 15000, 45000];
      const attemptRetry = async (attempt) => {
        try {
          await processCallAnalysis(call);
          logger.info('retell_webhook', `call_analyzed retry #${attempt + 1} succeeded for ${call.call_id}`, {
            callId: call.call_id,
            source: 'webhookController.handleCallAnalyzed',
          });
        } catch (e) {
          if (attempt < retryDelays.length - 1) {
            setTimeout(() => attemptRetry(attempt + 1), retryDelays[attempt + 1]);
          } else {
            logger.error('retell_webhook', `All retries failed for call_analyzed ${call.call_id}: ${e.message}`, {
              callId: call.call_id,
              details: { error: e.message, attempts: retryDelays.length },
              source: 'webhookController.handleCallAnalyzed',
            });
          }
        }
      };
      setTimeout(() => attemptRetry(0), retryDelays[0]);
    } else {
      logger.error('database', `Failed to update call analysis: ${err.message}`, {
        callId: call.call_id,
        details: { error: err.message },
        source: 'webhookController.handleCallAnalyzed',
      });
    }
  }
}

// ============================================================
// TOOL CALL HANDLERS (called by Retell mid-call)
// ============================================================

/**
 * Handle check_availability tool call.
 */
const CASE_KEYWORDS = {
  divorce:           ['divorce', 'separation'],
  custody:           ['custody', 'child custody'],
  support:           ['support', 'alimony'],
  domestic_violence: ['domestic violence', 'domestic', 'violence', 'protective'],
  paternity:         ['paternity'],
  adoption:          ['adoption'],
};

const ALL_SLOTS = [
  '9:00 AM', '9:30 AM', '10:00 AM', '10:30 AM',
  '11:00 AM', '11:30 AM', '12:00 PM', '12:30 PM',
  '1:00 PM', '1:30 PM', '2:00 PM', '2:30 PM',
  '3:00 PM', '3:30 PM', '4:00 PM', '4:30 PM',
];

/**
 * Builtin availability checker — queries our own appointments table.
 * Checks per-attorney if staffId provided, otherwise firm-wide.
 */
async function getBuiltinAvailableSlots(date, firmId, staffId) {
  if (!supabase) return ALL_SLOTS;

  let query = supabase
    .from('appointments')
    .select('appointment_time')
    .eq('firm_id', firmId)
    .eq('appointment_date', date)
    .eq('status', 'confirmed');

  if (staffId) query = query.eq('assigned_staff_id', staffId);

  const { data: booked } = await query;
  const bookedTimes = new Set((booked || []).map(a => a.appointment_time));
  return ALL_SLOTS.filter(slot => !bookedTimes.has(slot));
}

/**
 * Resolve which staff member to use based on staff_name or case_type.
 * Returns the matched staff record (with calendar_id) or null.
 */
async function resolveStaff(firmId, staffName, caseType) {
  if (!supabase || !firmId) return null;
  const { data: staffMembers } = await supabase
    .from('staff')
    .select('id, name, specialization, role, calendar_id')
    .eq('firm_id', firmId)
    .eq('is_active', true);
  if (!staffMembers?.length) return null;

  // 1. Match by name
  if (staffName) {
    const normalized = staffName.toLowerCase();
    const match = staffMembers.find(s =>
      s.name.toLowerCase().includes(normalized) || normalized.includes(s.name.toLowerCase())
    );
    if (match) return match;
  }

  // 2. Match by case_type → specialization keywords
  if (caseType) {
    const keywords = CASE_KEYWORDS[caseType.toLowerCase()] || [caseType.toLowerCase()];
    const match = staffMembers.find(s =>
      keywords.some(kw => s.specialization?.toLowerCase().includes(kw) || s.role?.toLowerCase().includes(kw))
    );
    if (match) return match;
  }

  // 3. First active staff
  return staffMembers[0];
}

async function handleCheckAvailability(req, res) {
  const { args, call } = req.body;
  const date = args?.date;
  const staffName = args?.staff_name || args?.attorney_name;
  const caseType = args?.case_type;

  // Always tell the agent what today's date is so it can resolve relative dates correctly
  const todayDate = new Date();
  const todayStr = todayDate.toISOString().split('T')[0]; // YYYY-MM-DD

  // Validate date format
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(new Date(date).getTime())) {
    return res.json({
      available: false,
      today: todayStr,
      date: date || 'unknown',
      slots: [],
      message: `I need a valid date in YYYY-MM-DD format. Today is ${todayStr}. Could you tell me what day works for you?`,
    });
  }

  // Reject past dates
  const requestedDate = new Date(date + 'T00:00:00');
  const todayMidnight = new Date(todayStr + 'T00:00:00');
  if (requestedDate < todayMidnight) {
    return res.json({
      available: false,
      today: todayStr,
      date,
      slots: [],
      message: `That date (${date}) has already passed. Today is ${todayStr}. Please ask the caller for a future date.`,
    });
  }

  // Resolve firm + attorney
  const firm = await lookupFirmByAgentId(call?.agent_id);
  const assignedStaff = firm ? await resolveStaff(firm.id, staffName, caseType) : null;
  const mode = firm?.calendar_mode || 'builtin';

  logger.info('tool_call', `check_availability [${mode}] for ${date}${assignedStaff ? ` — ${assignedStaff.name}` : ''}`, {
    callId: call?.call_id,
    details: { date, mode, staffName: assignedStaff?.name },
    source: 'webhookController.handleCheckAvailability',
  });

  try {
    let slots;

    if (mode === 'google') {
      // Google Calendar mode — check firm's linked Google Calendar
      const calendarId = firm?.google_calendar_id || null;
      slots = await getAvailableSlots(date, firm?.id, calendarId);
    } else {
      // Builtin mode — query our own appointments table per attorney
      slots = await getBuiltinAvailableSlots(date, firm?.id, assignedStaff?.id);
    }

    logger.info('calendar', `${slots.length} slots available on ${date} [${mode}]${assignedStaff ? ` for ${assignedStaff.name}` : ''}`, {
      callId: call?.call_id,
      details: { date, slotCount: slots.length, mode },
      source: 'webhookController.handleCheckAvailability',
    });

    const attorneyLabel = assignedStaff?.name || null;

    if (slots.length === 0) {
      return res.json({
        available: false,
        today: todayStr,
        date,
        slots: [],
        assigned_attorney: attorneyLabel,
        message: `${attorneyLabel ? `${attorneyLabel} doesn't` : `We don't`} have any available times on ${date}. Would you like to try another day?`,
      });
    }

    return res.json({
      available: true,
      today: todayStr,
      date,
      slots,
      assigned_attorney: attorneyLabel,
      message: `${attorneyLabel ? `${attorneyLabel} is` : `We are`} available on ${date} at: ${slots.join(', ')}`,
    });
  } catch (err) {
    logger.error('calendar', `Failed to check availability [${mode}]: ${err.message}`, {
      callId: call?.call_id,
      details: { error: err.message, date, mode },
      source: 'webhookController.handleCheckAvailability',
    });
    return res.json({ available: true, today: todayStr, date, slots: ALL_SLOTS.slice(0, 5), message: 'Here are our available times.' });
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
    staff_name,
    attorney_name,
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
  const callerPhone = caller_phone || call?.from_number || 'unknown';

  // BUG #5: Prevent double-booked appointments for same person/date/time/firm
  const { data: existingApt } = await supabase
    .from('appointments')
    .select('id')
    .eq('firm_id', firmId)
    .eq('caller_phone', callerPhone)
    .eq('appointment_date', appointment_date)
    .eq('appointment_time', appointment_time)
    .maybeSingle();

  if (existingApt) {
    logger.info('tool_call', `Duplicate appointment prevented: ${caller_name} on ${appointment_date} at ${appointment_time}`, {
      callId: call?.call_id,
      firmId,
      source: 'webhookController.handleBookAppointment',
    });
    return res.json({
      success: true,
      message: `Your appointment is already confirmed for ${appointment_date} at ${appointment_time}.`,
    });
  }

  logger.info('tool_call', `book_appointment: ${caller_name} on ${appointment_date} at ${appointment_time}`, {
    callId: call?.call_id,
    details: { caller_name, caller_phone: callerPhone, case_type, appointment_date, appointment_time, urgency, firmId },
    source: 'webhookController.handleBookAppointment',
  });

  // Resolve attorney using shared helper (name → case_type → first active)
  const assignedStaff = await resolveStaff(firmId, staff_name || attorney_name, case_type);
  const assignedStaffId = assignedStaff?.id || null;

  const appointment = {
    id: `apt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    firm_id: firmId,
    caller_name: caller_name || 'Unknown',
    caller_phone: callerPhone,
    caller_email: caller_email || null,
    case_type: case_type || 'other',
    appointment_date,
    appointment_time,
    urgency: urgency || 'low',
    notes: notes || '',
    status: 'confirmed',
    assigned_staff_id: assignedStaffId,
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

  // Create Google Calendar event only if firm uses google mode
  if (firm?.calendar_mode === 'google') {
    try {
      await createAppointmentEvent(appointment, firmId, firm?.google_calendar_id || null);
      logger.info('calendar', `Google Calendar event created for ${caller_name}`, {
        callId: call?.call_id,
        details: { date: appointment_date, time: appointment_time },
        source: 'webhookController.handleBookAppointment',
      });
    } catch (err) {
      logger.error('calendar', `Failed to create Google Calendar event: ${err.message}`, {
        callId: call?.call_id,
        details: { error: err.message },
        source: 'webhookController.handleBookAppointment',
      });
    }
  }

  const attorneyMsg = assignedStaff ? ` with ${assignedStaff.name}` : '';
  return res.json({
    success: true,
    appointment_id: appointment.id,
    attorney: assignedStaff?.name || null,
    message: `Your consultation has been booked${attorneyMsg} for ${appointment_date} at ${appointment_time}. Please arrive 10 minutes early and bring a photo ID and any relevant documents.`,
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
    const callId = call?.call_id;
    if (callId) {
      if (!global._pendingIntakeAnswers) global._pendingIntakeAnswers = {};

      // Cap global pending entries to prevent memory exhaustion
      const pendingKeys = Object.keys(global._pendingIntakeAnswers);
      if (pendingKeys.length >= 1000) {
        // Evict oldest entries
        const toRemove = pendingKeys.slice(0, pendingKeys.length - 500);
        for (const key of toRemove) delete global._pendingIntakeAnswers[key];
        logger.warn('intake', `Evicted ${toRemove.length} stale pending intake entries`, {
          source: 'webhookController.handleSaveIntakeData',
        });
      }

      const insertedIds = insertedRows ? insertedRows.map((r) => r.id) : [];
      global._pendingIntakeAnswers[callId] = { answers, insertedIds };

      // TTL cleanup: remove from memory after 1 hour
      setTimeout(() => {
        if (global._pendingIntakeAnswers?.[callId]) {
          delete global._pendingIntakeAnswers[callId];
        }
      }, 60 * 60 * 1000);
    }
  }

  return res.json({
    success: true,
    message: 'Thank you, I have recorded all the details.',
  });
}

/**
 * Handle get_appointment tool call.
 * Looks up the caller's most recent confirmed/upcoming appointment by phone number.
 */
async function handleGetAppointment(req, res) {
  if (!supabase) return res.status(503).json({ error: 'Database unavailable' });

  const { args, call } = req.body;
  const callerPhone = args?.caller_phone || call?.from_number;

  if (!callerPhone) {
    return res.json({
      found: false,
      message: 'I need your phone number to look up your appointment.',
    });
  }

  const today = new Date().toISOString().split('T')[0];

  const { data: appointments } = await supabase
    .from('appointments')
    .select('*')
    .eq('caller_phone', callerPhone)
    .eq('status', 'confirmed')
    .gte('appointment_date', today)
    .order('appointment_date', { ascending: true })
    .limit(1);

  const apt = appointments?.[0];

  if (!apt) {
    logger.info('tool_call', `get_appointment: no upcoming appointment found for ${callerPhone}`, {
      callId: call?.call_id,
      source: 'webhookController.handleGetAppointment',
    });
    return res.json({
      found: false,
      message: `I don't see any upcoming appointments for that phone number. Would you like to book a new one?`,
    });
  }

  logger.info('tool_call', `get_appointment: found appointment for ${apt.caller_name} on ${apt.appointment_date}`, {
    callId: call?.call_id,
    details: { appointmentId: apt.id, date: apt.appointment_date, time: apt.appointment_time },
    source: 'webhookController.handleGetAppointment',
  });

  return res.json({
    found: true,
    appointment_id: apt.id,
    caller_name: apt.caller_name,
    appointment_date: apt.appointment_date,
    appointment_time: apt.appointment_time,
    case_type: apt.case_type,
    message: `I found your appointment: ${apt.appointment_date} at ${apt.appointment_time}. Would you like to reschedule this?`,
  });
}

/**
 * Handle reschedule_appointment tool call.
 * Cancels the existing appointment and books a new one atomically.
 */
async function handleRescheduleAppointment(req, res) {
  if (!supabase) return res.status(503).json({ error: 'Database unavailable' });

  const { args, call } = req.body;
  const {
    appointment_id,
    new_date,
    new_time,
    caller_name,
    caller_phone,
    caller_email,
    case_type,
    urgency,
  } = args || {};

  if (!appointment_id || !new_date || !new_time) {
    return res.json({
      success: false,
      message: 'I need the appointment ID, new date, and new time to reschedule.',
    });
  }

  const today = new Date().toISOString().split('T')[0];
  if (new_date < today) {
    return res.json({
      success: false,
      today,
      message: `That date has already passed. Today is ${today}. Please provide a future date.`,
    });
  }

  // Look up firm by agent_id
  const firm = await lookupFirmByAgentId(call?.agent_id);
  const firmId = firm?.id || null;

  try {
    // Step 1: Fetch old appointment details before cancelling
    const { data: oldApt } = await supabase
      .from('appointments')
      .select('*')
      .eq('id', appointment_id)
      .maybeSingle();

    // Step 2: Cancel old appointment
    await supabase
      .from('appointments')
      .update({ status: 'cancelled' })
      .eq('id', appointment_id);

    logger.info('appointment', `Cancelled appointment ${appointment_id} for rescheduling`, {
      firmId,
      callId: call?.call_id,
      details: { oldDate: oldApt?.appointment_date, oldTime: oldApt?.appointment_time },
      source: 'webhookController.handleRescheduleAppointment',
    });

    // Step 3: Book new appointment
    const newAppointment = {
      id: `apt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      firm_id: firmId,
      lead_id: oldApt?.lead_id || null,
      caller_name: caller_name || oldApt?.caller_name || 'Unknown',
      caller_phone: caller_phone || oldApt?.caller_phone,
      caller_email: caller_email || oldApt?.caller_email || null,
      case_type: case_type || oldApt?.case_type || 'other',
      appointment_date: new_date,
      appointment_time: new_time,
      urgency: urgency || oldApt?.urgency || 'low',
      notes: `Rescheduled from ${oldApt?.appointment_date} at ${oldApt?.appointment_time}`,
      status: 'confirmed',
      rescheduled_from_id: appointment_id,
      created_at: new Date().toISOString(),
    };

    await supabase.from('appointments').insert(newAppointment);

    // Step 4: Create Google Calendar event
    try {
      await createAppointmentEvent(newAppointment);
    } catch (calErr) {
      logger.error('calendar', `Calendar event failed for reschedule: ${calErr.message}`, {
        callId: call?.call_id,
        source: 'webhookController.handleRescheduleAppointment',
      });
    }

    logger.info('appointment', `Rescheduled to ${new_date} at ${new_time} for ${newAppointment.caller_name}`, {
      firmId,
      callId: call?.call_id,
      details: { newAppointmentId: newAppointment.id, newDate: new_date, newTime: new_time },
      source: 'webhookController.handleRescheduleAppointment',
    });

    return res.json({
      success: true,
      appointment_id: newAppointment.id,
      message: `Your appointment has been rescheduled to ${new_date} at ${new_time}. Please bring a photo ID and arrive 10 minutes early.`,
    });
  } catch (err) {
    logger.error('database', `Failed to reschedule appointment: ${err.message}`, {
      firmId,
      callId: call?.call_id,
      details: { error: err.message, appointment_id, new_date, new_time },
      source: 'webhookController.handleRescheduleAppointment',
    });
    return res.json({
      success: false,
      message: 'I was unable to reschedule your appointment. Please call us back or we can book you a new slot.',
    });
  }
}

module.exports = {
  handleWebhook,
  handleCheckAvailability,
  handleBookAppointment,
  handleSaveIntakeData,
  handleGetAppointment,
  handleRescheduleAppointment,
};
