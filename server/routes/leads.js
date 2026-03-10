const express = require('express');
const router = express.Router();
const supabase = require('../services/supabase');
const { getLocalStore } = require('../controllers/webhookController');

// GET /api/leads - Get all leads (for dashboard)
router.get('/', async (req, res) => {
  if (supabase) {
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
  }

  // Fallback: return from local store
  const store = getLocalStore();
  res.json(store.leads.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
});

// GET /api/leads/:id - Get single lead with call data
router.get('/:id', async (req, res) => {
  const { id } = req.params;

  if (supabase) {
    const { data: lead, error } = await supabase
      .from('leads')
      .select('*')
      .eq('id', id)
      .single();

    if (error) return res.status(404).json({ error: 'Lead not found' });

    const { data: calls } = await supabase
      .from('calls')
      .select('*')
      .eq('lead_id', id)
      .order('created_at', { ascending: false });

    return res.json({ ...lead, calls: calls || [] });
  }

  // Fallback: local store
  const store = getLocalStore();
  const lead = store.leads.find((l) => l.id === id);
  if (!lead) return res.status(404).json({ error: 'Lead not found' });

  const calls = store.calls.filter((c) => c.lead_id === id);
  res.json({ ...lead, calls });
});

// PATCH /api/leads/:id - Update lead status
router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  if (supabase) {
    const { data, error } = await supabase
      .from('leads')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
  }

  // Fallback: local store
  const store = getLocalStore();
  const lead = store.leads.find((l) => l.id === id);
  if (!lead) return res.status(404).json({ error: 'Lead not found' });

  Object.assign(lead, updates);
  res.json(lead);
});

module.exports = router;
