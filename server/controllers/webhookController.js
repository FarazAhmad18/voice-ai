const supabase = require('../services/supabase');
const { calculateLeadScore, getScoreLabel } = require('../services/leadScoring');
const { getAvailableSlots, createAppointmentEvent } = require('../services/googleCalendar');
const { verifyWebhookSignature } = require('../services/retell');

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
    console.log('[Retell Webhook] Invalid payload — missing event or call');
    return res.status(400).json({ error: 'Invalid payload' });
  }

  console.log(`[Retell Event] ${event} | call_id: ${call.call_id} | agent_id: ${call.agent_id}`);

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
      console.log(`[Retell] Unhandled event: ${event}`);
      return res.status(200).json({ received: true });
  }
}

/**
 * call_started — log that a call has begun.
 */
function handleCallStarted(call, res) {
  console.log(`[Call Started] ${call.call_id} | from: ${call.from_number} | to: ${call.to_number} | direction: ${call.direction}`);
  return res.status(200).json({ received: true });
}

/**
 * call_ended — main processing.
 * Creates lead + call record from the completed call data.
 */
async function handleCallEnded(call) {
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
    summary: '', // will be filled by call_analyzed event
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
      console.log(`[Saved to Supabase] Lead: ${lead.id} | Score: ${score} (${scoreLabel})`);
    } catch (err) {
      console.error('[Supabase Error]', err.message);
      localStore.leads.push(lead);
      localStore.calls.push(callRecord);
    }
  } else {
    localStore.leads.push(lead);
    localStore.calls.push(callRecord);
    console.log(`[Saved Locally] Lead: ${lead.id} | Score: ${score} (${scoreLabel})`);
  }

  console.log(`[Call Ended] ${lead.caller_name} | ${lead.case_type} | Score: ${score} (${scoreLabel}) | Booked: ${lead.appointment_booked} | Duration: ${durationSec}s | Reason: ${callRecord.ended_reason}`);
}

/**
 * call_analyzed — enrichment after post-call analysis.
 * Updates the call and lead with summary and sentiment.
 */
async function handleCallAnalyzed(call) {
  const analysis = call.call_analysis;
  if (!analysis) {
    console.log('[Call Analyzed] No analysis data');
    return;
  }

  const summary = analysis.call_summary || '';
  const sentiment = analysis.user_sentiment || null;
  const retellCallId = call.call_id;

  console.log(`[Call Analyzed] ${retellCallId} | Sentiment: ${sentiment} | Summary: ${summary.slice(0, 100)}...`);

  if (supabase) {
    try {
      // Update call record with summary and sentiment
      const { data: callData } = await supabase
        .from('calls')
        .update({ summary, sentiment })
        .eq('retell_call_id', retellCallId)
        .select('lead_id')
        .single();

      // Update lead with summary and sentiment
      if (callData?.lead_id) {
        await supabase
          .from('leads')
          .update({ notes: summary, sentiment })
          .eq('id', callData.lead_id);
      }

      console.log(`[Enriched] Call ${retellCallId} updated with analysis`);
    } catch (err) {
      console.error('[Call Analyzed Error]', err.message);
    }
  } else {
    // Local store fallback
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
  }
}

// ============================================================
// TOOL CALL HANDLERS (called by Retell mid-call)
// ============================================================

/**
 * Handle check_availability tool call.
 * Retell sends: { call: {...}, name: "check_availability", args: { date: "2026-03-17" } }
 * We return JSON that gets fed back to the LLM.
 */
async function handleCheckAvailability(req, res) {
  const { args, call } = req.body;
  const date = args?.date;

  console.log(`[Tool: check_availability] date: ${date} | call: ${call?.call_id}`);

  const slots = await getAvailableSlots(date);

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

  console.log(`[Tool: book_appointment] ${caller_name} | ${appointment_date} ${appointment_time} | call: ${call?.call_id}`);

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

  // Save to Supabase
  if (supabase) {
    try {
      await supabase.from('appointments').insert(appointment);
      console.log(`[Booked → Supabase] ${caller_name} - ${appointment_date} ${appointment_time}`);
    } catch (err) {
      console.error('[Supabase Error]', err.message);
      localStore.appointments.push(appointment);
    }
  } else {
    localStore.appointments.push(appointment);
  }

  // Create Google Calendar event
  await createAppointmentEvent(appointment);

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

  console.log(`[Tool: save_intake_data] call: ${call?.call_id}`, args);

  // args is a dynamic object like:
  // { "divorce_papers_filed": "no", "children_involved": "yes, 2 children", ... }

  if (supabase && args) {
    try {
      const answers = Object.entries(args).map(([question, answer]) => ({
        call_id: null, // will be linked when call record is created
        lead_id: null, // will be linked when lead is created
        firm_id: DEFAULT_FIRM_ID,
        question: question.replace(/_/g, ' '),
        answer: String(answer),
        created_at: new Date().toISOString(),
      }));

      // Store with caller phone as temporary key — will link to lead after call_ended
      // For now, store in a temp location keyed by call_id
      if (!global._pendingIntakeAnswers) global._pendingIntakeAnswers = {};
      global._pendingIntakeAnswers[call?.call_id] = answers;

      console.log(`[Intake Data] Stored ${answers.length} answers for call ${call?.call_id}`);
    } catch (err) {
      console.error('[Intake Data Error]', err.message);
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
