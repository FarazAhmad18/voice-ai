const express = require('express');
const router = express.Router();
const supabase = require('../services/supabase');
const authenticate = require('../middleware/auth');
const validateBody = require('../middleware/validateBody');
const logger = require('../services/logger');
const dataCache = require('../services/dataCache');

const LEAD_UPDATABLE = ['status', 'assigned_staff_id', 'follow_up_date', 'notes'];
const VALID_LEAD_STATUSES = ['new', 'contacted', 'booked', 'converted', 'closed'];
const requireRole = require('../middleware/requireRole');

// All lead routes require authentication and valid role
router.use(authenticate);
router.use(requireRole('admin', 'staff', 'super_admin'));

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

  // Check server-side cache first (only for default queries — no offset/special filters)
  if (firmId && offset === 0 && limit === 100) {
    const cached = dataCache.get('leads', firmId);
    if (cached) {
      return res.json(cached);
    }
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

  if (error) {
    logger.error('database', `Failed to fetch leads: ${error.message}`, {
      firmId: req.firm?.id,
      userId: req.user?.id,
      source: 'routes.leads.getAll',
    });
    return res.status(500).json({ error: 'Failed to fetch data. Please try again.' });
  }

  logger.info('lead', `Fetched ${data?.length || 0} leads (total: ${count})`, {
    firmId: req.firm?.id,
    userId: req.user?.id,
    details: { count: data?.length || 0, total: count, duration: Date.now() - start },
    durationMs: Date.now() - start,
    source: 'routes.leads.getAll',
  });

  // Store in cache for next time
  const result = { data, total: count };
  if (firmId && offset === 0 && limit === 100) {
    dataCache.set('leads', firmId, result);
  }

  return res.json(result);
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

  const [{ data: calls }, { data: appointments }] = await Promise.all([
    supabase
      .from('calls')
      .select('*')
      .eq('lead_id', id)
      .eq('firm_id', lead.firm_id)
      .order('created_at', { ascending: false })
      .limit(50),
    // Fetch appointments by lead_id OR matching phone number (fallback for unlinked appointments)
    supabase
      .from('appointments')
      .select('*, staff:assigned_staff_id(id, name, specialization)')
      .eq('firm_id', lead.firm_id)
      .or(`lead_id.eq.${id}${lead.caller_phone && lead.caller_phone !== 'unknown' ? `,caller_phone.eq.${lead.caller_phone}` : ''}`)
      .order('created_at', { ascending: false })
      .limit(5),
  ]);

  logger.info('lead', `Fetched lead detail: ${id}`, {
    firmId: req.firm?.id,
    userId: req.user?.id,
    leadId: id,
    details: { callsCount: calls?.length || 0, duration: Date.now() - start },
    durationMs: Date.now() - start,
    source: 'routes.leads.getById',
  });

  return res.json({ ...lead, calls: calls || [], appointments: appointments || [] });
});

// PATCH /api/leads/:id
router.patch('/:id', validateBody(LEAD_UPDATABLE), async (req, res) => {
  if (!supabase) return res.status(503).json({ error: 'Database unavailable' });
  if (!req.firm) return res.status(400).json({ error: 'No firm associated with user' });

  const { id } = req.params;

  // Validate status value if provided
  if (req.body.status && !VALID_LEAD_STATUSES.includes(req.body.status)) {
    return res.status(400).json({ error: `Invalid status. Must be one of: ${VALID_LEAD_STATUSES.join(', ')}` });
  }

  // Update directly — no need for separate existence check (1 query instead of 2)
  const { data, error } = await supabase
    .from('leads')
    .update(req.body)
    .eq('id', id)
    .eq('firm_id', req.firm.id)
    .select()
    .single();

  if (error || !data) {
    if (!data) return res.status(404).json({ error: 'Lead not found' });
    logger.error('database', `Failed to update lead: ${error.message}`, {
      firmId: req.firm.id,
      leadId: id,
      source: 'routes.leads.patch',
    });
    return res.status(500).json({ error: 'Failed to update data. Please try again.' });
  }

  // Invalidate leads cache so next GET fetches fresh data
  dataCache.invalidate('leads', req.firm.id);

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

  // FIX 6: Note length limit
  if (text.length > 5000) {
    return res.status(400).json({ error: 'Note too long. Maximum 5000 characters.' });
  }

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
    .eq('firm_id', req.firm.id)
    .select()
    .single();

  if (error) {
    logger.error('database', `Failed to save note: ${error.message}`, {
      firmId: req.firm.id,
      leadId: id,
      source: 'routes.leads.postNote',
    });
    return res.status(500).json({ error: 'Failed to save note. Please try again.' });
  }
  return res.json(data);
});

module.exports = router;
