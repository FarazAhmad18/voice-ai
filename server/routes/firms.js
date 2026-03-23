const express = require('express');
const router = express.Router();
const supabase = require('../services/supabase');
const authenticate = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');
const validateBody = require('../middleware/validateBody');
const { deployAgent, updateFirmAgent } = require('../controllers/agentController');
const { reRenderFirmPrompt } = require('../services/promptRenderer');
const logger = require('../services/logger');
const { sanitizeText } = require('../utils/sanitize');

const FIRM_UPDATABLE = [
  'name', 'industry', 'email', 'phone', 'address', 'website',
  'logo_url', 'brand_color', 'business_hours', 'agent_name',
  'agent_voice_id', 'prompt_template_id', 'crm_mode', 'crm_type',
  'crm_webhook_url', 'crm_api_key', 'plan', 'status',
  'calendar_mode', 'google_calendar_id',
];

// All firm routes require super_admin
router.use(authenticate, requireRole('super_admin'));

// GET /api/firms — list all clients
router.get('/', async (req, res) => {
  const start = Date.now();
  if (!supabase) return res.status(500).json({ error: 'Database not configured' });

  const { data: firms, error } = await supabase
    .from('firms')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    logger.error('database', `Failed to fetch firms: ${error.message}`, {
      userId: req.user?.id,
      source: 'routes.firms.getAll',
    });
    return res.status(500).json({ error: 'Failed to fetch clients. Please try again.' });
  }

  // Get counts using batch queries instead of N+1 per firm
  const firmIds = firms.map(f => f.id);

  const [leadCounts, aptCounts, staffCounts] = await Promise.all([
    supabase.from('leads').select('firm_id', { count: 'exact', head: false }).in('firm_id', firmIds),
    supabase.from('appointments').select('firm_id', { count: 'exact', head: false }).in('firm_id', firmIds),
    supabase.from('staff').select('firm_id', { count: 'exact', head: false }).in('firm_id', firmIds),
  ]);

  // Aggregate counts per firm
  const countMap = {};
  for (const id of firmIds) countMap[id] = { leads: 0, appointments: 0, staff: 0 };
  (leadCounts.data || []).forEach(r => { if (countMap[r.firm_id]) countMap[r.firm_id].leads++; });
  (aptCounts.data || []).forEach(r => { if (countMap[r.firm_id]) countMap[r.firm_id].appointments++; });
  (staffCounts.data || []).forEach(r => { if (countMap[r.firm_id]) countMap[r.firm_id].staff++; });

  const firmsWithCounts = firms.map(firm => ({
    ...firm,
    _counts: countMap[firm.id] || { leads: 0, appointments: 0, staff: 0 },
  }));

  logger.info('admin', `Fetched ${firmsWithCounts.length} firms`, {
    userId: req.user?.id,
    details: { count: firmsWithCounts.length, duration: Date.now() - start },
    durationMs: Date.now() - start,
    source: 'routes.firms.getAll',
  });

  res.json(firmsWithCounts);
});

// GET /api/firms/:id — single client detail
router.get('/:id', async (req, res) => {
  const start = Date.now();
  if (!supabase) return res.status(500).json({ error: 'Database not configured' });

  const { data: firm, error } = await supabase
    .from('firms')
    .select('*')
    .eq('id', req.params.id)
    .single();

  if (error) return res.status(404).json({ error: 'Firm not found' });

  // Get staff
  const { data: staff } = await supabase
    .from('staff')
    .select('*')
    .eq('firm_id', firm.id)
    .order('name');

  // Get counts
  const [leadCount, aptCount] = await Promise.all([
    supabase.from('leads').select('id', { count: 'exact', head: true }).eq('firm_id', firm.id),
    supabase.from('appointments').select('id', { count: 'exact', head: true }).eq('firm_id', firm.id),
  ]);

  const duration = Date.now() - start;
  logger.info('admin', `Fetched firm detail: ${firm.name}`, {
    userId: req.user?.id,
    firmId: firm.id,
    details: { firmId: firm.id, staffCount: staff?.length || 0, duration },
    durationMs: duration,
    source: 'routes.firms.getById',
  });

  res.json({
    ...firm,
    staff: staff || [],
    _counts: {
      leads: leadCount.count || 0,
      appointments: aptCount.count || 0,
      staff: staff?.length || 0,
    },
  });
});

