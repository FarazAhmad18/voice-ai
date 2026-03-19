const Retell = require('retell-sdk');
const crypto = require('crypto');
const logger = require('./logger');

const RETELL_API_KEY = process.env.RETELL_API_KEY;

// Initialise the official Retell SDK client
let retellClient = null;
if (RETELL_API_KEY) {
  retellClient = new Retell({ apiKey: RETELL_API_KEY });
} else {
  logger.warn('retell_api', 'RETELL_API_KEY not set — Retell API calls will fail');
}

/**
 * Create a new Retell agent.
 */
async function createAgent({ agentName, llmId, voiceId, webhookUrl }) {
  if (!retellClient) throw new Error('RETELL_API_KEY not configured');
  try {
    const agent = await retellClient.agent.create({
      agent_name: agentName,
      response_engine: { type: 'retell-llm', llm_id: llmId },
      voice_id: voiceId || 'retell-Cimo',
      ...(webhookUrl ? { webhook_url: webhookUrl } : {}),
    });
    logger.info('retell_api', `Agent created: ${agent.agent_id}`, {
      details: { agentId: agent.agent_id, llmId },
      source: 'retell.createAgent',
    });
    return agent;
  } catch (err) {
    logger.error('retell_api', `Failed to create agent: ${err.message}`, {
      details: { error: err.message },
      source: 'retell.createAgent',
    });
    throw err;
  }
}

/**
 * Update an existing Retell agent.
 */
async function updateAgent(agentId, updates) {
  if (!retellClient) throw new Error('RETELL_API_KEY not configured');
  try {
    const agent = await retellClient.agent.update(agentId, updates);
    logger.info('retell_api', `Agent updated: ${agentId}`, {
      details: { agentId, updates },
      source: 'retell.updateAgent',
    });
    return agent;
  } catch (err) {
    logger.error('retell_api', `Failed to update agent ${agentId}: ${err.message}`, {
      details: { agentId, error: err.message },
      source: 'retell.updateAgent',
    });
    throw err;
  }
}

/**
 * Get a single agent.
 */
async function getAgent(agentId) {
  if (!retellClient) throw new Error('RETELL_API_KEY not configured');
  return retellClient.agent.retrieve(agentId);
}

/**
 * List all agents.
 */
async function listAgents() {
  if (!retellClient) throw new Error('RETELL_API_KEY not configured');
  return retellClient.agent.list();
}

/**
 * Create a new Retell LLM with a prompt.
 */
async function createLLM({ generalPrompt, beginMessage }) {
  if (!retellClient) throw new Error('RETELL_API_KEY not configured');
  try {
    const llm = await retellClient.llm.create({
      general_prompt: generalPrompt,
      ...(beginMessage ? { begin_message: beginMessage } : {}),
    });
    logger.info('retell_api', `LLM created: ${llm.llm_id}`, {
      details: { llmId: llm.llm_id, promptLength: generalPrompt?.length },
      source: 'retell.createLLM',
    });
    return llm;
  } catch (err) {
    logger.error('retell_api', `Failed to create LLM: ${err.message}`, {
      details: { error: err.message },
      source: 'retell.createLLM',
    });
    throw err;
  }
}

/**
 * Update an existing Retell LLM's prompt.
 * This is how prompt changes actually reach the live agent.
 */
async function updateLLM(llmId, updates) {
  if (!retellClient) throw new Error('RETELL_API_KEY not configured');
  try {
    const llm = await retellClient.llm.update(llmId, updates);
    logger.info('retell_api', `LLM updated: ${llmId}`, {
      details: { llmId, promptLength: updates.general_prompt?.length },
      source: 'retell.updateLLM',
    });
    return llm;
  } catch (err) {
    logger.error('retell_api', `Failed to update LLM ${llmId}: ${err.message}`, {
      details: { llmId, error: err.message },
      source: 'retell.updateLLM',
    });
    throw err;
  }
}

/**
 * Get a Retell LLM by ID.
 */
async function getLLM(llmId) {
  if (!retellClient) throw new Error('RETELL_API_KEY not configured');
  return retellClient.llm.retrieve(llmId);
}

/**
 * Create (buy) a phone number and optionally assign to an agent.
 */
async function createPhoneNumber(areaCode, agentId, nickname) {
  if (!retellClient) throw new Error('RETELL_API_KEY not configured');
  return retellClient.phoneNumber.create({
    area_code: areaCode,
    ...(agentId ? { agent_id: agentId } : {}),
    ...(nickname ? { nickname } : {}),
  });
}

/**
 * Create a web call (for website widget / browser calls).
 * Returns an access_token that expires in 30 seconds.
 */
async function createWebCall(agentId) {
  if (!retellClient) throw new Error('RETELL_API_KEY not configured');
  return retellClient.call.createWebCall({ agent_id: agentId });
}

/**
 * Import an existing phone number (e.g., from Twilio) into Retell.
 */
async function importPhoneNumber(phoneNumber, agentId, twilioAccountSid, twilioAuthToken) {
  if (!retellClient) throw new Error('RETELL_API_KEY not configured');
  return retellClient.phoneNumber.import({
    phone_number: phoneNumber,
    agent_id: agentId,
    twilio_account_sid: twilioAccountSid,
    twilio_auth_token: twilioAuthToken,
  });
}

/**
 * Verify Retell webhook signature.
 * Uses HMAC comparison of the request body against the API key.
 */
function verifyWebhookSignature(body, signature) {
  if (!RETELL_API_KEY || !signature) return false;
  const hash = crypto
    .createHmac('sha256', RETELL_API_KEY)
    .update(body)
    .digest('base64');
  try {
    return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(signature));
  } catch {
    return false;
  }
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
