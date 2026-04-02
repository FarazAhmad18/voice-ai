const express = require('express');
const router = express.Router();
const supabase = require('../services/supabase');
const authenticate = require('../middleware/auth');
const validateBody = require('../middleware/validateBody');
const logger = require('../services/logger');
const dataCache = require('../services/dataCache');

const APPOINTMENT_UPDATABLE = ['status', 'appointment_date', 'appointment_time', 'assigned_staff_id', 'notes'];
const VALID_APPOINTMENT_STATUSES = ['confirmed', 'completed', 'cancelled', 'no_show'];
const VALID_LEAD_STATUSES = ['new', 'contacted', 'booked', 'converted', 'closed'];

const requireRole = require('../middleware/requireRole');

// All appointment routes require authentication and valid role
router.use(authenticate);
router.use(requireRole('admin', 'staff', 'super_admin'));

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

  // Cache only default queries (no filters) — filtered queries always hit DB
  const hasFilters = req.query.assigned_staff_id || req.query.date_from || req.query.date_to;
  if (firmId && !hasFilters && offset === 0) {
    const cached = dataCache.get('appointments', firmId);
    if (cached) return res.json(cached);
  }

  if (firmId) {
    query = query.eq('firm_id', firmId);
  }

  // Filter by staff member
  if (req.query.assigned_staff_id) {
    query = query.eq('assigned_staff_id', req.query.assigned_staff_id);
  }

  // Filter by date range
  if (req.query.date_from) {
    query = query.gte('appointment_date', req.query.date_from);
  }
  if (req.query.date_to) {
    query = query.lte('appointment_date', req.query.date_to);
  }

  query = query
    .order('appointment_date', { ascending: true })
    .range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) {
    logger.error('database', `Failed to fetch appointments: ${error.message}`, {
      firmId: req.firm?.id,
      userId: req.user?.id,
      source: 'routes.appointments.getAll',
    });
    return res.status(500).json({ error: 'Failed to fetch data. Please try again.' });
  }

  logger.info('appointment', `Fetched ${data?.length || 0} appointments (total: ${count})`, {
    firmId: req.firm?.id,
    userId: req.user?.id,
    details: { count: data?.length || 0, total: count, duration: Date.now() - start },
    durationMs: Date.now() - start,
    source: 'routes.appointments.getAll',
  });

  const result = { data, total: count };
  if (firmId && !hasFilters && offset === 0) {
    dataCache.set('appointments', firmId, result);
  }

  return res.json(result);
});

// PATCH /api/appointments/:id
router.patch('/:id', validateBody(APPOINTMENT_UPDATABLE), async (req, res) => {
  if (!supabase) return res.status(503).json({ error: 'Database unavailable' });
  if (!req.firm) return res.status(400).json({ error: 'No firm associated with user' });

  const { id } = req.params;

  // Validate status value if provided
  if (req.body.status && !VALID_APPOINTMENT_STATUSES.includes(req.body.status)) {
    return res.status(400).json({ error: `Invalid status. Must be one of: ${VALID_APPOINTMENT_STATUSES.join(', ')}` });
  }

  const { data, error } = await supabase
    .from('appointments')
    .update(req.body)
    .eq('id', id)
    .eq('firm_id', req.firm.id)
    .select()
    .single();

  if (error) {
    logger.error('database', `Failed to update appointment: ${error.message}`, {
      firmId: req.firm.id,
      userId: req.user.id,
      source: 'routes.appointments.patch',
    });
    return res.status(500).json({ error: 'Failed to update data. Please try again.' });
  }
  if (!data) return res.status(404).json({ error: 'Appointment not found' });

  // Sync lead's appointment_booked field when appointment is cancelled
  if (req.body.status === 'cancelled' && data.lead_id) {
    const { count } = await supabase
      .from('appointments')
      .select('id', { count: 'exact', head: true })
      .eq('lead_id', data.lead_id)
      .eq('firm_id', req.firm.id)
      .in('status', ['confirmed', 'completed']);

    if (count === 0) {
      await supabase.from('leads').update({ appointment_booked: false }).eq('id', data.lead_id).eq('firm_id', req.firm.id);
    }
  }

  dataCache.invalidate('appointments', req.firm.id);

  // Invalidate appointments cache so next GET fetches fresh data
  dataCache.invalidate('appointments', req.firm.id);

  logger.info('appointment', `Appointment updated: ${id} → ${req.body.status || 'updated'}`, {
    firmId: req.firm.id,
    userId: req.user.id,
    details: req.body,
    source: 'routes.appointments.patch',
  });

  return res.json(data);
});

module.exports = router;
