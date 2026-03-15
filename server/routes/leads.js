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
  if (!supabase) return res.status(503).json({ error: 'Database unavailable' });
  if (!req.firm) return res.status(400).json({ error: 'No firm associated with user' });

  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .eq('firm_id', req.firm.id)
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  return res.json(data);
});

// GET /api/leads/:id
router.get('/:id', async (req, res) => {
  if (!supabase) return res.status(503).json({ error: 'Database unavailable' });
  if (!req.firm) return res.status(400).json({ error: 'No firm associated with user' });

  const { id } = req.params;

  const { data: lead, error } = await supabase
    .from('leads')
    .select('*')
    .eq('id', id)
    .eq('firm_id', req.firm.id)
    .single();

  if (error) return res.status(404).json({ error: 'Lead not found' });

  const { data: calls } = await supabase
    .from('calls')
    .select('*')
    .eq('lead_id', id)
    .order('created_at', { ascending: false });

  return res.json({ ...lead, calls: calls || [] });
});

// PATCH /api/leads/:id
router.patch('/:id', validateBody(LEAD_UPDATABLE), async (req, res) => {
  if (!supabase) return res.status(503).json({ error: 'Database unavailable' });
  if (!req.firm) return res.status(400).json({ error: 'No firm associated with user' });

  const { id } = req.params;

  const { data, error } = await supabase
    .from('leads')
    .update(req.body)
    .eq('id', id)
    .eq('firm_id', req.firm.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'Lead not found' });

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
