const express = require('express');
const router = express.Router();
const supabase = require('../services/supabase');
const authenticate = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');
const { reRenderFirmPrompt } = require('../services/promptRenderer');
const { updateFirmAgent } = require('../controllers/agentController');
const logger = require('../services/logger');

// All staff routes require authentication
router.use(authenticate);

// GET /api/staff — list staff for current firm
router.get('/', async (req, res) => {
  if (!supabase || !req.firm) return res.json([]);

  const { data, error } = await supabase
    .from('staff')
    .select('*')
    .eq('firm_id', req.firm.id)
    .order('name');

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// POST /api/staff — add staff member (admin only)
router.post('/', requireRole('admin', 'super_admin'), async (req, res) => {
  if (!supabase || !req.firm) return res.status(500).json({ error: 'Database not configured' });

  const { name, role, specialization, email, phone, is_active, calendar_id } = req.body;

  if (!name) return res.status(400).json({ error: 'Name is required' });

  const { data, error } = await supabase
    .from('staff')
    .insert({
      firm_id: req.firm.id,
      name,
      role: role || null,
      specialization: specialization || null,
      email: email || null,
      phone: phone || null,
      is_active: is_active !== false,
      calendar_id: calendar_id || null,
    })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });

  logger.info('staff', `Staff added: ${name} to ${req.firm.name}`, {
    firmId: req.firm.id,
    userId: req.user.id,
    source: 'routes.staff.create',
  });

  // Re-render prompt + update agent
  await reRenderAndSync(req.firm.id);

  res.status(201).json(data);
});

// PATCH /api/staff/:id — update staff member (admin only)
router.patch('/:id', requireRole('admin', 'super_admin'), async (req, res) => {
  if (!supabase || !req.firm) return res.status(500).json({ error: 'Database not configured' });

  const allowed = ['name', 'role', 'specialization', 'email', 'phone', 'is_active', 'calendar_id'];
  const updates = {};
  for (const field of allowed) {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'No valid fields provided' });
  }

  const { data, error } = await supabase
    .from('staff')
    .update(updates)
    .eq('id', req.params.id)
    .eq('firm_id', req.firm.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'Staff member not found' });

  logger.info('staff', `Staff updated: ${data.name}`, {
    firmId: req.firm.id,
    userId: req.user.id,
    details: updates,
    source: 'routes.staff.patch',
  });

  // Re-render prompt + update agent
  await reRenderAndSync(req.firm.id);

  res.json(data);
});

// DELETE /api/staff/:id — soft delete (set is_active=false)
router.delete('/:id', requireRole('admin', 'super_admin'), async (req, res) => {
  if (!supabase || !req.firm) return res.status(500).json({ error: 'Database not configured' });

  const { data, error } = await supabase
    .from('staff')
    .update({ is_active: false })
    .eq('id', req.params.id)
    .eq('firm_id', req.firm.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'Staff member not found' });

  logger.info('staff', `Staff deactivated: ${data.name}`, {
    firmId: req.firm.id,
    userId: req.user.id,
    source: 'routes.staff.delete',
  });

  // Re-render prompt + update agent
  await reRenderAndSync(req.firm.id);

  res.json(data);
});

/**
 * Re-render prompt and sync with Retell agent.
 */
async function reRenderAndSync(firmId) {
  try {
    await reRenderFirmPrompt(firmId);
    const { data: firm } = await supabase.from('firms').select('retell_agent_id').eq('id', firmId).single();
    if (firm?.retell_agent_id) {
      await updateFirmAgent(firmId);
    }
  } catch (err) {
    logger.warn('staff', `Failed to sync agent after staff change: ${err.message}`, {
      firmId,
      source: 'routes.staff.reRenderAndSync',
    });
  }
}

module.exports = router;
