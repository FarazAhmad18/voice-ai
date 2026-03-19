const express = require('express');
const router = express.Router();
const supabase = require('../services/supabase');
const authenticate = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');
const { reRenderFirmPrompt } = require('../services/promptRenderer');
const { updateFirmAgent } = require('../controllers/agentController');
const logger = require('../services/logger');
const { sanitizeText, sanitizeForPrompt } = require('../utils/sanitize');

const VALID_CATEGORIES = [
  'general', 'services', 'pricing', 'location', 'hours', 'insurance', 'policies', 'other',
];

// All knowledge routes require authentication
router.use(authenticate);

// GET /api/knowledge — list all knowledge entries for the user's firm
router.get('/', async (req, res) => {
  if (!supabase || !req.firm) return res.json([]);

  try {
    const { data, error } = await supabase
      .from('firm_knowledge')
      .select('*')
      .eq('firm_id', req.firm.id)
      .order('sort_order')
      .order('created_at');

    if (error) {
      logger.error('knowledge', `Failed to fetch knowledge: ${error.message}`, {
        firmId: req.firm.id,
        source: 'routes.knowledge.get',
      });
      return res.status(500).json({ error: 'Failed to fetch knowledge entries. Please try again.' });
    }

    res.json(data);
  } catch (err) {
    logger.error('knowledge', `Unexpected error fetching knowledge: ${err.message}`, {
      firmId: req.firm.id,
      details: { error: err.message },
      source: 'routes.knowledge.get',
    });
    res.status(500).json({ error: 'Failed to fetch knowledge entries' });
  }
});

// POST /api/knowledge — create a new Q&A entry (admin only)
router.post('/', requireRole('admin', 'super_admin'), async (req, res) => {
  if (!supabase || !req.firm) return res.status(500).json({ error: 'Database not configured' });

  const { question, answer, category, is_active, sort_order } = req.body;

  if (!question || !question.trim()) {
    return res.status(400).json({ error: 'Question is required' });
  }
  if (!answer || !answer.trim()) {
    return res.status(400).json({ error: 'Answer is required' });
  }

  const cat = category || 'general';
  if (!VALID_CATEGORIES.includes(cat)) {
    return res.status(400).json({ error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}` });
  }

  try {
    // FIX 4: Enforce maximum 200 knowledge entries per firm
    const { count: entryCount } = await supabase
      .from('firm_knowledge')
      .select('id', { count: 'exact', head: true })
      .eq('firm_id', req.firm.id);

    if (entryCount >= 200) {
      return res.status(400).json({ error: 'Maximum 200 knowledge entries per firm. Delete some to add new ones.' });
    }

    // Sanitize inputs: strip HTML and prompt injection patterns at storage time
    const safeQuestion = sanitizeForPrompt(question.trim(), 500);
    const safeAnswer = sanitizeForPrompt(answer.trim(), 2000);

    if (!safeQuestion) return res.status(400).json({ error: 'Question is empty after sanitization' });
    if (!safeAnswer) return res.status(400).json({ error: 'Answer is empty after sanitization' });

    const { data, error } = await supabase
      .from('firm_knowledge')
      .insert({
        firm_id: req.firm.id,
        question: safeQuestion,
        answer: safeAnswer,
        category: cat,
        is_active: is_active !== false,
        sort_order: typeof sort_order === 'number' ? sort_order : 0,
      })
      .select()
      .single();

    if (error) {
      logger.error('knowledge', `Failed to create knowledge entry: ${error.message}`, {
        firmId: req.firm.id,
        userId: req.user.id,
        source: 'routes.knowledge.create',
      });
      return res.status(500).json({ error: 'Failed to create knowledge entry. Please try again.' });
    }

    logger.info('knowledge', `Knowledge entry created: "${question.trim().slice(0, 60)}"`, {
      firmId: req.firm.id,
      userId: req.user.id,
      details: { category: cat, knowledgeId: data.id },
      source: 'routes.knowledge.create',
    });

    // Re-render prompt and sync agent so AI learns the new knowledge
    await reRenderAndSync(req.firm);

    res.status(201).json(data);
  } catch (err) {
    logger.error('knowledge', `Unexpected error creating knowledge: ${err.message}`, {
      firmId: req.firm.id,
      details: { error: err.message },
      source: 'routes.knowledge.create',
    });
    res.status(500).json({ error: 'Failed to create knowledge entry' });
  }
});

// PATCH /api/knowledge/reorder — update sort_order for multiple entries (admin only)
// Must be registered before /:id to avoid route conflict
router.patch('/reorder', requireRole('admin', 'super_admin'), async (req, res) => {
  if (!supabase || !req.firm) return res.status(500).json({ error: 'Database not configured' });

  const { items } = req.body; // [{ id: 'uuid', sort_order: 0 }, ...]

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Items array is required' });
  }

  try {
    // Update each item's sort_order, scoped to the firm
    const errors = [];
    for (const item of items) {
      if (!item.id || typeof item.sort_order !== 'number') {
        errors.push({ id: item.id, error: 'Invalid id or sort_order' });
        continue;
      }

      const { error } = await supabase
        .from('firm_knowledge')
        .update({ sort_order: item.sort_order, updated_at: new Date().toISOString() })
        .eq('id', item.id)
        .eq('firm_id', req.firm.id);

      if (error) {
        errors.push({ id: item.id, error: error.message });
      }
    }

    if (errors.length > 0) {
      logger.warn('knowledge', `Partial reorder failure: ${errors.length} items failed`, {
        firmId: req.firm.id,
        userId: req.user.id,
        details: { errors },
        source: 'routes.knowledge.reorder',
      });
    }

    logger.info('knowledge', `Knowledge reordered: ${items.length} items`, {
      firmId: req.firm.id,
      userId: req.user.id,
      source: 'routes.knowledge.reorder',
    });

    // Re-render prompt since FAQ order changed
    await reRenderAndSync(req.firm);

    res.json({ success: true, errors });
  } catch (err) {
    logger.error('knowledge', `Unexpected error reordering knowledge: ${err.message}`, {
      firmId: req.firm.id,
      details: { error: err.message },
      source: 'routes.knowledge.reorder',
    });
    res.status(500).json({ error: 'Failed to reorder knowledge entries' });
  }
});

// PATCH /api/knowledge/:id — update a Q&A entry (admin only)
router.patch('/:id', requireRole('admin', 'super_admin'), async (req, res) => {
  if (!supabase || !req.firm) return res.status(500).json({ error: 'Database not configured' });

  const allowed = ['question', 'answer', 'category', 'is_active', 'sort_order'];
  const updates = {};
  for (const field of allowed) {
    if (req.body[field] !== undefined) {
      if (field === 'category' && !VALID_CATEGORIES.includes(req.body[field])) {
        return res.status(400).json({ error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}` });
      }
      if ((field === 'question' || field === 'answer') && typeof req.body[field] === 'string') {
        const maxLen = field === 'question' ? 500 : 2000;
        updates[field] = sanitizeForPrompt(req.body[field].trim(), maxLen);
        if (!updates[field]) {
          return res.status(400).json({ error: `${field} cannot be empty after sanitization` });
        }
      } else {
        updates[field] = req.body[field];
      }
    }
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'No valid fields provided' });
  }

  updates.updated_at = new Date().toISOString();

  try {
    const { data, error } = await supabase
      .from('firm_knowledge')
      .update(updates)
      .eq('id', req.params.id)
      .eq('firm_id', req.firm.id)
      .select()
      .single();

    if (error) {
      logger.error('knowledge', `Failed to update knowledge entry: ${error.message}`, {
        firmId: req.firm.id,
        userId: req.user.id,
        details: { knowledgeId: req.params.id },
        source: 'routes.knowledge.patch',
      });
      return res.status(500).json({ error: 'Failed to update knowledge entry. Please try again.' });
    }

    if (!data) return res.status(404).json({ error: 'Knowledge entry not found' });

    logger.info('knowledge', `Knowledge entry updated: "${(data.question || '').slice(0, 60)}"`, {
      firmId: req.firm.id,
      userId: req.user.id,
      details: { knowledgeId: data.id, fields: Object.keys(updates) },
      source: 'routes.knowledge.patch',
    });

    // Re-render prompt and sync agent
    await reRenderAndSync(req.firm);

    res.json(data);
  } catch (err) {
    logger.error('knowledge', `Unexpected error updating knowledge: ${err.message}`, {
      firmId: req.firm.id,
      details: { error: err.message },
      source: 'routes.knowledge.patch',
    });
    res.status(500).json({ error: 'Failed to update knowledge entry' });
  }
});

