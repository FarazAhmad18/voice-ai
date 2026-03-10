const { google } = require('googleapis');
const path = require('path');

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
    console.log('[Google Calendar] Connected successfully');
  } else {
    console.warn('[Google Calendar] No credentials found, using mock data');
  }
} catch (err) {
  console.warn('[Google Calendar] Not configured, using mock data:', err.message);
}

/**
 * Get available time slots for a given date
 * Checks Google Calendar for existing events and returns open 30-min slots
 */
async function getAvailableSlots(date) {
  if (!calendar || !CALENDAR_ID) {
    // Fallback mock slots
    return ['9:00 AM', '10:30 AM', '1:00 PM', '2:30 PM', '4:00 PM'];
  }

  try {
    const dayStart = new Date(`${date}T09:00:00`);
    const dayEnd = new Date(`${date}T17:00:00`);

    // Get existing events for that day
    const response = await calendar.events.list({
      calendarId: CALENDAR_ID,
      timeMin: dayStart.toISOString(),
      timeMax: dayEnd.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
    });

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

    return slots;
  } catch (err) {
    console.error('[Google Calendar] Error fetching slots:', err.message);
    // Fallback to mock slots on error
    return ['9:00 AM', '10:30 AM', '1:00 PM', '2:30 PM', '4:00 PM'];
  }
}

/**
 * Create a calendar event for the booked appointment
 */
async function createAppointmentEvent(appointment) {
  if (!calendar || !CALENDAR_ID) {
    console.log('[Google Calendar] Not configured, skipping event creation');
    return null;
  }

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
      calendarId: CALENDAR_ID,
      resource: event,
    });

    console.log(`[Google Calendar] Event created: ${response.data.id}`);
    return response.data;
  } catch (err) {
    console.error('[Google Calendar] Error creating event:', err.message);
    return null;
  }
}

/**
 * Parse a date + time string like "2026-03-15" + "2:30 PM" into a Date object
 */
function parseTime(dateStr, timeStr) {
  const [timePart, period] = timeStr.split(' ');
  let [hours, minutes] = timePart.split(':').map(Number);

  if (period === 'PM' && hours !== 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;

  return new Date(`${dateStr}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`);
}

module.exports = { getAvailableSlots, createAppointmentEvent };
