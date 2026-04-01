const express = require('express');
const router = express.Router();
const supabase = require('../services/supabase');
const authenticate = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');
const logger = require('../services/logger');

router.use(authenticate);
router.use(requireRole('admin', 'staff', 'super_admin'));

// Helper: parse period into date range
function parsePeriod(period, startParam, endParam) {
  const now = new Date();
  let end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  let start;
  let days;

  if (period === 'custom' && startParam && endParam) {
    start = new Date(startParam + 'T00:00:00.000Z');
    end = new Date(endParam + 'T23:59:59.999Z');
    days = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
  } else {
    days = period === '7d' ? 7 : period === '90d' ? 90 : 30;
    start = new Date(now);
    start.setDate(start.getDate() - days + 1);
    start.setHours(0, 0, 0, 0);
  }

  // Previous period of equal length for delta comparison
  const prevEnd = new Date(start.getTime() - 1);
  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevStart.getDate() - days + 1);
  prevStart.setHours(0, 0, 0, 0);

  return {
    start: start.toISOString(),
    end: end.toISOString(),
    prevStart: prevStart.toISOString(),
    prevEnd: prevEnd.toISOString(),
    days,
    label: period === 'custom' ? 'custom' : period || '30d',
  };
}

// Helper: group rows by date (YYYY-MM-DD)
function groupByDate(rows, dateField = 'created_at') {
  const map = {};
  for (const row of rows) {
    const d = row[dateField]?.slice(0, 10);
    if (d) map[d] = (map[d] || 0) + 1;
  }
  return map;
}