// DELETE /api/knowledge/:id — delete a Q&A entry (admin only)
router.delete('/:id', requireRole('admin', 'super_admin'), async (req, res) => {
  if (!supabase || !req.firm) return res.status(500).json({ error: 'Database not configured' });

  try {
    // First fetch the entry to log what was deleted
    const { data: existing } = await supabase
      .from('firm_knowledge')
      .select('question')
      .eq('id', req.params.id)
      .eq('firm_id', req.firm.id)
      .single();

    if (!existing) return res.status(404).json({ error: 'Knowledge entry not found' });

    const { error } = await supabase
      .from('firm_knowledge')
      .delete()
      .eq('id', req.params.id)
      .eq('firm_id', req.firm.id);

    if (error) {
      logger.error('knowledge', `Failed to delete knowledge entry: ${error.message}`, {
        firmId: req.firm.id,
        userId: req.user.id,
        details: { knowledgeId: req.params.id },
        source: 'routes.knowledge.delete',
      });
      return res.status(500).json({ error: 'Failed to delete knowledge entry. Please try again.' });
    }

    logger.info('knowledge', `Knowledge entry deleted: "${(existing.question || '').slice(0, 60)}"`, {
      firmId: req.firm.id,
      userId: req.user.id,
      details: { knowledgeId: req.params.id },
      source: 'routes.knowledge.delete',
    });

    // Re-render prompt and sync agent
    await reRenderAndSync(req.firm);

    res.json({ success: true });
  } catch (err) {
    logger.error('knowledge', `Unexpected error deleting knowledge: ${err.message}`, {
      firmId: req.firm.id,
      details: { error: err.message },
      source: 'routes.knowledge.delete',
    });
    res.status(500).json({ error: 'Failed to delete knowledge entry' });
  }
});

/**
 * Re-render the firm's prompt and sync with Retell agent.
 * Called after any knowledge change so the AI learns immediately.
 */
async function reRenderAndSync(firm) {
  try {
    await reRenderFirmPrompt(firm.id);
    if (firm.retell_agent_id) {
      await updateFirmAgent(firm.id);
    }
  } catch (err) {
    logger.warn('knowledge', `Failed to sync agent after knowledge change: ${err.message}`, {
      firmId: firm.id,
      source: 'routes.knowledge.reRenderAndSync',
    });
  }
}

module.exports = router;
