const logger = require('../services/logger');

const WEBHOOK_TIMEOUT_MS = 5000;

/**
 * Main entry point — push lead data to external CRM if configured.
 * Never throws — all errors are caught and logged so the main flow is not disrupted.
 *
 * @param {object} firm - The firm record (with crm_mode, crm_type, crm_webhook_url, etc.)
 * @param {object} lead - The lead record just created
 * @param {object} call - The call record just created
 * @param {object|null} appointment - The appointment record if one was booked, or null
 */
async function maybePushToCRM(firm, lead, call, appointment) {
  try {
    if (!firm || !lead) return;

    // If builtin-only, no external push needed
    if (firm.crm_mode === 'builtin' || !firm.crm_mode) {
      return;
    }

    // crm_mode is 'external' or 'both' — push to configured CRM
    if (firm.crm_type === 'webhook') {
      await pushViaWebhook(firm, lead, call, appointment);
    } else if (firm.crm_type === 'hubspot') {
      await pushToHubSpot(firm, lead, call, appointment);
    } else if (firm.crm_type === 'salesforce') {
      await pushToSalesforce(firm, lead, call, appointment);
    } else {
      logger.warn('crm_push', `Unknown CRM type: ${firm.crm_type}`, {
        firmId: firm.id,
        leadId: lead.id,
        details: { crmType: firm.crm_type },
        source: 'crmPushController.maybePushToCRM',
      });
    }
  } catch (err) {
    // Catch-all — CRM push failures should never break the main flow
    logger.error('crm_push', `CRM push failed: ${err.message}`, {
      firmId: firm?.id,
      leadId: lead?.id,
      details: { error: err.message, stack: err.stack, crmType: firm?.crm_type },
      source: 'crmPushController.maybePushToCRM',
    });
  }
}

/**
 * Push lead data to a generic webhook URL.
 */
async function pushViaWebhook(firm, lead, call, appointment) {
  const url = firm.crm_webhook_url;
  if (!url) {
    logger.warn('crm_push', 'Webhook URL not configured — skipping push', {
      firmId: firm.id,
      leadId: lead.id,
      source: 'crmPushController.pushViaWebhook',
    });
    return;
  }

  const payload = buildPayload(firm, lead, call, appointment);
  const start = Date.now();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);

  try {
    const headers = {
      'Content-Type': 'application/json',
      'User-Agent': 'VoibixAI/1.0',
    };

    // Include API key as bearer token if configured
    if (firm.crm_api_key) {
      headers['Authorization'] = `Bearer ${firm.crm_api_key}`;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const durationMs = Date.now() - start;

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      logger.error('crm_push', `Webhook returned ${response.status}: ${errorBody.slice(0, 200)}`, {
        firmId: firm.id,
        leadId: lead.id,
        details: {
          url,
          status: response.status,
          responseBody: errorBody.slice(0, 500),
        },
        durationMs,
        source: 'crmPushController.pushViaWebhook',
      });
      return;
    }

    logger.info('crm_push', `Webhook push successful: ${lead.caller_name}`, {
      firmId: firm.id,
      leadId: lead.id,
      details: {
        url,
        status: response.status,
        leadName: lead.caller_name,
        hasAppointment: !!appointment,
      },
      durationMs,
      source: 'crmPushController.pushViaWebhook',
    });
  } catch (err) {
    const durationMs = Date.now() - start;

    if (err.name === 'AbortError') {
      logger.error('crm_push', `Webhook timed out after ${WEBHOOK_TIMEOUT_MS}ms`, {
        firmId: firm.id,
        leadId: lead.id,
        details: { url, timeoutMs: WEBHOOK_TIMEOUT_MS },
        durationMs,
        source: 'crmPushController.pushViaWebhook',
      });
    } else {
      logger.error('crm_push', `Webhook request failed: ${err.message}`, {
        firmId: firm.id,
        leadId: lead.id,
        details: { url, error: err.message },
        durationMs,
        source: 'crmPushController.pushViaWebhook',
      });
    }
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Build the standardized webhook payload.
 */
function buildPayload(firm, lead, call, appointment) {
  return {
    event: 'new_lead',
    timestamp: new Date().toISOString(),
    firm: {
      id: firm.id,
      name: firm.name,
    },
    lead: {
      id: lead.id,
      name: lead.caller_name,
      phone: lead.caller_phone,
      email: lead.caller_email || null,
      service_type: lead.case_type,
      urgency: lead.urgency,
      score: lead.score,
      score_label: lead.score_label,
      summary: lead.notes || '',
      recording_url: call?.recording_url || null,
    },
    appointment: appointment
      ? {
          date: appointment.appointment_date,
          time: appointment.appointment_time,
          staff: appointment.assigned_staff_id || null,
          status: appointment.status || 'confirmed',
        }
      : null,
  };
}

/**
 * Push to HubSpot CRM (placeholder — implement with HubSpot API when ready).
 */
async function pushToHubSpot(firm, lead, call, appointment) {
  logger.warn('crm_push', 'HubSpot integration not yet implemented', {
    firmId: firm.id,
    leadId: lead.id,
    source: 'crmPushController.pushToHubSpot',
  });
}

/**
 * Push to Salesforce CRM (placeholder — implement with Salesforce API when ready).
 */
async function pushToSalesforce(firm, lead, call, appointment) {
  logger.warn('crm_push', 'Salesforce integration not yet implemented', {
    firmId: firm.id,
    leadId: lead.id,
    source: 'crmPushController.pushToSalesforce',
  });
}

module.exports = {
  maybePushToCRM,
  buildPayload,
};
