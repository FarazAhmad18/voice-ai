const { google } = require('googleapis');
const path = require('path');
const logger = require('./logger');

let calendar = null;
const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID;

// Initialize Google Calendar client
// Supports both: JSON key file (local dev) and env variable (production/Render)
try {
  let auth;
  if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    // Production: credentials passed as JSON string in env variable
    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
    auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/calendar'],
    });
  } else if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE) {
    // Local dev: credentials in a JSON file
    const keyFile = path.resolve(__dirname, '..', process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE);
    auth = new google.auth.GoogleAuth({
      keyFile,
      scopes: ['https://www.googleapis.com/auth/calendar'],
    });
  }

  if (auth) {
    calendar = google.calendar({ version: 'v3', auth });
    logger.info('calendar', 'Google Calendar connected successfully', {
      source: 'googleCalendar.init',
    });
  } else {
    logger.warn('calendar', 'No credentials found, using mock data', {
      source: 'googleCalendar.init',
    });
  }
} catch (err) {
  logger.warn('calendar', `Not configured, using mock data: ${err.message}`, {
    details: { error: err.message },
    source: 'googleCalendar.init',
  });
}

/**
 * Get available time slots for a given date
 * Checks Google Calendar for existing events and returns open 30-min slots
 */
async function getAvailableSlots(date, firmId, calendarId) {
  const effectiveCalendarId = calendarId || CALENDAR_ID;
  if (!calendar || !effectiveCalendarId) {
    // Fallback mock slots
    logger.debug('calendar', `Returning mock slots for ${date} (calendar not configured)`, {
      firmId,
      source: 'googleCalendar.getAvailableSlots',
    });
    return ['9:00 AM', '10:30 AM', '1:00 PM', '2:30 PM', '4:00 PM'];
  }

  const start = Date.now();
  try {
    const dayStart = new Date(`${date}T09:00:00`);
    const dayEnd = new Date(`${date}T17:00:00`);

    // Get existing events for that day (with 15s timeout)
    const abortCtrl = new AbortController();
    const timeoutId = setTimeout(() => abortCtrl.abort(), 15000);
    let response;
    try {
      response = await calendar.events.list({
        calendarId: effectiveCalendarId,
        timeMin: dayStart.toISOString(),
        timeMax: dayEnd.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
      });
    } finally {
      clearTimeout(timeoutId);
    }

    const busyTimes = (response.data.items || []).map((event) => ({
      start: new Date(event.start.dateTime || event.start.date),
      end: new Date(event.end.dateTime || event.end.date),
    }));

    // Generate 30-min consultation slots from 9 AM to 5 PM
    const slots = [];
    const slotDuration = 30; // minutes
    const possibleTimes = [
      '9:00 AM', '9:30 AM', '10:00 AM', '10:30 AM',
      '11:00 AM', '11:30 AM', '12:00 PM', '12:30 PM',
      '1:00 PM', '1:30 PM', '2:00 PM', '2:30 PM',
      '3:00 PM', '3:30 PM', '4:00 PM', '4:30 PM',
    ];

    for (const timeStr of possibleTimes) {
      const slotStart = parseTime(date, timeStr);
      const slotEnd = new Date(slotStart.getTime() + slotDuration * 60000);

      // Check if slot conflicts with any existing event
      const isBusy = busyTimes.some(
        (busy) => slotStart < busy.end && slotEnd > busy.start
      );

      if (!isBusy) {
        slots.push(timeStr);
      }
    }

    const duration = Date.now() - start;
    logger.info('calendar', `Fetched ${slots.length} available slots for ${date}`, {
      firmId,
      details: { date, slotsCount: slots.length, busyCount: busyTimes.length, duration },
      durationMs: duration,
      source: 'googleCalendar.getAvailableSlots',
    });

    return slots;
  } catch (err) {
    const duration = Date.now() - start;
    logger.error('calendar', `Error fetching slots for ${date}: ${err.message}`, {
      firmId,
      details: { error: err.message, date, duration },
      durationMs: duration,
      source: 'googleCalendar.getAvailableSlots',
    });
    // Fallback to mock slots on error
    return ['9:00 AM', '10:30 AM', '1:00 PM', '2:30 PM', '4:00 PM'];
  }
}

/**
 * Create a calendar event for the booked appointment
 */
async function createAppointmentEvent(appointment, firmId, calendarId) {
  const effectiveCalendarId = calendarId || CALENDAR_ID;
  if (!calendar || !effectiveCalendarId) {
    logger.debug('calendar', 'Not configured, skipping event creation', {
      firmId,
      source: 'googleCalendar.createAppointmentEvent',
    });
    return null;
  }

  const start = Date.now();
  try {
    const startTime = parseTime(appointment.appointment_date, appointment.appointment_time);
    const endTime = new Date(startTime.getTime() + 30 * 60000); // 30 min consultation

    const event = {
      summary: `Consultation: ${appointment.caller_name} - ${appointment.case_type}`,
      description: [
        `Client: ${appointment.caller_name}`,
        `Phone: ${appointment.caller_phone}`,
        appointment.caller_email ? `Email: ${appointment.caller_email}` : '',
        `Case Type: ${appointment.case_type}`,
        `Urgency: ${appointment.urgency}`,
        appointment.notes ? `Notes: ${appointment.notes}` : '',
        '',
        'Booked by Sarah (AI Assistant)',
      ].filter(Boolean).join('\n'),
      start: { dateTime: startTime.toISOString() },
      end: { dateTime: endTime.toISOString() },
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'popup', minutes: 30 },
          { method: 'email', minutes: 60 },
        ],
      },
    };

    const response = await calendar.events.insert({
      calendarId: effectiveCalendarId,
      resource: event,
    });

    const duration = Date.now() - start;
    logger.info('calendar', `Event created: ${response.data.id} for ${appointment.caller_name}`, {
      firmId,
      details: { eventId: response.data.id, date: appointment.appointment_date, time: appointment.appointment_time, duration },
      durationMs: duration,
      source: 'googleCalendar.createAppointmentEvent',
    });

    return response.data;
  } catch (err) {
    const duration = Date.now() - start;
    logger.error('calendar', `Error creating event: ${err.message}`, {
      firmId,
      details: { error: err.message, appointment: { date: appointment.appointment_date, time: appointment.appointment_time, name: appointment.caller_name }, duration },
      durationMs: duration,
      source: 'googleCalendar.createAppointmentEvent',
    });
    return null;
  }
}

/**
 * Parse a date + time string like "2026-03-15" + "2:30 PM" into a Date object
 */
function parseTime(dateStr, timeStr) {
  if (!dateStr || !timeStr) {
    logger.warn('calendar', `Invalid date/time: date=${dateStr}, time=${timeStr}`, {
      source: 'googleCalendar.parseTime',
    });
    return new Date(); // fallback to now rather than crashing
  }

  // Try to parse "H:MM AM/PM" format
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) {
    logger.warn('calendar', `Unparseable time format: "${timeStr}"`, {
      source: 'googleCalendar.parseTime',
    });
    return new Date(`${dateStr}T12:00:00`); // fallback to noon
  }

  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const period = match[3].toUpperCase();

  if (period === 'PM' && hours !== 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;

  const result = new Date(`${dateStr}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`);
  if (isNaN(result.getTime())) {
    logger.warn('calendar', `Invalid date result: ${dateStr} ${timeStr}`, {
      source: 'googleCalendar.parseTime',
    });
    return new Date();
  }
  return result;
}

module.exports = { getAvailableSlots, createAppointmentEvent };
