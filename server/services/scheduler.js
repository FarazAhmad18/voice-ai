const cron = require('node-cron');
const supabase = require('./supabase');
const logger = require('./logger');
const { sendSMS } = require('./twilio');

// ============================================================
// Helper: save an automated message to the messages table
// ============================================================
async function saveSystemMessage(firmId, leadId, body, externalId) {
  if (!supabase) return;

  const record = {
    firm_id: firmId,
    lead_id: leadId,
    direction: 'outbound',
    channel: 'sms',
    sender: 'System',
    sender_id: null,
    body,
    subject: null,
    status: externalId ? 'sent' : 'failed',
    external_id: externalId || null,
  };

  const { error } = await supabase.from('messages').insert(record);
  if (error) {
    logger.error('sms', `Failed to save system message: ${error.message}`, {
      firmId,
      leadId,
      details: { error: error.message },
      source: 'scheduler.saveSystemMessage',
    });
  }
}

// ============================================================
// Helper: parse "2:30 PM" style time string into { hours, minutes } in 24h
// ============================================================
function parseTimeString(timeStr) {
  if (!timeStr) return null;

  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return null;

  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const period = match[3].toUpperCase();

  if (period === 'PM' && hours !== 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;

  return { hours, minutes };
}

// ============================================================
// Trigger: Booking confirmation (called externally after booking)
// ============================================================
async function sendBookingConfirmation(appointment, lead, firm) {
  if (!lead?.caller_phone) {
    logger.warn('scheduler', 'Cannot send booking confirmation — no phone number', {
      firmId: firm?.id,
      leadId: lead?.id,
      source: 'scheduler.sendBookingConfirmation',
    });
    return;
  }

  const msg = `Hi ${lead.caller_name || 'there'}, your appointment with ${firm.name} is confirmed for ${appointment.appointment_date} at ${appointment.appointment_time}. Reply STOP to opt out.`;

  try {
    const fromNumber = firm.retell_phone_number || null;
    const sid = await sendSMS(lead.caller_phone, msg, fromNumber);

    await saveSystemMessage(firm.id, lead.id, msg, sid);

    logger.info('scheduler', `Booking confirmation sent to ${lead.caller_phone}`, {
      firmId: firm.id,
      leadId: lead.id,
      details: { appointmentId: appointment.id, sid },
      source: 'scheduler.sendBookingConfirmation',
    });
  } catch (err) {
    logger.error('scheduler', `Failed to send booking confirmation: ${err.message}`, {
      firmId: firm.id,
      leadId: lead.id,
      details: { error: err.message },
      source: 'scheduler.sendBookingConfirmation',
    });
  }
}

// ============================================================
// Trigger: Missed call follow-up (called externally from webhook)
// ============================================================
async function sendMissedCallFollowUp(lead, firm) {
  if (!lead?.caller_phone) {
    logger.warn('scheduler', 'Cannot send missed call follow-up — no phone number', {
      firmId: firm?.id,
      leadId: lead?.id,
      source: 'scheduler.sendMissedCallFollowUp',
    });
    return;
  }

  const msg = `Hi, we noticed you tried to reach ${firm.name}. We'll get back to you shortly. If urgent, please call again.`;

  try {
    const fromNumber = firm.retell_phone_number || null;
    const sid = await sendSMS(lead.caller_phone, msg, fromNumber);

    await saveSystemMessage(firm.id, lead.id, msg, sid);

    logger.info('scheduler', `Missed call follow-up sent to ${lead.caller_phone}`, {
      firmId: firm.id,
      leadId: lead.id,
      details: { sid },
      source: 'scheduler.sendMissedCallFollowUp',
    });
  } catch (err) {
    logger.error('scheduler', `Failed to send missed call follow-up: ${err.message}`, {
      firmId: firm.id,
      leadId: lead.id,
      details: { error: err.message },
      source: 'scheduler.sendMissedCallFollowUp',
    });
  }
}

// ============================================================
// Cron: 24-hour reminder — runs daily at 9:00 AM
// ============================================================
cron.schedule('0 9 * * *', async () => {
  logger.info('scheduler', '24h reminder cron started', { source: 'scheduler.24hReminder' });

  if (!supabase) {
    logger.warn('scheduler', 'Supabase not available — skipping 24h reminders', {
      source: 'scheduler.24hReminder',
    });
    return;
  }

  try {
    // Calculate tomorrow's date in YYYY-MM-DD format
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().slice(0, 10);

    // Fetch confirmed appointments for tomorrow
    const { data: appointments, error } = await supabase
      .from('appointments')
      .select('id, lead_id, firm_id, caller_name, caller_phone, appointment_date, appointment_time')
      .eq('appointment_date', tomorrowStr)
      .eq('status', 'confirmed');

    if (error) {
      logger.error('scheduler', `Failed to query appointments for 24h reminders: ${error.message}`, {
        details: { error: error.message },
        source: 'scheduler.24hReminder',
      });
      return;
    }

    if (!appointments || appointments.length === 0) {
      logger.info('scheduler', `No appointments tomorrow (${tomorrowStr}) to remind`, {
        source: 'scheduler.24hReminder',
      });
      return;
    }

    // Get firm details for each unique firm
    const firmIds = [...new Set(appointments.map((a) => a.firm_id))];
    const { data: firms } = await supabase
      .from('firms')
      .select('id, name, retell_phone_number')
      .in('id', firmIds);

    const firmMap = {};
    (firms || []).forEach((f) => { firmMap[f.id] = f; });

    let sentCount = 0;

    for (const apt of appointments) {
      const phone = apt.caller_phone;
      if (!phone) continue;

      const firm = firmMap[apt.firm_id];
      if (!firm) continue;

      // BUG #6: Check if a 24h reminder was already sent for this appointment today
      if (apt.lead_id) {
        const { data: existingReminder } = await supabase
          .from('messages')
          .select('id')
          .eq('lead_id', apt.lead_id)
          .eq('channel', 'sms')
          .eq('sender', 'System')
          .ilike('body', '%reminder%')
          .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
          .maybeSingle();

        if (existingReminder) continue; // Already sent
      }

      const msg = `Reminder: You have an appointment with ${firm.name} tomorrow at ${apt.appointment_time}.`;

      try {
        const sid = await sendSMS(phone, msg, firm.retell_phone_number || null);

        if (apt.lead_id) {
          await saveSystemMessage(firm.id, apt.lead_id, msg, sid);
        }

        sentCount++;
      } catch (err) {
        logger.error('scheduler', `Failed to send 24h reminder to ${phone}: ${err.message}`, {
          firmId: firm.id,
          details: { error: err.message, appointmentId: apt.id },
          source: 'scheduler.24hReminder',
        });
      }
    }

    logger.info('scheduler', `24h reminders sent: ${sentCount}/${appointments.length}`, {
      details: { date: tomorrowStr, total: appointments.length, sent: sentCount },
      source: 'scheduler.24hReminder',
    });
  } catch (err) {
    logger.error('scheduler', `24h reminder cron failed: ${err.message}`, {
      details: { error: err.message, stack: err.stack },
      source: 'scheduler.24hReminder',
    });
  }
});

// ============================================================
// Cron: 1-hour reminder — runs every hour at :00
// ============================================================
cron.schedule('0 * * * *', async () => {
  logger.info('scheduler', '1h reminder cron started', { source: 'scheduler.1hReminder' });

  if (!supabase) {
    logger.warn('scheduler', 'Supabase not available — skipping 1h reminders', {
      source: 'scheduler.1hReminder',
    });
    return;
  }

  try {
    // Get today's date in YYYY-MM-DD
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const currentHour = now.getHours();
    const currentMinutes = now.getMinutes();

    // Fetch confirmed appointments for today
    const { data: appointments, error } = await supabase
      .from('appointments')
      .select('id, lead_id, firm_id, caller_name, caller_phone, appointment_date, appointment_time')
      .eq('appointment_date', todayStr)
      .eq('status', 'confirmed');

    if (error) {
      logger.error('scheduler', `Failed to query appointments for 1h reminders: ${error.message}`, {
        details: { error: error.message },
        source: 'scheduler.1hReminder',
      });
      return;
    }

    if (!appointments || appointments.length === 0) {
      logger.debug('scheduler', `No confirmed appointments today (${todayStr})`, {
        source: 'scheduler.1hReminder',
      });
      return;
    }

    // Get firm details
    const firmIds = [...new Set(appointments.map((a) => a.firm_id))];
    const { data: firms } = await supabase
      .from('firms')
      .select('id, name, retell_phone_number')
      .in('id', firmIds);

    const firmMap = {};
    (firms || []).forEach((f) => { firmMap[f.id] = f; });

    let sentCount = 0;

    for (const apt of appointments) {
      const phone = apt.caller_phone;
      if (!phone) continue;

      // Parse the appointment time and check if it's 1-2 hours from now
      const parsed = parseTimeString(apt.appointment_time);
      if (!parsed) continue;

      const aptMinutesFromMidnight = parsed.hours * 60 + parsed.minutes;
      const nowMinutesFromMidnight = currentHour * 60 + currentMinutes;
      const diff = aptMinutesFromMidnight - nowMinutesFromMidnight;

      // Send if appointment is 60-120 minutes away
      if (diff < 60 || diff > 120) continue;

      const firm = firmMap[apt.firm_id];
      if (!firm) continue;

      // BUG #6: Check if a 1h reminder was already sent for this appointment
      if (apt.lead_id) {
        const { data: existingReminder } = await supabase
          .from('messages')
          .select('id')
          .eq('lead_id', apt.lead_id)
          .eq('channel', 'sms')
          .eq('sender', 'System')
          .ilike('body', '%in about 1 hour%')
          .gte('created_at', new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString())
          .maybeSingle();

        if (existingReminder) continue; // Already sent
      }

      const msg = `Your appointment with ${firm.name} is in about 1 hour at ${apt.appointment_time}. See you soon!`;

      try {
        const sid = await sendSMS(phone, msg, firm.retell_phone_number || null);

        if (apt.lead_id) {
          await saveSystemMessage(firm.id, apt.lead_id, msg, sid);
        }

        sentCount++;
      } catch (err) {
        logger.error('scheduler', `Failed to send 1h reminder to ${phone}: ${err.message}`, {
          firmId: firm.id,
          details: { error: err.message, appointmentId: apt.id },
          source: 'scheduler.1hReminder',
        });
      }
    }

    logger.info('scheduler', `1h reminders sent: ${sentCount}`, {
      details: { date: todayStr, sent: sentCount },
      source: 'scheduler.1hReminder',
    });
  } catch (err) {
    logger.error('scheduler', `1h reminder cron failed: ${err.message}`, {
      details: { error: err.message, stack: err.stack },
      source: 'scheduler.1hReminder',
    });
  }
});

logger.info('system', 'Scheduler initialized — cron jobs active (24h @9AM, 1h @every hour)', {
  source: 'services.scheduler',
});

module.exports = {
  sendBookingConfirmation,
  sendMissedCallFollowUp,
};
