const RETELL_API_BASE = 'https://api.retellai.com';
const RETELL_API_KEY = process.env.RETELL_API_KEY;

/**
 * Make an authenticated request to the Retell API.
 */
async function retellFetch(path, options = {}) {
  const res = await fetch(`${RETELL_API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${RETELL_API_KEY}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  const data = await res.json();
  if (!res.ok) {
    console.error(`[Retell API Error] ${res.status}`, data);
    throw new Error(data.error || `Retell API error: ${res.status}`);
  }
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
  createPhoneNumber,
  createWebCall,
  verifyWebhookSignature,
};
