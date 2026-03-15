const supabase = require('../services/supabase');
const { createAgent, updateAgent, importPhoneNumber } = require('../services/retell');
const { buyPhoneNumber, configureSmsWebhook } = require('../services/twilio');
const { reRenderFirmPrompt } = require('../services/promptRenderer');
const logger = require('../services/logger');

/**
 * Deploy a Retell agent for a firm.
 *
 * Flow:
 * 1. Render prompt template
 * 2. Create Retell agent
 * 3. Buy phone number from Twilio
 * 4. Import that number into Retell (so calls go to AI agent)
 * 5. Configure SMS webhook on the Twilio number (so texts go to our server)
 * 6. Save everything to the firm record
 *
 * Result: one number for both voice (Retell) and SMS (Twilio).
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

  // 1. Render prompt
  const renderedPrompt = await reRenderFirmPrompt(firmId);

  // 2. Create Retell agent
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

  // 3. Buy phone number from Twilio
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

  // 4. Import number into Retell (voice goes to AI agent)
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
    } else {
      logger.warn('retell_api', 'Twilio credentials missing — skipped Retell phone import', {
        firmId,
        source: 'agentController.deployAgent',
      });
    }

    // 5. Configure SMS webhook on the Twilio number
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

  // 6. Update firm record
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
    const agentUpdates = {
      agent_name: `${firm.agent_name || 'AI'} - ${firm.name}`,
    };
    if (firm.agent_voice_id) agentUpdates.voice_id = firm.agent_voice_id;

    await updateAgent(firm.retell_agent_id, agentUpdates);

    // Note: Retell prompts live on the LLM resource, not the agent.
    // The rendered prompt is stored in our DB for reference.
    // To update the actual LLM prompt in Retell, use the Retell dashboard
    // or implement LLM update API when available.

    logger.info('retell_api', `Agent updated: ${firm.retell_agent_id}`, {
      firmId,
      details: { agentId: firm.retell_agent_id, promptLength: renderedPrompt?.length },
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
