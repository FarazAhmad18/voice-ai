const express = require('express');
const router = express.Router();
const supabase = require('../services/supabase');
const authenticate = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');
const logger = require('../services/logger');
const { sanitizeText } = require('../utils/sanitize');

// All template routes require super_admin
router.use(authenticate, requireRole('super_admin'));

// GET /api/templates — list all prompt templates
router.get('/', async (req, res) => {
  const start = Date.now();
  if (!supabase) return res.status(500).json({ error: 'Database not configured' });

  const { data, error } = await supabase
    .from('prompt_templates')
    .select('*')
    .order('industry', { ascending: true });

  if (error) {
    logger.error('database', `Failed to fetch templates: ${error.message}`, {
      userId: req.user?.id,
      source: 'routes.templates.getAll',
    });
    return res.status(500).json({ error: 'Failed to fetch data. Please try again.' });
  }

  logger.info('admin', `Fetched ${data?.length || 0} templates`, {
    userId: req.user?.id,
    details: { count: data?.length || 0, duration: Date.now() - start },
    durationMs: Date.now() - start,
    source: 'routes.templates.getAll',
  });

  res.json(data);
});

// GET /api/templates/:id
router.get('/:id', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: 'Database not configured' });

  const { data, error } = await supabase
    .from('prompt_templates')
    .select('*')
    .eq('id', req.params.id)
    .single();

  if (error) return res.status(404).json({ error: 'Template not found' });
  res.json(data);
});

// POST /api/templates — create template
router.post('/', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: 'Database not configured' });

  const { name, industry, body, case_types, intake_questions } = req.body;

  if (!name || !industry || !body) {
    return res.status(400).json({ error: 'Name, industry, and body are required' });
  }

  // Sanitize name (but NOT body — body is the prompt template and needs special chars)
  const safeName = sanitizeText(name, 200);

  const { data, error } = await supabase
    .from('prompt_templates')
    .insert({
      name: safeName,
      industry,
      body,
      case_types: case_types || [],
      intake_questions: intake_questions || [],
      variables: extractVariables(body),
    })
    .select()
    .single();

  if (error) {
    logger.error('database', `Failed to create template: ${error.message}`, {
      userId: req.user.id,
      source: 'routes.templates.create',
    });
    return res.status(500).json({ error: 'Failed to create template. Please try again.' });
  }

  logger.info('admin', `Template created: ${name} (${industry})`, {
    userId: req.user.id,
    details: { templateId: data.id },
    source: 'routes.templates.create',
  });

  res.status(201).json(data);
});

// PATCH /api/templates/:id — update template
router.patch('/:id', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: 'Database not configured' });

  const allowed = ['name', 'industry', 'body', 'case_types', 'intake_questions'];
  const updates = {};
  for (const field of allowed) {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  }

  // Sanitize name but NOT body (body is the prompt template)
  if (updates.name) updates.name = sanitizeText(updates.name, 200);

  if (updates.body) {
    updates.variables = extractVariables(updates.body);
  }
  updates.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('prompt_templates')
    .update(updates)
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) {
    logger.error('database', `Failed to update template: ${error.message}`, {
      userId: req.user.id,
      source: 'routes.templates.patch',
    });
    return res.status(500).json({ error: 'Failed to update template. Please try again.' });
  }
  if (!data) return res.status(404).json({ error: 'Template not found' });

  logger.info('admin', `Template updated: ${data.name}`, {
    userId: req.user.id,
    details: { templateId: data.id },
    source: 'routes.templates.patch',
  });

  res.json(data);
});

// DELETE /api/templates/:id
router.delete('/:id', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: 'Database not configured' });

  // Check if any firms are using this template
  const { count } = await supabase
    .from('firms')
    .select('id', { count: 'exact', head: true })
    .eq('prompt_template_id', req.params.id);

  if (count > 0) {
    return res.status(409).json({ error: `Cannot delete: ${count} firm(s) are using this template. Reassign them first.` });
  }

  const { error } = await supabase
    .from('prompt_templates')
    .delete()
    .eq('id', req.params.id);

  if (error) {
    logger.error('database', `Failed to delete template: ${error.message}`, {
      userId: req.user?.id,
      source: 'routes.templates.delete',
    });
    return res.status(500).json({ error: 'Failed to delete template. Please try again.' });
  }

  logger.info('admin', `Template deleted: ${req.params.id}`, {
    userId: req.user?.id,
    details: { templateId: req.params.id },
    source: 'routes.templates.delete',
  });

  res.json({ deleted: true });
});

/**
 * Extract {{variable}} names from a template body.
 */
function extractVariables(body) {
  const matches = body.match(/\{\{(\w+)\}\}/g) || [];
  return [...new Set(matches.map(m => m.replace(/[{}]/g, '')))];
}

module.exports = router;
