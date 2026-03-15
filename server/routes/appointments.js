const express = require('express');
const router = express.Router();
const supabase = require('../services/supabase');
const authenticate = require('../middleware/auth');
const validateBody = require('../middleware/validateBody');
const logger = require('../services/logger');
const { getLocalStore } = require('../controllers/webhookController');

const APPOINTMENT_UPDATABLE = ['status', 'appointment_date', 'appointment_time', 'assigned_staff_id', 'notes'];

// All appointment routes require authentication
router.use(authenticate);

// GET /api/appointments
router.get('/', async (req, res) => {
  if (supabase && req.firm) {
    const { data, error } = await supabase
      .from('appointments')
      .select('*')
      .eq('firm_id', req.firm.id)
      .order('appointment_date', { ascending: true });

    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
  }

  const store = getLocalStore();
  res.json(store.appointments.sort((a, b) => new Date(a.appointment_date) - new Date(b.appointment_date)));
});

// PATCH /api/appointments/:id
router.patch('/:id', validateBody(APPOINTMENT_UPDATABLE), async (req, res) => {
  const { id } = req.params;

  if (supabase && req.firm) {
    const { data, error } = await supabase
      .from('appointments')
      .update(req.body)
      .eq('id', id)
      .eq('firm_id', req.firm.id)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: 'Appointment not found' });

    logger.info('appointment', `Appointment updated: ${id} → ${req.body.status || 'updated'}`, {
      firmId: req.firm.id,
      userId: req.user.id,
      details: req.body,
      source: 'routes.appointments.patch',
    });

    return res.json(data);
  }

  const store = getLocalStore();
  const apt = store.appointments.find((a) => a.id === id);
  if (!apt) return res.status(404).json({ error: 'Appointment not found' });
  Object.assign(apt, req.body);
  res.json(apt);
});

module.exports = router;