// POST /api/firms — create a new client
router.post('/', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: 'Database not configured' });

  const {
    name, industry, email, phone, address, website,
    business_hours, agent_name, agent_voice_id,
    prompt_template_id, brand_color, plan,
    staff: staffList,
    admin_email, admin_name, admin_password,
    deploy_agent, area_code,
  } = req.body;

  if (!name || !industry) {
    return res.status(400).json({ error: 'Name and industry are required' });
  }

  // BUG 5: Reject if admin_email is provided but password is too short
  if (admin_email && (!admin_password || admin_password.length < 6)) {
    return res.status(400).json({ error: 'Admin password must be at least 6 characters' });
  }

  // Sanitize text inputs to prevent XSS
  const safeName = sanitizeText(name, 200);
  const safeAgentName = agent_name ? sanitizeText(agent_name, 100) : 'AI Assistant';
  const safeAdminName = admin_name ? sanitizeText(admin_name, 200) : null;

  try {
    // 1. Create firm
    const { data: firm, error: firmErr } = await supabase
      .from('firms')
      .insert({
        name: safeName,
        industry: industry || 'other',
        email, phone,
        address: address ? sanitizeText(address, 500) : null,
        website,
        business_hours: business_hours || '9:00 AM - 5:00 PM, Monday - Friday',
        agent_name: safeAgentName,
        agent_voice_id: agent_voice_id || null,
        prompt_template_id: prompt_template_id || null,
        brand_color: brand_color || '#6d28d9',
        status: 'active',
        plan: ['growth', 'scale', 'enterprise'].includes(plan) ? plan : 'growth',
      })
      .select()
      .single();

    if (firmErr) {
      logger.error('database', `Failed to create firm: ${firmErr.message}`, {
        userId: req.user.id,
        details: { name: safeName, industry },
        source: 'routes.firms.create',
      });
      return res.status(500).json({ error: 'Failed to create client. Please try again.' });
    }

    logger.info('admin', `Client created: ${safeName} (${industry})`, {
      firmId: firm.id,
      userId: req.user.id,
      source: 'routes.firms.create',
    });

    // 2. Create staff members
    if (staffList && Array.isArray(staffList) && staffList.length > 0) {
      const staffRecords = staffList.map(s => ({
        firm_id: firm.id,
        name: sanitizeText(s.name, 100),
        role: s.role ? sanitizeText(s.role, 50) : null,
        specialization: s.specialization ? sanitizeText(s.specialization, 100) : null,
        email: s.email ? sanitizeText(s.email, 200) : null,
        phone: s.phone || null,
        is_active: s.is_active !== false,
      }));

      await supabase.from('staff').insert(staffRecords);
    }

    // 3. Render prompt (skip if deploying agent — deployAgent does it)
    if (prompt_template_id && !deploy_agent) {
      await reRenderFirmPrompt(firm.id);
    }

    // 4. Create admin user for this firm
    if (admin_email && admin_password && admin_password.length >= 6) {
      try {
        const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
          email: admin_email,
          password: admin_password,
          email_confirm: true,
        });

        if (!authErr && authData?.user) {
          await supabase.from('users').insert({
            id: authData.user.id,
            email: admin_email,
            name: safeAdminName || safeName + ' Admin',
            role: 'admin',
            firm_id: firm.id,
          });

          logger.info('admin', `Admin user created: ${admin_email} for ${name}`, {
            firmId: firm.id,
            userId: req.user.id,
            source: 'routes.firms.create',
          });
        }
      } catch (authErr) {
        logger.warn('admin', `Failed to create admin user: ${authErr.message}`, {
          firmId: firm.id,
          details: { error: authErr.message },
          source: 'routes.firms.create',
        });
      }
    }

    // 5. Deploy Retell agent if requested
    let agentData = null;
    if (deploy_agent) {
      try {
        agentData = await deployAgent(firm.id, {
          voiceId: agent_voice_id,
          areaCode: area_code,
        });
      } catch (deployErr) {
        logger.warn('admin', `Agent deployment failed: ${deployErr.message}`, {
          firmId: firm.id,
          source: 'routes.firms.create',
        });
      }
    }

    // Fetch final state
    const { data: finalFirm } = await supabase
      .from('firms')
      .select('*')
      .eq('id', firm.id)
      .single();

    const { data: finalStaff } = await supabase
      .from('staff')
      .select('*')
      .eq('firm_id', firm.id);

    res.status(201).json({
      ...finalFirm,
      staff: finalStaff || [],
      _agent: agentData,
    });
  } catch (err) {
    logger.error('admin', `Failed to create client: ${err.message}`, {
      userId: req.user.id,
      details: { error: err.message, name: safeName, industry },
      source: 'routes.firms.create',
    });
    res.status(500).json({ error: 'Failed to create client' });
  }
});