// Helper: get ISO week string
function isoWeek(dateStr) {
  const d = new Date(dateStr);
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

// Helper: fill in missing dates in a range
function fillDates(startStr, endStr) {
  const dates = [];
  const cur = new Date(startStr.slice(0, 10));
  const end = new Date(endStr.slice(0, 10));
  while (cur <= end) {
    dates.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

// GET /api/analytics
router.get('/', async (req, res) => {
  const startTime = Date.now();
  if (!supabase) return res.status(503).json({ error: 'Database unavailable' });

  let firmId;
  if (req.user.role === 'super_admin' && !req.firm) {
    firmId = req.query.firm_id || null;
  } else if (req.firm) {
    firmId = req.firm.id;
  } else {
    return res.status(400).json({ error: 'No firm associated with user' });
  }

  const { period, start: startParam, end: endParam } = req.query;
  const range = parsePeriod(period || '30d', startParam, endParam);
  const allDates = fillDates(range.start, range.end);

  try {
    // Build firm-scoped queries
    const withFirm = (query) => firmId ? query.eq('firm_id', firmId) : query;

    // Run all queries in parallel
    const [
      { data: leads },
      { data: prevLeads },
      { data: calls },
      { data: prevCalls },
      { data: appointments },
      { data: prevAppointments },
      { data: messages },
      { data: staff },
    ] = await Promise.all([
      // Current period leads
      withFirm(supabase.from('leads').select('id, status, score_label, case_type, source, urgency, sentiment, appointment_booked, assigned_staff_id, created_at')
        .gte('created_at', range.start).lte('created_at', range.end)).order('created_at', { ascending: true }),
      // Previous period leads (for deltas)
      withFirm(supabase.from('leads').select('id, status, appointment_booked, created_at')
        .gte('created_at', range.prevStart).lte('created_at', range.prevEnd)),
      // Current period calls
      withFirm(supabase.from('calls').select('id, lead_id, duration, ended_reason, sentiment, created_at')
        .gte('created_at', range.start).lte('created_at', range.end)),
      // Previous period calls
      withFirm(supabase.from('calls').select('id, created_at')
        .gte('created_at', range.prevStart).lte('created_at', range.prevEnd)),
      // Current period appointments
      withFirm(supabase.from('appointments').select('id, lead_id, status, assigned_staff_id, appointment_date, created_at')
        .gte('created_at', range.start).lte('created_at', range.end)),
      // Previous period appointments
      withFirm(supabase.from('appointments').select('id, status, created_at')
        .gte('created_at', range.prevStart).lte('created_at', range.prevEnd)),
      // Current period messages
      withFirm(supabase.from('messages').select('id, lead_id, direction, channel, created_at')
        .gte('created_at', range.start).lte('created_at', range.end)),
      // Staff (no date filter)
      withFirm(supabase.from('staff').select('id, name, role, specialization, is_active')),
    ]);

    const safeLeads = leads || [];
    const safePrevLeads = prevLeads || [];
    const safeCalls = calls || [];
    const safePrevCalls = prevCalls || [];
    const safeAppointments = appointments || [];
    const safePrevAppointments = prevAppointments || [];
    const safeMessages = messages || [];
    const safeStaff = staff || [];

    // === KPIs ===
    const currentLeadCount = safeLeads.length;
    const prevLeadCount = safePrevLeads.length;
    const currentCallCount = safeCalls.length;
    const prevCallCount = safePrevCalls.length;
    const currentAptsBooked = safeLeads.filter(l => l.appointment_booked).length;
    const prevAptsBooked = safePrevLeads.filter(l => l.appointment_booked).length;
    const currentConverted = safeLeads.filter(l => l.status === 'converted' || l.status === 'closed').length;
    const prevConverted = safePrevLeads.filter(l => l.status === 'converted' || l.status === 'closed').length;
    const currentConvRate = currentLeadCount > 0 ? (currentConverted / currentLeadCount) * 100 : 0;
    const prevConvRate = prevLeadCount > 0 ? (prevConverted / prevLeadCount) * 100 : 0;

    const delta = (cur, prev) => prev === 0 ? (cur > 0 ? 100 : 0) : parseFloat((((cur - prev) / prev) * 100).toFixed(1));

    const kpis = {
      total_leads: { current: currentLeadCount, previous: prevLeadCount, delta_pct: delta(currentLeadCount, prevLeadCount) },
      total_calls: { current: currentCallCount, previous: prevCallCount, delta_pct: delta(currentCallCount, prevCallCount) },
      appointments_booked: { current: currentAptsBooked, previous: prevAptsBooked, delta_pct: delta(currentAptsBooked, prevAptsBooked) },
      conversion_rate: { current: parseFloat(currentConvRate.toFixed(1)), previous: parseFloat(prevConvRate.toFixed(1)), delta_pct: delta(currentConvRate, prevConvRate) },
    };

    // === Lead Volume Over Time ===
    const leadsByDate = groupByDate(safeLeads);
    const lead_volume = allDates.map(date => ({ date, count: leadsByDate[date] || 0 }));

    // === Funnel ===
    const funnel = { new: 0, contacted: 0, booked: 0, converted: 0, closed: 0 };
    for (const l of safeLeads) {
      if (funnel.hasOwnProperty(l.status)) funnel[l.status]++;
    }

    // === Lead-to-Appointment Rate ===
    const lead_to_appointment_rate = currentLeadCount > 0
      ? parseFloat(((currentAptsBooked / currentLeadCount) * 100).toFixed(1))
      : 0;

    // === Call Duration Avg by Date ===
    const durationByDate = {};
    for (const c of safeCalls) {
      const d = c.created_at?.slice(0, 10);
      if (!d) continue;
      if (!durationByDate[d]) durationByDate[d] = { total: 0, count: 0 };
      durationByDate[d].total += (c.duration || 0);
      durationByDate[d].count++;
    }
    const call_duration_avg = allDates
      .filter(d => durationByDate[d])
      .map(d => ({
        date: d,
        avg_seconds: Math.round(durationByDate[d].total / durationByDate[d].count),
      }));

    // === Call Outcomes ===
    const call_outcomes = {};
    for (const c of safeCalls) {
      const reason = c.ended_reason || 'unknown';
      call_outcomes[reason] = (call_outcomes[reason] || 0) + 1;
    }

    // === Call Sentiment by Week ===
    const sentimentByWeek = {};
    for (const c of safeCalls) {
      if (!c.created_at) continue;
      const week = isoWeek(c.created_at);
      if (!sentimentByWeek[week]) sentimentByWeek[week] = { positive: 0, neutral: 0, negative: 0, distressed: 0 };
      const s = (c.sentiment || 'neutral').toLowerCase();
      if (sentimentByWeek[week].hasOwnProperty(s)) {
        sentimentByWeek[week][s]++;
      } else {
        sentimentByWeek[week].neutral++;
      }
    }
    const call_sentiment = Object.entries(sentimentByWeek)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([week, data]) => ({ week, ...data }));

    // === Staff Appointments ===
    const staffMap = {};
    for (const s of safeStaff) {
      staffMap[s.id] = s.name;
    }
    const staffAptCount = {};
    for (const a of safeAppointments) {
      if (a.assigned_staff_id && staffMap[a.assigned_staff_id]) {
        const key = a.assigned_staff_id;
        if (!staffAptCount[key]) staffAptCount[key] = 0;
        staffAptCount[key]++;
      }
    }
    const staff_appointments = Object.entries(staffAptCount)
      .map(([staff_id, count]) => ({ staff_id, staff_name: staffMap[staff_id], count }))
      .sort((a, b) => b.count - a.count);

    // === Staff Lead Assignments ===
    const staffLeadMap = {};
    for (const l of safeLeads) {
      if (l.assigned_staff_id && staffMap[l.assigned_staff_id]) {
        const key = l.assigned_staff_id;
        if (!staffLeadMap[key]) staffLeadMap[key] = { new: 0, contacted: 0, booked: 0, converted: 0, closed: 0 };
        if (staffLeadMap[key].hasOwnProperty(l.status)) staffLeadMap[key][l.status]++;
      }
    }
    const staff_leads = Object.entries(staffLeadMap)
      .map(([staff_id, statuses]) => ({ staff_id, staff_name: staffMap[staff_id], ...statuses }))
      .sort((a, b) => {
        const totalA = a.new + a.contacted + a.booked + a.converted + a.closed;
        const totalB = b.new + b.contacted + b.booked + b.converted + b.closed;
        return totalB - totalA;
      });

    // === Case Type Distribution ===
    const caseTypeMap = {};
    for (const l of safeLeads) {
      const ct = l.case_type || 'other';
      caseTypeMap[ct] = (caseTypeMap[ct] || 0) + 1;
    }
    const case_type_distribution = Object.entries(caseTypeMap)
      .map(([case_type, count]) => ({ case_type, count }))
      .sort((a, b) => b.count - a.count);

    // === Lead Source Distribution ===
    const sourceMap = {};
    for (const l of safeLeads) {
      const src = l.source || 'phone';
      sourceMap[src] = (sourceMap[src] || 0) + 1;
    }
    const lead_source_distribution = Object.entries(sourceMap)
      .map(([source, count]) => ({ source, count }))
      .sort((a, b) => b.count - a.count);

    // === Avg Time to First Contact ===
    // Find first outbound message per lead, calc delta from lead creation
    const leadCreatedMap = {};
    for (const l of safeLeads) {
      leadCreatedMap[l.id] = new Date(l.created_at).getTime();
    }
    const firstOutbound = {};
    const outboundMsgs = safeMessages
      .filter(m => m.direction === 'outbound' && (m.channel === 'sms' || m.channel === 'email'))
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    for (const m of outboundMsgs) {
      if (m.lead_id && !firstOutbound[m.lead_id] && leadCreatedMap[m.lead_id]) {
        firstOutbound[m.lead_id] = new Date(m.created_at).getTime();
      }
    }
    const contactTimeByDate = {};
    for (const [leadId, msgTime] of Object.entries(firstOutbound)) {
      const leadTime = leadCreatedMap[leadId];
      if (!leadTime) continue;
      const hours = (msgTime - leadTime) / (1000 * 60 * 60);
      if (hours < 0 || hours > 720) continue; // skip outliers >30 days
      const date = new Date(leadTime).toISOString().slice(0, 10);
      if (!contactTimeByDate[date]) contactTimeByDate[date] = { total: 0, count: 0 };
      contactTimeByDate[date].total += hours;
      contactTimeByDate[date].count++;
    }
    const avg_time_to_first_contact = Object.entries(contactTimeByDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, data]) => ({ date, avg_hours: parseFloat((data.total / data.count).toFixed(1)) }));

    // === Message Volume ===
    const msgByDate = {};
    for (const m of safeMessages) {
      const d = m.created_at?.slice(0, 10);
      if (!d) continue;
      if (!msgByDate[d]) msgByDate[d] = { inbound: 0, outbound: 0 };
      if (m.direction === 'inbound') msgByDate[d].inbound++;
      else msgByDate[d].outbound++;
    }
    const message_volume = allDates
      .filter(d => msgByDate[d])
      .map(d => ({ date: d, ...msgByDate[d] }));

    // === Lead Quality Trend ===
    const qualityByDate = {};
    for (const l of safeLeads) {
      const d = l.created_at?.slice(0, 10);
      if (!d) continue;
      if (!qualityByDate[d]) qualityByDate[d] = { hot: 0, warm: 0, cold: 0 };
      const label = l.score_label || 'cold';
      if (qualityByDate[d].hasOwnProperty(label)) qualityByDate[d][label]++;
    }
    const lead_quality_trend = allDates
      .map(d => ({ date: d, ...(qualityByDate[d] || { hot: 0, warm: 0, cold: 0 }) }));

    // === Appointment Outcomes ===
    const appointment_outcomes = { confirmed: 0, completed: 0, cancelled: 0, no_show: 0 };
    for (const a of safeAppointments) {
      if (appointment_outcomes.hasOwnProperty(a.status)) appointment_outcomes[a.status]++;
    }

    // === Appointment Show Rate Trend ===
    const aptByWeek = {};
    for (const a of safeAppointments) {
      if (!a.created_at) continue;
      const week = isoWeek(a.created_at);
      if (!aptByWeek[week]) aptByWeek[week] = { completed: 0, total: 0 };
      if (a.status !== 'cancelled') aptByWeek[week].total++;
      if (a.status === 'completed') aptByWeek[week].completed++;
    }
    const appointment_show_rate_trend = Object.entries(aptByWeek)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([week, data]) => ({
        week,
        rate: data.total > 0 ? parseFloat(((data.completed / data.total) * 100).toFixed(1)) : 0,
      }));

    const result = {
      period: {
        start: range.start.slice(0, 10),
        end: range.end.slice(0, 10),
        days: range.days,
        label: range.label,
      },
      previous_period: {
        start: range.prevStart.slice(0, 10),
        end: range.prevEnd.slice(0, 10),
      },
      kpis,
      lead_volume,
      funnel,
      lead_to_appointment_rate,
      call_duration_avg,
      call_outcomes,
      call_sentiment,
      staff_appointments,
      staff_leads,
      case_type_distribution,
      lead_source_distribution,
      avg_time_to_first_contact,
      message_volume,
      lead_quality_trend,
      appointment_outcomes,
      appointment_show_rate_trend,
    };

    logger.info('analytics', `Analytics fetched (${range.label}, ${range.days} days)`, {
      firmId,
      userId: req.user?.id,
      details: { period: range.label, leads: currentLeadCount, calls: currentCallCount },
      durationMs: Date.now() - startTime,
      source: 'routes.analytics.get',
    });

    return res.json(result);
  } catch (err) {
    logger.error('analytics', `Failed to compute analytics: ${err.message}`, {
      firmId,
      userId: req.user?.id,
      details: { error: err.message, stack: err.stack },
      source: 'routes.analytics.get',
    });
    return res.status(500).json({ error: 'Failed to compute analytics. Please try again.' });
  }
});

module.exports = router;
