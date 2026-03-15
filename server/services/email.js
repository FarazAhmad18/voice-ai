const logger = require('./logger');

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@leapingai.com';

let resendClient = null;

if (RESEND_API_KEY) {
  const { Resend } = require('resend');
  resendClient = new Resend(RESEND_API_KEY);
  logger.info('system', 'Resend email client initialized', { source: 'services.email' });
} else {
  logger.warn('system', 'Resend not configured — emails will be mocked in development', {
    source: 'services.email',
  });
}

/**
 * Send an email via the Resend API.
 *
 * @param {string} to - Recipient email address
 * @param {string} subject - Email subject line
 * @param {string} body - Email body (plain text or HTML)
 * @returns {Promise<string>} Resend message ID (or mock ID if not configured)
 */
async function sendEmail(to, subject, body) {
  if (!resendClient) {
    const mockId = `MOCK_EMAIL_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    logger.info('email', `[DEV] Mock email to ${to}: "${subject}"`, {
      details: { to, subject, body: body.slice(0, 200), mockId },
      source: 'email.sendEmail',
    });
    return mockId;
  }

  try {
    const { data, error } = await resendClient.emails.send({
      from: FROM_EMAIL,
      to,
      subject,
      html: body,
    });

    if (error) {
      logger.error('email', `Resend API error sending to ${to}: ${error.message}`, {
        details: { to, subject, error: error.message, name: error.name },
        source: 'email.sendEmail',
      });
      throw new Error(error.message);
    }

    const resendId = data?.id || null;

    logger.info('email', `Email sent to ${to} (ID: ${resendId})`, {
      details: { to, subject, resendId },
      source: 'email.sendEmail',
    });

    return resendId;
  } catch (err) {
    logger.error('email', `Failed to send email to ${to}: ${err.message}`, {
      details: { to, subject, error: err.message },
      source: 'email.sendEmail',
    });
    throw err;
  }
}

module.exports = { sendEmail };
