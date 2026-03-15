const logger = require('./logger');

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;

let twilioClient = null;

if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN) {
  const twilio = require('twilio');
  twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  logger.info('system', 'Twilio client initialized', { source: 'services.twilio' });
} else {
  logger.warn('system', 'Twilio not configured — SMS will be mocked in development', {
    source: 'services.twilio',
  });
}

/**
 * Send an SMS via Twilio.
 *
 * @param {string} to - Recipient phone number (E.164 format)
 * @param {string} body - Message text
 * @param {string} [from] - Sender phone number (defaults to TWILIO_PHONE_NUMBER env var)
 * @returns {Promise<string>} Twilio message SID (or mock SID if Twilio not configured)
 */
async function sendSMS(to, body, from) {
  const sender = from || TWILIO_PHONE_NUMBER;

  if (!twilioClient) {
    const mockSid = `MOCK_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    logger.info('sms', `[DEV] Mock SMS to ${to}: "${body.slice(0, 80)}"`, {
      details: { to, from: sender, body, mockSid },
      source: 'twilio.sendSMS',
    });
    return mockSid;
  }

  try {
    const message = await twilioClient.messages.create({
      to,
      from: sender,
      body,
    });

    logger.info('sms', `SMS sent to ${to} (SID: ${message.sid})`, {
      details: { to, from: sender, sid: message.sid, status: message.status },
      source: 'twilio.sendSMS',
    });

    return message.sid;
  } catch (err) {
    logger.error('sms', `Failed to send SMS to ${to}: ${err.message}`, {
      details: { to, from: sender, error: err.message, code: err.code, status: err.status },
      source: 'twilio.sendSMS',
    });
    throw err;
  }
}

/**
 * Verify an inbound Twilio webhook signature.
 *
 * @param {object} req - Express request object
 * @returns {boolean} True if the signature is valid
 */
function verifySignature(req) {
  if (!TWILIO_AUTH_TOKEN) {
    logger.warn('sms', 'Twilio auth token not set — skipping signature verification', {
      source: 'twilio.verifySignature',
    });
    return true; // Allow in development
  }

  try {
    const twilio = require('twilio');
    const signature = req.headers['x-twilio-signature'];

    if (!signature) {
      logger.warn('sms', 'Missing x-twilio-signature header', {
        source: 'twilio.verifySignature',
        ip: req.ip,
      });
      return false;
    }

    // Build the full URL that Twilio used to generate the signature
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.headers['host'];
    const url = `${protocol}://${host}${req.originalUrl}`;

    const isValid = twilio.validateRequest(
      TWILIO_AUTH_TOKEN,
      signature,
      url,
      req.body || {}
    );

    if (!isValid) {
      logger.warn('sms', 'Invalid Twilio webhook signature', {
        source: 'twilio.verifySignature',
        ip: req.ip,
      });
    }

    return isValid;
  } catch (err) {
    logger.error('sms', `Signature verification error: ${err.message}`, {
      details: { error: err.message, stack: err.stack },
      source: 'twilio.verifySignature',
    });
    return false;
  }
}

module.exports = { sendSMS, verifySignature };
