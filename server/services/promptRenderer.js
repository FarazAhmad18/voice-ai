const supabase = require('./supabase');
const logger = require('./logger');

/**
 * Render a prompt template by replacing {{variables}} with real values.
 *
 * @param {object} template - { body, case_types }
 * @param {object} firm - firm record from DB
 * @param {array} activeStaff - staff records where is_active = true
 * @param {array} knowledgeEntries - active firm_knowledge records
 * @returns {string} rendered prompt
 */
function renderPrompt(template, firm, activeStaff = [], knowledgeEntries = []) {
  let prompt = template.body;

  const staffList = activeStaff.length > 0
    ? activeStaff.map(s => `- ${s.name} (${s.specialization || s.role || 'Staff'})`).join('\n')
    : 'No staff currently available';

  const replacements = {
    '{{agent_name}}': firm.agent_name || 'AI Assistant',
    '{{company_name}}': firm.name || 'Our Company',
    '{{business_hours}}': firm.business_hours || '9:00 AM - 5:00 PM, Monday - Friday',
    '{{active_staff}}': staffList,
    '{{phone}}': firm.phone || '',
    '{{address}}': firm.address || '',
    '{{services}}': (() => {
      try {
        const ct = template.case_types;
        if (Array.isArray(ct)) return ct.join(', ');
        if (typeof ct === 'string') return JSON.parse(ct).join(', ');
        return '';
      } catch { return ''; }
    })(),
    '{{email}}': firm.email || '',
    '{{website}}': firm.website || '',
  };

  for (const [key, value] of Object.entries(replacements)) {
    prompt = prompt.replaceAll(key, value);
  }

  // Append knowledge base FAQ section if there are active entries
  if (knowledgeEntries.length > 0) {
    const faqLines = knowledgeEntries.map(entry =>
      `Q: ${entry.question}\nA: ${entry.answer}`
    );

    prompt += '\n\nFREQUENTLY ASKED QUESTIONS:\nWhen callers ask these questions, use the answers below:\n\n'
      + faqLines.join('\n\n');
  }

  return prompt;
}

/**
 * Re-render a firm's prompt and update in DB.
 * Call this whenever staff, firm config, or template changes.
 *
 * @param {string} firmId
 * @returns {string} rendered prompt
 */
async function reRenderFirmPrompt(firmId) {
  if (!supabase) return null;

  try {
    // Fetch firm
    const { data: firm, error: firmErr } = await supabase
      .from('firms')
      .select('*')
      .eq('id', firmId)
      .single();

    if (firmErr || !firm) {
      logger.error('prompt', `Firm not found: ${firmId}`, { firmId, source: 'promptRenderer.reRenderFirmPrompt' });
      return null;
    }

    // Fetch template
    let template = null;
    if (firm.prompt_template_id) {
      const { data } = await supabase
        .from('prompt_templates')
        .select('*')
        .eq('id', firm.prompt_template_id)
        .single();
      template = data;
    }

    if (!template) {
      logger.warn('prompt', `No template found for firm ${firm.name}`, { firmId, source: 'promptRenderer.reRenderFirmPrompt' });
      return firm.rendered_prompt || null; // keep existing, never overwrite with null
    }

    // Fetch active staff
    const { data: staff } = await supabase
      .from('staff')
      .select('*')
      .eq('firm_id', firmId)
      .eq('is_active', true)
      .order('name');

    // Fetch active knowledge entries for FAQ section
    const { data: knowledge } = await supabase
      .from('firm_knowledge')
      .select('question, answer, category')
      .eq('firm_id', firmId)
      .eq('is_active', true)
      .order('sort_order')
      .order('created_at');

    const rendered = renderPrompt(template, firm, staff || [], knowledge || []);

    // Save rendered prompt to firm
    await supabase
      .from('firms')
      .update({ rendered_prompt: rendered })
      .eq('id', firmId);

    logger.info('prompt', `Prompt re-rendered for ${firm.name}`, {
      firmId,
      details: { templateName: template.name, staffCount: staff?.length || 0, knowledgeCount: knowledge?.length || 0, promptLength: rendered.length },
      source: 'promptRenderer.reRenderFirmPrompt',
    });

    return rendered;
  } catch (err) {
    logger.error('prompt', `Failed to re-render prompt: ${err.message}`, {
      firmId,
      details: { error: err.message },
      source: 'promptRenderer.reRenderFirmPrompt',
    });
    return null;
  }
}

module.exports = { renderPrompt, reRenderFirmPrompt };