// PATCH /api/firms/:id — update client
router.patch('/:id', validateBody(FIRM_UPDATABLE), async (req, res) => {
  const firmId = req.params.id;
  const userId = req.user?.id;

  console.log(`[PATCH /firms/${firmId}] START — body:`, JSON.stringify(req.body), '| user:', userId);
  logger.info('admin', `PATCH firm started: ${firmId}`, {
    firmId, userId, details: { body: req.body }, source: 'routes.firms.patch',
  });

  if (!supabase) {
    console.error(`[PATCH /firms/${firmId}] FAIL — supabase not configured`);
    return res.status(500).json({ error: 'Database not configured' });
  }

  try {
    // Sanitize text fields to prevent XSS
    const sanitizedBody = { ...req.body };
    if (sanitizedBody.name) sanitizedBody.name = sanitizeText(sanitizedBody.name, 200);
    if (sanitizedBody.agent_name) sanitizedBody.agent_name = sanitizeText(sanitizedBody.agent_name, 100);
    if (sanitizedBody.address) sanitizedBody.address = sanitizeText(sanitizedBody.address, 500);
    if (sanitizedBody.business_hours) sanitizedBody.business_hours = sanitizeText(sanitizedBody.business_hours, 200);

    console.log(`[PATCH /firms/${firmId}] calling supabase update with:`, JSON.stringify(sanitizedBody));

    const { data, error } = await supabase
      .from('firms')
      .update(sanitizedBody)
      .eq('id', firmId)
      .select()
      .single();

    console.log(`[PATCH /firms/${firmId}] supabase result — error:`, error?.message || null, '| data:', data ? data.id : null);

    if (error) {
      logger.error('database', `Supabase update failed for firm ${firmId}: ${error.message}`, {
        firmId, userId,
        details: { code: error.code, hint: error.hint, details: error.details, body: sanitizedBody },
        source: 'routes.firms.patch',
      });
      return res.status(500).json({ error: 'Failed to update client. Please try again.' });
    }

    if (!data) {
      console.warn(`[PATCH /firms/${firmId}] no data returned — firm not found`);
      return res.status(404).json({ error: 'Firm not found' });
    }

    const safeDetails = { ...req.body };
    delete safeDetails.crm_api_key;
    delete safeDetails.crm_access_token;

    logger.info('admin', `Client updated: ${data.name} (${Object.keys(sanitizedBody).join(', ')})`, {
      firmId: data.id, userId,
      details: safeDetails,
      source: 'routes.firms.patch',
    });

    // Re-render prompt if template or relevant fields changed
    const promptFields = ['prompt_template_id', 'agent_name', 'business_hours', 'name', 'phone', 'address'];
    if (promptFields.some(f => req.body[f] !== undefined)) {
      console.log(`[PATCH /firms/${firmId}] re-rendering prompt...`);
      await reRenderFirmPrompt(data.id);
      if (data.retell_agent_id) {
        try { await updateFirmAgent(data.id); } catch (e) { /* logged inside */ }
      }
    }

    console.log(`[PATCH /firms/${firmId}] SUCCESS — sending response`);
    res.json(data);
  } catch (err) {
    console.error(`[PATCH /firms/${firmId}] CAUGHT ERROR:`, err.message, err.stack);
    logger.error('database', `Unexpected error updating firm ${firmId}: ${err.message}`, {
      firmId, userId,
      details: { error: err.message, stack: err.stack, body: req.body },
      source: 'routes.firms.patch',
    });
    res.status(500).json({ error: 'Failed to update client. Please try again.' });
  }
});

// POST /api/firms/:id/sync-agent — re-render prompt and push to Retell
router.post('/:id/sync-agent', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: 'Database not configured' });

  const { data: firm } = await supabase.from('firms').select('id, name, retell_agent_id').eq('id', req.params.id).single();
  if (!firm) return res.status(404).json({ error: 'Firm not found' });

  try {
    const result = await updateFirmAgent(firm.id);
    logger.info('retell_api', `Manual agent sync by super_admin for ${firm.name}`, {
      firmId: firm.id, userId: req.user.id, source: 'routes.firms.syncAgent',
    });
    res.json({ success: true, agentId: result?.agentId, llmId: result?.llmId, promptLength: result?.renderedPrompt?.length });
  } catch (err) {
    logger.error('retell_api', `Agent sync failed for ${firm.name}: ${err.message}`, { firmId: firm.id });
    res.status(500).json({ error: err.message || 'Sync failed' });
  }
});

// POST /api/firms/:id/deploy-agent — deploy a new Retell agent for an existing undeployed firm
router.post('/:id/deploy-agent', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: 'Database not configured' });

  const { area_code, voice_id } = req.body;
  const { data: firm } = await supabase.from('firms').select('id, name').eq('id', req.params.id).single();
  if (!firm) return res.status(404).json({ error: 'Firm not found' });

  try {
    const { deployAgent } = require('../controllers/agentController');
    const result = await deployAgent(firm.id, { areaCode: area_code, voiceId: voice_id });
    logger.info('retell_api', `Agent deployed by super_admin for ${firm.name}`, {
      firmId: firm.id, userId: req.user.id,
      details: { agentId: result.agentId }, source: 'routes.firms.deployAgent',
    });
    const { data: updated } = await supabase.from('firms').select('*').eq('id', firm.id).single();
    res.json({ success: true, ...result, firm: updated });
  } catch (err) {
    logger.error('retell_api', `Agent deploy failed for ${firm.name}: ${err.message}`, { firmId: firm.id });
    res.status(500).json({ error: err.message || 'Deploy failed' });
  }
});

module.exports = router;
