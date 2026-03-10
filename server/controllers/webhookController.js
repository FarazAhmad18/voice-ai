const supabase = require('../services/supabase');
const { calculateLeadScore, getScoreLabel } = require('../services/leadScoring');

// In-memory storage for when Supabase isn't configured yet
const localStore = {
  leads: [],
  calls: [],
  appointments: [],
};

/**
 * Main webhook handler - receives ALL events from VAPI
 */
async function handleWebhook(req, res) {
  const { message } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'No message in request body' });
  }

  console.log(`[VAPI Event] ${message.type}`);

  switch (message.type) {
    case 'tool-calls':
      return handleToolCalls(message, res);

    case 'end-of-call-report':
      await handleEndOfCallReport(message);
      return res.status(200).json({ received: true });

    case 'status-update':
      console.log(`[Call Status] ${message.status}`);
      return res.status(200).json({ received: true });

    case 'transcript':
      return res.status(200).json({ received: true });

    case 'conversation-update':
      return res.status(200).json({ received: true });

    default:
      console.log(`[Unhandled Event] ${message.type}`);
      return res.status(200).json({ received: true });
  }
}

/**
 * Handle tool calls from VAPI (mid-call)
 * VAPI expects a response within 7.5 seconds
 */
function handleToolCalls(message, res) {
  const toolCallList = message.toolCallList || [];
  const results = [];

  for (const toolCall of toolCallList) {
    console.log(`[Tool Call] ${toolCall.function.name}`, toolCall.function.arguments);

    let result;
    switch (toolCall.function.name) {
      case 'check_availability':
        result = handleCheckAvailability(toolCall.function.arguments);
        break;
      case 'book_appointment':
        result = handleBookAppointment(toolCall.function.arguments);
        break;
      default:
        result = { error: 'Unknown tool' };
    }

    results.push({
      toolCallId: toolCall.id,
      result: JSON.stringify(result),
    });
  }

  return res.status(200).json({ results });
}

/**
 * Check available appointment slots
 */
function handleCheckAvailability(args) {
  const { date } = args;

  // For MVP: return mock available slots
  // Later: integrate with Google Calendar API
  const slots = [
    '9:00 AM',
    '10:30 AM',
    '1:00 PM',
    '2:30 PM',
    '4:00 PM',
  ];

  console.log(`[Availability] Checking ${date} - returning ${slots.length} slots`);

  return {
    available: true,
    date: date,
    slots: slots,
    message: `We have the following times available on ${date}: ${slots.join(', ')}`,
  };
}

/**
 * Book an appointment
 */
function handleBookAppointment(args) {
  const {
    caller_name,
    caller_phone,
    caller_email,
    case_type,
    appointment_date,
    appointment_time,
    urgency,
    notes,
  } = args;

  const appointment = {
    id: `apt_${Date.now()}`,
    caller_name,
    caller_phone,
    caller_email: caller_email || null,
    case_type,
    appointment_date,
    appointment_time,
    urgency,
    notes,
    status: 'confirmed',
    created_at: new Date().toISOString(),
  };

  // Store locally for now
  localStore.appointments.push(appointment);
  console.log(`[Booked] ${caller_name} - ${appointment_date} ${appointment_time} - ${case_type}`);

  // Later: save to Supabase + create Google Calendar event

  return {
    success: true,
    appointment_id: appointment.id,
    message: `Your consultation has been booked for ${appointment_date} at ${appointment_time}. Please arrive 10 minutes early and bring a photo ID and any relevant court documents.`,
  };
}

/**
 * Handle end-of-call report (after call ends)
 * This is where we save the lead, transcript, and call data
 */
async function handleEndOfCallReport(message) {
  const { call, transcript, summary, recordingUrl, endedReason } = message;

  // Extract caller phone from call object
  const callerPhone = call?.customer?.number || 'unknown';

  // Find if this caller booked an appointment during the call
  const recentAppointment = localStore.appointments.find(
    (apt) => apt.caller_phone === callerPhone || apt.created_at > new Date(Date.now() - 15 * 60 * 1000).toISOString()
  );

  // Build lead data
  const leadData = {
    caller_name: recentAppointment?.caller_name || 'Unknown Caller',
    caller_phone: callerPhone,
    caller_email: recentAppointment?.caller_email || null,
    case_type: recentAppointment?.case_type || 'other',
    urgency: recentAppointment?.urgency || 'low',
    appointment_booked: !!recentAppointment,
    notes: recentAppointment?.notes || summary || '',
  };

  // Calculate lead score
  const score = calculateLeadScore(leadData);
  const scoreLabel = getScoreLabel(score);

  const lead = {
    id: `lead_${Date.now()}`,
    ...leadData,
    score,
    score_label: scoreLabel,
    status: recentAppointment ? 'booked' : 'new',
    created_at: new Date().toISOString(),
  };

  const callRecord = {
    id: `call_${Date.now()}`,
    lead_id: lead.id,
    vapi_call_id: call?.id || null,
    transcript: transcript || '',
    summary: summary || '',
    recording_url: recordingUrl || null,
    duration: call?.duration || 0,
    ended_reason: endedReason || 'unknown',
    created_at: new Date().toISOString(),
  };

  // Save to Supabase if configured, otherwise local store
  if (supabase) {
    try {
      await supabase.from('leads').insert(lead);
      await supabase.from('calls').insert(callRecord);
      console.log(`[Saved to Supabase] Lead: ${lead.id}, Score: ${score} (${scoreLabel})`);
    } catch (err) {
      console.error('[Supabase Error]', err.message);
      localStore.leads.push(lead);
      localStore.calls.push(callRecord);
    }
  } else {
    localStore.leads.push(lead);
    localStore.calls.push(callRecord);
    console.log(`[Saved Locally] Lead: ${lead.id}, Score: ${score} (${scoreLabel})`);
  }

  console.log(`[End of Call] ${lead.caller_name} | ${lead.case_type} | Score: ${score} (${scoreLabel}) | Booked: ${lead.status === 'booked'}`);
}

// Export local store for API routes to access
function getLocalStore() {
  return localStore;
}

module.exports = { handleWebhook, getLocalStore };
