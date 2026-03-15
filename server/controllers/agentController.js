const supabase = require('../services/supabase');
const { createAgent, updateAgent, createLLM, updateLLM, importPhoneNumber } = require('../services/retell');
const { buyPhoneNumber, configureSmsWebhook } = require('../services/twilio');
const { reRenderFirmPrompt } = require('../services/promptRenderer');
const logger = require('../services/logger');

/**
 * Deploy a Retell agent for a firm.
 *
 * Flow:
 * 1. Render prompt template (with staff names + knowledge base FAQ)
 * 2. Create Retell LLM with the rendered prompt
 * 3. Create Retell agent linked to that LLM
 * 4. Buy phone number from Twilio
 * 5. Import that number into Retell (so calls go to AI agent)
 * 6. Configure SMS webhook on the Twilio number (so texts go to our server)
 * 7. Save everything to the firm record
 *
 * Result: one number for both voice (Retell) and SMS (Twilio).
 * The AI agent knows attorney names, business hours, and FAQ answers.
 */
async function deployAgent(firmId, opts = {}) {
  if (!supabase) throw new Error('Database not configured');

  const { data: firm } = await supabase
    .from('firms')
    .select('*')
    .eq('id', firmId)
    .single();

  if (!firm) throw new Error('Firm not found');

  // 1. Render prompt (includes staff names + knowledge base FAQ)
  const renderedPrompt = await reRenderFirmPrompt(firmId);

  // 2. Create Retell LLM with the rendered prompt
  const webhookBase = process.env.WEBHOOK_BASE_URL || process.env.FRONTEND_URL || '';
  let llm;

  try {
    llm = await createLLM({
      generalPrompt: renderedPrompt,
      beginMessage: `Hello, thank you for calling ${firm.name}. My name is ${firm.agent_name || 'the AI assistant'}. How can I help you today?`,
    });

    logger.info('retell_api', `LLM created: ${llm.llm_id} for ${firm.name}`, {
      firmId,
      details: { llmId: llm.llm_id, promptLength: renderedPrompt?.length },
      source: 'agentController.deployAgent',
    });
  } catch (err) {
    logger.error('retell_api', `Failed to create LLM for ${firm.name}: ${err.message}`, {
      firmId,
      details: { error: err.message },
      source: 'agentController.deployAgent',
    });
    throw err;
  }

  // 3. Create Retell agent linked to the LLM
  let agent;

  try {
    agent = await createAgent({
      agentName: `${firm.agent_name || 'AI'} - ${firm.name}`,
      llmId: llm.llm_id,
      voiceId: opts.voiceId || firm.agent_voice_id || 'retell-Cimo',
      webhookUrl: webhookBase ? `${webhookBase}/api/retell/webhook` : undefined,
    });

    logger.info('retell_api', `Agent created: ${agent.agent_id} for ${firm.name}`, {
      firmId,
      details: { agentId: agent.agent_id, llmId: llm.llm_id },
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

  // 4. Buy phone number from Twilio
  let phoneNumber = null;
  let twilioPhoneSid = null;

  if (opts.areaCode) {
    try {
      const purchased = await buyPhoneNumber(opts.areaCode);
      phoneNumber = purchased.phoneNumber;
      twilioPhoneSid = purchased.sid;

      logger.info('sms', `Twilio number purchased: ${phoneNumber} for ${firm.name}`, {
        firmId,
        details: { phoneNumber, sid: twilioPhoneSid, areaCode: opts.areaCode },
        source: 'agentController.deployAgent',
      });
    } catch (err) {
      logger.warn('sms', `Failed to buy Twilio number: ${err.message}`, {
        firmId,
        details: { error: err.message, areaCode: opts.areaCode },
        source: 'agentController.deployAgent',
      });
    }
  }

  // 5. Import number into Retell (voice goes to AI agent)
  if (phoneNumber) {
    const twilioSid = process.env.TWILIO_ACCOUNT_SID;
    const twilioToken = process.env.TWILIO_AUTH_TOKEN;

    if (twilioSid && twilioToken) {
      try {
        await importPhoneNumber(phoneNumber, agent.agent_id, twilioSid, twilioToken);

        logger.info('retell_api', `Phone imported to Retell: ${phoneNumber} → ${agent.agent_id}`, {
          firmId,
          details: { phoneNumber, agentId: agent.agent_id },
          source: 'agentController.deployAgent',
        });
      } catch (err) {
        logger.warn('retell_api', `Failed to import number into Retell: ${err.message}`, {
          firmId,
          details: { error: err.message, phoneNumber },
          source: 'agentController.deployAgent',
        });
      }
    }

    // 6. Configure SMS webhook on the Twilio number
    if (twilioPhoneSid && webhookBase) {
      try {
        await configureSmsWebhook(twilioPhoneSid, `${webhookBase}/api/twilio/sms`);

        logger.info('sms', `SMS webhook configured for ${phoneNumber}`, {
          firmId,
          details: { phoneNumber, webhookUrl: `${webhookBase}/api/twilio/sms` },
          source: 'agentController.deployAgent',
        });
      } catch (err) {
        logger.warn('sms', `Failed to configure SMS webhook: ${err.message}`, {
          firmId,
          details: { error: err.message },
          source: 'agentController.deployAgent',
        });
      }
    }
  }

  // 7. Update firm record with agent ID, LLM ID, phone number, and rendered prompt
  const updates = {
    retell_agent_id: agent.agent_id,
    retell_llm_id: llm.llm_id,
    rendered_prompt: renderedPrompt,
  };
  if (phoneNumber) updates.retell_phone_number = phoneNumber;

  await supabase
    .from('firms')
    .update(updates)
    .eq('id', firmId);

  return { agentId: agent.agent_id, llmId: llm.llm_id, phoneNumber };
}

/**
 * Update a firm's Retell agent AND LLM prompt.
 *
 * This is called when:
 * - Staff is added/removed/toggled
 * - Knowledge base entries change
 * - Firm name/hours/settings change
 * - Prompt template is edited
 *
 * The rendered prompt (with staff names + FAQ) is pushed to the
 * Retell LLM so the live AI agent uses the latest information.
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

  // Re-render prompt (includes staff names + knowledge base FAQ)
  const renderedPrompt = await reRenderFirmPrompt(firmId);

  try {
    // Update agent name/voice
    const agentUpdates = {
      agent_name: `${firm.agent_name || 'AI'} - ${firm.name}`,
    };
    if (firm.agent_voice_id) agentUpdates.voice_id = firm.agent_voice_id;

    await updateAgent(firm.retell_agent_id, agentUpdates);

    // Push the rendered prompt to the Retell LLM
    const llmId = firm.retell_llm_id || process.env.RETELL_LLM_ID;

    if (llmId) {
      await updateLLM(llmId, {
        general_prompt: renderedPrompt,
        begin_message: `Hello, thank you for calling ${firm.name}. My name is ${firm.agent_name || 'the AI assistant'}. How can I help you today?`,
      });

      logger.info('retell_api', `LLM prompt updated: ${llmId} (${renderedPrompt?.length} chars)`, {
        firmId,
        details: { llmId, agentId: firm.retell_agent_id, promptLength: renderedPrompt?.length },
        source: 'agentController.updateFirmAgent',
      });
    } else {
      logger.warn('retell_api', `No LLM ID found for firm ${firm.name} — prompt NOT pushed to Retell`, {
        firmId,
        source: 'agentController.updateFirmAgent',
      });
    }

    logger.info('retell_api', `Agent updated: ${firm.retell_agent_id}`, {
      firmId,
      details: { agentId: firm.retell_agent_id },
      source: 'agentController.updateFirmAgent',
    });

    return { agentId: firm.retell_agent_id, llmId, renderedPrompt };
  } catch (err) {
    logger.error('retell_api', `Failed to update agent/LLM: ${err.message}`, {
      firmId,
      details: { error: err.message, agentId: firm.retell_agent_id },
      source: 'agentController.updateFirmAgent',
    });
    throw err;
  }
}

module.exports = { deployAgent, updateFirmAgent };
