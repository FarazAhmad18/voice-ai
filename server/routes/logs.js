const express = require('express');
const router = express.Router();
const supabase = require('../services/supabase');

// GET /api/logs — fetch system logs (super_admin only for now)
router.get('/', async (req, res) => {
  if (!supabase) {
    return res.status(500).json({ error: 'Database not configured' });
  }

  const {
    level,
    category,
    firm_id,
    search,
    limit = 50,
    offset = 0,
    date_from,
    date_to,
  } = req.query;

  let query = supabase
    .from('system_logs')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(Number(offset), Number(offset) + Number(limit) - 1);

  if (level) query = query.eq('level', level);
  if (category) query = query.eq('category', category);
  if (firm_id) query = query.eq('firm_id', firm_id);
  if (search) query = query.ilike('message', `%${search}%`);
  if (date_from) query = query.gte('created_at', date_from);
  if (date_to) query = query.lte('created_at', date_to);

  const { data, error, count } = await query;

  if (error) return res.status(500).json({ error: error.message });

  // Get error counts by category (last 24h)
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: errorCounts } = await supabase
    .from('system_logs')
    .select('category')
    .eq('level', 'error')
    .gte('created_at', yesterday);

  const counts = {};
  (errorCounts || []).forEach((row) => {
    counts[row.category] = (counts[row.category] || 0) + 1;
  });

  res.json({
    logs: data,
    total: count,
    error_counts: counts,
  });
});

module.exports = router;
