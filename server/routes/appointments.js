const express = require('express');
const router = express.Router();
const supabase = require('../services/supabase');
const authenticate = require('../middleware/auth');
const validateBody = require('../middleware/validateBody');
const logger = require('../services/logger');

const APPOINTMENT_UPDATABLE = ['status', 'appointment_date', 'appointment_time', 'assigned_staff_id', 'notes'];

// All appointment routes require authentication
router.use(authenticate);

// GET /api/appointments
router.get('/', async (req, res) => {
  const start = Date.now();
  if (!supabase) return res.status(503).json({ error: 'Database unavailable' });

  const limit = Math.min(Math.max(parseInt(req.query.limit) || 100, 1), 500);
  const offset = Math.max(parseInt(req.query.offset) || 0, 0);

  // Super admins with no firm can query all appointments or filter by firm_id query param
  let firmId;
  if (req.user.role === 'super_admin' && !req.firm) {
    firmId = req.query.firm_id || null;
  } else if (req.firm) {
    firmId = req.firm.id;
  } else {
    return res.status(400).json({ error: 'No firm associated with user' });
  }

  let query = supabase
    .from('appointments')
    .select('*', { count: 'exact' });

  if (firmId) {
    query = query.eq('firm_id', firmId);
  }

  query = query
    .order('appointment_date', { ascending: true })
    .range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) return res.status(500).json({ error: error.message });

  logger.info('appointment', `Fetched ${data?.length || 0} appointments (total: ${count})`, {
    firmId: req.firm?.id,
    userId: req.user?.id,
    details: { count: data?.length || 0, total: count, duration: Date.now() - start },
    durationMs: Date.now() - start,
    source: 'routes.appointments.getAll',
  });

  return res.json({ data, total: count });
});

// PATCH /api/appointments/:id
router.patch('/:id', validateBody(APPOINTMENT_UPDATABLE), async (req, res) => {
  if (!supabase) return res.status(503).json({ error: 'Database unavailable' });
  if (!req.firm) return res.status(400).json({ error: 'No firm associated with user' });

  const { id } = req.params;

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
});

module.exports = router;
