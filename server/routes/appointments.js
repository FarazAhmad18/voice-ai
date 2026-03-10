const express = require('express');
const router = express.Router();
const supabase = require('../services/supabase');
const { getLocalStore } = require('../controllers/webhookController');

// GET /api/appointments - Get all appointments (for dashboard)
router.get('/', async (req, res) => {
  if (supabase) {
    const { data, error } = await supabase
      .from('appointments')
      .select('*')
      .order('appointment_date', { ascending: true });

    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
  }

  // Fallback: local store
  const store = getLocalStore();
  res.json(store.appointments.sort((a, b) => new Date(a.appointment_date) - new Date(b.appointment_date)));
});

// PATCH /api/appointments/:id - Update appointment status
router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  if (supabase) {
    const { data, error } = await supabase
      .from('appointments')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
  }

  // Fallback: local store
  const store = getLocalStore();
  const apt = store.appointments.find((a) => a.id === id);
  if (!apt) return res.status(404).json({ error: 'Appointment not found' });

  Object.assign(apt, updates);
  res.json(apt);
});

module.exports = router;
