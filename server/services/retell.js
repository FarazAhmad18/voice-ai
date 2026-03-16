const logger = require('./logger');

const RETELL_API_BASE = 'https://api.retellai.com';
const RETELL_API_KEY = process.env.RETELL_API_KEY;

/**
 * Make an authenticated request to the Retell API.
 * Logs every call with timing for observability.
 */
async function retellFetch(path, options = {}) {
  const method = options.method || 'GET';
  const start = Date.now();

  logger.info('retell_api', `API call: ${method} ${path}`, {
    details: { method, path },
    source: 'retell.retellFetch',
  });

  // FIX 7: AbortController with 15-second timeout
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  let res;
  try {
    res = await fetch(`${RETELL_API_BASE}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${RETELL_API_KEY}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
  } catch (networkErr) {
    const duration = Date.now() - start;
    const isTimeout = networkErr.name === 'AbortError';
    logger.error('retell_api', `API ${isTimeout ? 'timeout' : 'network error'}: ${method} ${path} - ${networkErr.message}`, {
      details: { method, path, error: networkErr.message, duration, isTimeout },
      durationMs: duration,
      source: 'retell.retellFetch',
    });
    if (isTimeout) {
      throw new Error(`Retell API timeout after 15s: ${method} ${path}`);
    }
    throw networkErr;
  } finally {
    clearTimeout(timeout);
  }

  const duration = Date.now() - start;
  const data = await res.json();

  if (!res.ok) {
    logger.error('retell_api', `API error: ${res.status} ${method} ${path}`, {
      details: { method, path, status: res.status, error: data, duration },
      durationMs: duration,
      source: 'retell.retellFetch',
    });
    throw new Error(data.error || `Retell API error: ${res.status}`);
  }

  logger.info('retell_api', `API response: ${res.status} ${method} ${path}`, {
    details: { method, path, status: res.status, duration },
    durationMs: duration,
    source: 'retell.retellFetch',
  });

  return data;
}

/**
 * Create a new Retell agent.
 */
async function createAgent({ agentName, llmId, voiceId, webhookUrl }) {
  return retellFetch('/v2/create-agent', {
    method: 'POST',
    body: JSON.stringify({
      agent_name: agentName,
      response_engine: {
        type: 'retell-llm',
        llm_id: llmId,
      },
      voice_id: voiceId || 'retell-Cimo',
      webhook_url: webhookUrl,
      webhook_events: ['call_started', 'call_ended', 'call_analyzed'],
    }),
  });
}

/**
 * Update an existing Retell agent.
 */
async function updateAgent(agentId, updates) {
  return retellFetch(`/v2/update-agent/${agentId}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

/**
 * Get a single agent.
 */
async function getAgent(agentId) {
  return retellFetch(`/v2/get-agent/${agentId}`);
}

/**
 * List all agents.
 */
async function listAgents() {
  return retellFetch('/v2/list-agents');
}

/**
 * Create (buy) a phone number and optionally assign to an agent.
 */
async function createPhoneNumber(areaCode, agentId, nickname) {
  return retellFetch('/v2/create-phone-number', {
    method: 'POST',
    body: JSON.stringify({
      area_code: areaCode,
      agent_id: agentId || undefined,
      nickname: nickname || undefined,
    }),
  });
}

/**
 * Create a web call (for website widget / browser calls).
 * Returns an access_token that expires in 30 seconds.
 */
async function createWebCall(agentId) {
  return retellFetch('/v2/create-web-call', {
    method: 'POST',
    body: JSON.stringify({ agent_id: agentId }),
  });
}

/**
 * Create a new Retell LLM with a prompt.
 * The LLM is where the actual prompt/instructions live.
 * The agent references the LLM via llm_id.
 */
async function createLLM({ generalPrompt, beginMessage }) {
  return retellFetch('/v2/create-retell-llm', {
    method: 'POST',
    body: JSON.stringify({
      general_prompt: generalPrompt,
      begin_message: beginMessage || null,
    }),
  });
}

/**
 * Update an existing Retell LLM's prompt.
 * This is how prompt changes actually reach the live agent.
 */
async function updateLLM(llmId, updates) {
  return retellFetch(`/v2/update-retell-llm/${llmId}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

/**
 * Get a Retell LLM by ID.
 */
async function getLLM(llmId) {
  return retellFetch(`/v2/get-retell-llm/${llmId}`);
}

/**
 * Import an existing phone number (e.g., from Twilio) into Retell.
 * This allows the same number to handle voice (Retell) + SMS (Twilio).
 */
async function importPhoneNumber(phoneNumber, agentId, twilioAccountSid, twilioAuthToken) {
  return retellFetch('/v2/import-phone-number', {
    method: 'POST',
    body: JSON.stringify({
      phone_number: phoneNumber,
      agent_id: agentId,
      twilio_account_sid: twilioAccountSid,
      twilio_auth_token: twilioAuthToken,
    }),
  });
}

/**
 * Verify Retell webhook signature.
 * Uses HMAC comparison of the request body against the API key.
 */
function verifyWebhookSignature(body, signature) {
  if (!RETELL_API_KEY || !signature) return false;
  const crypto = require('crypto');
  const hash = crypto
    .createHmac('sha256', RETELL_API_KEY)
    .update(body)
    .digest('base64');
  return hash === signature;
}

module.exports = {
  createAgent,
  updateAgent,
  getAgent,
  listAgents,
  createLLM,
  updateLLM,
  getLLM,
  createPhoneNumber,
  importPhoneNumber,
  createWebCall,
  verifyWebhookSignature,
};
