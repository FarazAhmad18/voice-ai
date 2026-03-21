const supabase = require('./supabase');
const logger = require('./logger');

/**
 * Dangerous prompt injection patterns to strip from user-controlled data.
 * These patterns could trick the LLM into ignoring its system prompt.
 */
const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+instructions?/gi,
  /ignore\s+(all\s+)?above\s+instructions?/gi,
  /you\s+are\s+now\b/gi,
  /forget\s+(all\s+)?(your\s+)?instructions?/gi,
  /forget\s+(everything|all)/gi,
  /disregard\s+(all\s+)?(previous|above|your)/gi,
  /\bIMPORTANT\s*:/gi,
  /\bSYSTEM\s*:/gi,
  /\bINSTRUCTION\s*:/gi,
  /\bASSISTANT\s*:/gi,
  /\bnew\s+instructions?\s*:/gi,
  /\boverride\s*:/gi,
  /\bdo\s+not\s+follow/gi,
  /\bact\s+as\s+(if\s+)?you\s+are/gi,
  /\bpretend\s+(you\s+are|to\s+be)/gi,
  /\brole\s*play\s+as/gi,
  /```[\s\S]*?```/g, // strip code blocks that could contain hidden instructions
];

/**
 * Escape user-controlled text for safe inclusion in AI prompts.
 * Strips injection patterns, newlines, and enforces length limits.
 *
 * @param {string} text - User-controlled text to escape
 * @param {number} maxLength - Maximum allowed length
 * @returns {string} Sanitized text
 */
function escapeForPrompt(text, maxLength = 200) {
  if (!text || typeof text !== 'string') return '';

  let sanitized = text;

  // Replace newlines with spaces (prevents multi-line injection)
  sanitized = sanitized.replace(/[\r\n]+/g, ' ');

  // Strip dangerous instruction patterns
  for (const pattern of INJECTION_PATTERNS) {
    sanitized = sanitized.replace(pattern, '');
  }

  // Collapse multiple spaces
  sanitized = sanitized.replace(/\s{2,}/g, ' ').trim();

  // Enforce length limit
  if (sanitized.length > maxLength) {
    sanitized = sanitized.slice(0, maxLength).trim();
  }

  return sanitized;
}

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
    ? activeStaff.map(s => {
        const name = escapeForPrompt(s.name, 100);
        const spec = escapeForPrompt(s.specialization || s.role || 'Staff', 100);
        return `- ${name} (${spec})`;
      }).join('\n')
    : 'No staff currently available';

  const replacements = {
    '{{agent_name}}': escapeForPrompt(firm.agent_name || 'AI Assistant', 100),
    '{{company_name}}': escapeForPrompt(firm.name || 'Our Company', 200),
    '{{business_hours}}': escapeForPrompt(firm.business_hours || '9:00 AM - 5:00 PM, Monday - Friday', 200),
    '{{active_staff}}': staffList,
    '{{phone}}': escapeForPrompt(firm.phone || '', 30),
    '{{address}}': escapeForPrompt(firm.address || '', 300),
    '{{services}}': (() => {
      try {
        const ct = template.case_types;
        if (Array.isArray(ct)) return ct.map(c => escapeForPrompt(c, 50)).join(', ');
        if (typeof ct === 'string') return JSON.parse(ct).map(c => escapeForPrompt(c, 50)).join(', ');
        return '';
      } catch { return ''; }
    })(),
    '{{email}}': escapeForPrompt(firm.email || '', 100),
    '{{website}}': escapeForPrompt(firm.website || '', 200),
  };

  for (const [key, value] of Object.entries(replacements)) {
    prompt = prompt.replaceAll(key, value);
  }

  // Detect unresolved {{variables}} and replace with safe defaults
  const unresolvedVars = prompt.match(/\{\{[^}]+\}\}/g);
  if (unresolvedVars) {
    logger.warn('prompt', `Unresolved variables in prompt: ${unresolvedVars.join(', ')}`, {
      firmId: firm?.id,
      details: { unresolved: unresolvedVars },
      source: 'promptRenderer.renderPrompt',
    });
    // Remove unresolved variables to prevent AI from saying them
    for (const v of unresolvedVars) {
      prompt = prompt.replaceAll(v, '');
    }
  }

  // Append knowledge base FAQ section if there are active entries
  if (knowledgeEntries.length > 0) {
    const faqLines = knowledgeEntries.map(entry => {
      const question = escapeForPrompt(entry.question, 300);
      const answer = escapeForPrompt(entry.answer, 500);
      return `Q: ${question}\nA: ${answer}`;
    });

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

module.exports = { renderPrompt, reRenderFirmPrompt, escapeForPrompt };
