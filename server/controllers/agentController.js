const supabase = require('../services/supabase');
const { createAgent, updateAgent, createPhoneNumber } = require('../services/retell');
const { reRenderFirmPrompt } = require('../services/promptRenderer');
const logger = require('../services/logger');

/**
 * Deploy a Retell agent for a firm.
 * Creates the agent via Retell API, optionally assigns a phone number.
 *
 * @param {string} firmId - firm UUID
 * @param {object} opts - { voiceId, areaCode }
 */
async function deployAgent(firmId, opts = {}) {
  if (!supabase) throw new Error('Database not configured');

  const { data: firm } = await supabase
    .from('firms')
    .select('*')
    .eq('id', firmId)
    .single();

  if (!firm) throw new Error('Firm not found');

  // Render prompt first
  const renderedPrompt = await reRenderFirmPrompt(firmId);

  // Create Retell agent
  const webhookBase = process.env.WEBHOOK_BASE_URL || process.env.FRONTEND_URL || '';
  let agent;

  try {
    agent = await createAgent({
      agentName: `${firm.agent_name || 'AI'} - ${firm.name}`,
      llmId: process.env.RETELL_LLM_ID,
      voiceId: opts.voiceId || firm.agent_voice_id || 'retell-Cimo',
      webhookUrl: webhookBase ? `${webhookBase}/api/retell/webhook` : undefined,
    });

    logger.info('retell_api', `Agent created: ${agent.agent_id} for ${firm.name}`, {
      firmId,
      details: { agentId: agent.agent_id, agentName: agent.agent_name },
      source: 'agentController.deployAgent',
    });
  } catch (err) {
    logger.error('retell_api', `Failed to create agent for ${firm.name}: ${err.message}`, {
      firmId,
      details: { error: err.message },
      source: 'agentController.deployAgent',
    });
    throw err;
  }

  // Assign phone number if area code provided
  let phoneNumber = null;
  if (opts.areaCode) {
    try {
      const phoneData = await createPhoneNumber(opts.areaCode, agent.agent_id, firm.name);
      phoneNumber = phoneData.phone_number;

      logger.info('retell_api', `Phone number assigned: ${phoneNumber} for ${firm.name}`, {
        firmId,
        details: { phoneNumber, agentId: agent.agent_id },
        source: 'agentController.deployAgent',
      });
    } catch (err) {
      logger.warn('retell_api', `Failed to assign phone number: ${err.message}`, {
        firmId,
        details: { error: err.message, areaCode: opts.areaCode },
        source: 'agentController.deployAgent',
      });
    }
  }

  // Update firm with agent ID and phone number
  const updates = {
    retell_agent_id: agent.agent_id,
    rendered_prompt: renderedPrompt,
  };
  if (phoneNumber) updates.retell_phone_number = phoneNumber;

  await supabase
    .from('firms')
    .update(updates)
    .eq('id', firmId);

  return { agentId: agent.agent_id, phoneNumber };
}

/**
 * Update a firm's Retell agent (after prompt/voice change).
 */
async function updateFirmAgent(firmId) {
  if (!supabase) throw new Error('Database not configured');

  const { data: firm } = await supabase
    .from('firms')
    .select('*')
    .eq('id', firmId)
    .single();

  if (!firm || !firm.retell_agent_id) {
    logger.warn('retell_api', `No agent to update for firm ${firmId}`, { firmId });
    return null;
  }

  // Re-render prompt
  const renderedPrompt = await reRenderFirmPrompt(firmId);

  try {
    await updateAgent(firm.retell_agent_id, {
      agent_name: `${firm.agent_name || 'AI'} - ${firm.name}`,
      voice_id: firm.agent_voice_id || undefined,
    });

    logger.info('retell_api', `Agent updated: ${firm.retell_agent_id}`, {
      firmId,
      details: { agentId: firm.retell_agent_id },
      source: 'agentController.updateFirmAgent',
    });

    return { agentId: firm.retell_agent_id, renderedPrompt };
  } catch (err) {
    logger.error('retell_api', `Failed to update agent: ${err.message}`, {
      firmId,
      details: { error: err.message, agentId: firm.retell_agent_id },
      source: 'agentController.updateFirmAgent',
    });
    throw err;
  }
}

module.exports = { deployAgent, updateFirmAgent };
