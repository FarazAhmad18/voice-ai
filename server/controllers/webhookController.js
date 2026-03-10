const supabase = require('../services/supabase');
const { calculateLeadScore, getScoreLabel } = require('../services/leadScoring');
const { getAvailableSlots, createAppointmentEvent } = require('../services/googleCalendar');

// Default firm ID for MVP (Mitchell Family Law)
const DEFAULT_FIRM_ID = 'a0000000-0000-0000-0000-000000000001';

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
async function handleToolCalls(message, res) {
  const toolCallList = message.toolCallList || [];
  const results = [];

  for (const toolCall of toolCallList) {
    console.log(`[Tool Call] ${toolCall.function.name}`, toolCall.function.arguments);

    let result;
    switch (toolCall.function.name) {
      case 'check_availability':
        result = await handleCheckAvailability(toolCall.function.arguments);
        break;
      case 'book_appointment':
        result = await handleBookAppointment(toolCall.function.arguments);
        break;
      default:
        result = { error: 'Unknown tool' };
    }

    results.push({
      toolCallId: toolCall.id,
      result: result.message || JSON.stringify(result),
    });
  }

  return res.status(200).json({ results });
}

/**
 * Check available appointment slots (uses Google Calendar)
 */
async function handleCheckAvailability(args) {
  const { date } = args;

  const slots = await getAvailableSlots(date);

  console.log(`[Availability] Checking ${date} - returning ${slots.length} slots`);

  if (slots.length === 0) {
    return {
      available: false,
      date: date,
      slots: [],
      message: `Unfortunately, we don't have any available times on ${date}. Would you like to try another day?`,
    };
  }

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
async function handleBookAppointment(args) {
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
    firm_id: DEFAULT_FIRM_ID,
    caller_name,
    caller_phone,
    caller_email: caller_email || null,
    case_type,
    appointment_date,
    appointment_time,
    urgency,
    notes,
    status: 'confirmed',
  };

  // Save to Supabase if available
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

  console.log(`[Booked] ${caller_name} - ${appointment_date} ${appointment_time} - ${case_type}`);

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
    notes: recentAppointment?.notes || summary || '',
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
  };

  const callRecord = {
    id: `call_${Date.now()}`,
    lead_id: lead.id,
    firm_id: DEFAULT_FIRM_ID,
    vapi_call_id: call?.id || null,
    transcript: transcript || '',
    summary: summary || '',
    recording_url: recordingUrl || null,
    duration: call?.duration || 0,
    ended_reason: endedReason || 'unknown',
  };

  // Update the appointment with the lead_id
  if (recentAppointment && supabase) {
    await supabase
      .from('appointments')
      .update({ lead_id: lead.id })
      .eq('id', recentAppointment.id);
  }

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
