const express = require('express');
const router = express.Router();
const supabase = require('../services/supabase');
const authenticate = require('../middleware/auth');
const validateBody = require('../middleware/validateBody');
const logger = require('../services/logger');

const LEAD_UPDATABLE = ['status', 'assigned_staff_id', 'follow_up_date', 'notes'];

// All lead routes require authentication
router.use(authenticate);

// GET /api/leads
router.get('/', async (req, res) => {
  const start = Date.now();
  if (!supabase) return res.status(503).json({ error: 'Database unavailable' });

  const limit = Math.min(Math.max(parseInt(req.query.limit) || 100, 1), 500);
  const offset = Math.max(parseInt(req.query.offset) || 0, 0);

  // Super admins with no firm can query all leads or filter by firm_id query param
  let firmId;
  if (req.user.role === 'super_admin' && !req.firm) {
    firmId = req.query.firm_id || null; // optional filter
  } else if (req.firm) {
    firmId = req.firm.id;
  } else {
    return res.status(400).json({ error: 'No firm associated with user' });
  }

  let query = supabase
    .from('leads')
    .select('*', { count: 'exact' });

  if (firmId) {
    query = query.eq('firm_id', firmId);
  }

  query = query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) return res.status(500).json({ error: error.message });

  logger.info('lead', `Fetched ${data?.length || 0} leads (total: ${count})`, {
    firmId: req.firm?.id,
    userId: req.user?.id,
    details: { count: data?.length || 0, total: count, duration: Date.now() - start },
    durationMs: Date.now() - start,
    source: 'routes.leads.getAll',
  });

  return res.json({ data, total: count });
});

// GET /api/leads/:id
router.get('/:id', async (req, res) => {
  const start = Date.now();
  if (!supabase) return res.status(503).json({ error: 'Database unavailable' });

  const { id } = req.params;

  let query = supabase
    .from('leads')
    .select('*')
    .eq('id', id);

  // Non-super_admin users must have a firm and can only see their own leads
  if (req.user.role !== 'super_admin') {
    if (!req.firm) return res.status(400).json({ error: 'No firm associated with user' });
    query = query.eq('firm_id', req.firm.id);
  }

  const { data: lead, error } = await query.single();

  if (error) return res.status(404).json({ error: 'Lead not found' });

  const { data: calls } = await supabase
    .from('calls')
    .select('*')
    .eq('lead_id', id)
    .order('created_at', { ascending: false });

  logger.info('lead', `Fetched lead detail: ${id}`, {
    firmId: req.firm?.id,
    userId: req.user?.id,
    leadId: id,
    details: { callsCount: calls?.length || 0, duration: Date.now() - start },
    durationMs: Date.now() - start,
    source: 'routes.leads.getById',
  });

  return res.json({ ...lead, calls: calls || [] });
});

// PATCH /api/leads/:id
router.patch('/:id', validateBody(LEAD_UPDATABLE), async (req, res) => {
  if (!supabase) return res.status(503).json({ error: 'Database unavailable' });
  if (!req.firm) return res.status(400).json({ error: 'No firm associated with user' });

  const { id } = req.params;

  // First check the lead exists to avoid cryptic Supabase errors on missing rows
  const { data: existing, error: checkErr } = await supabase
    .from('leads')
    .select('id')
    .eq('id', id)
    .eq('firm_id', req.firm.id)
    .maybeSingle();

  if (checkErr) return res.status(500).json({ error: checkErr.message });
  if (!existing) return res.status(404).json({ error: 'Lead not found' });

  const { data, error } = await supabase
    .from('leads')
    .update(req.body)
    .eq('id', id)
    .eq('firm_id', req.firm.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });

  logger.info('lead', `Lead updated: ${id}`, {
    firmId: req.firm.id,
    leadId: id,
    userId: req.user.id,
    details: req.body,
    source: 'routes.leads.patch',
  });

  return res.json(data);
});

// POST /api/leads/:id/notes
router.post('/:id/notes', async (req, res) => {
  if (!supabase) return res.status(503).json({ error: 'Database unavailable' });
  if (!req.firm) return res.status(400).json({ error: 'No firm associated with user' });

  const { id } = req.params;
  const { text } = req.body;

  if (!text) return res.status(400).json({ error: 'Note text is required' });

  const note = { text, author: req.user.name, created_at: new Date().toISOString() };

  const { data: lead, error: fetchErr } = await supabase
    .from('leads')
    .select('call_notes')
    .eq('id', id)
    .eq('firm_id', req.firm.id)
    .single();

  if (fetchErr) return res.status(404).json({ error: 'Lead not found' });

  const updatedNotes = [...(lead.call_notes || []), note];
  const { data, error } = await supabase
    .from('leads')
    .update({ call_notes: updatedNotes })
    .eq('id', id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  return res.json(data);
});

module.exports = router;
