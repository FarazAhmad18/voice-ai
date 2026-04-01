import { useState, useEffect, useMemo } from 'react';
import { fetchAnalytics } from '../services/api';
import {
  BarChart3, TrendingUp, TrendingDown, Users, Phone, CalendarCheck,
  Percent, ArrowUpRight, ArrowDownRight, Minus, RefreshCw,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  RadialBarChart, RadialBar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

// ── Color Palette ──────────────────────────────────────────
const COLORS = {
  primary: '#6d28d9',
  blue: '#3b82f6',
  emerald: '#10b981',
  amber: '#f59e0b',
  red: '#ef4444',
  slate: '#94a3b8',
  violet: '#8b5cf6',
  rose: '#f43f5e',
  cyan: '#06b6d4',
  indigo: '#6366f1',
};

const SCORE_COLORS = { hot: '#ef4444', warm: '#f59e0b', cold: '#94a3b8' };
const SENTIMENT_COLORS = { positive: '#10b981', neutral: '#94a3b8', negative: '#ef4444', distressed: '#dc2626' };
const STATUS_COLORS = { new: '#3b82f6', contacted: '#8b5cf6', booked: '#f59e0b', converted: '#10b981', closed: '#94a3b8' };
const OUTCOME_COLORS = { confirmed: '#3b82f6', completed: '#10b981', cancelled: '#94a3b8', no_show: '#ef4444' };
const PIE_COLORS = [COLORS.primary, COLORS.blue, COLORS.emerald, COLORS.amber, COLORS.red, COLORS.violet, COLORS.rose, COLORS.cyan, COLORS.indigo, COLORS.slate];

// ── Custom Tooltip ─────────────────────────────────────────
function ChartTooltip({ active, payload, label, formatter }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg px-3 py-2 text-xs">
      <p className="font-medium text-slate-700 mb-1">{label}</p>
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-slate-500">{entry.name}:</span>
          <span className="font-semibold text-slate-800">
            {formatter ? formatter(entry.value, entry.name) : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Card Wrapper ───────────────────────────────────────────
function ChartCard({ title, subtitle, children, className = '', fullWidth }) {
  return (
    <div className={`bg-white rounded-xl border border-slate-100/80 shadow-sm p-5 ${fullWidth ? 'lg:col-span-2' : ''} ${className}`}>
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

// ── KPI Card ───────────────────────────────────────────────
function KPICard({ title, value, delta, icon: Icon, suffix = '' }) {
  const isPositive = delta > 0;
  const isNeutral = delta === 0;
  return (
    <div className="bg-white rounded-xl border border-slate-100/80 shadow-sm p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="w-9 h-9 rounded-lg bg-violet-50 flex items-center justify-center">
          <Icon size={18} className="text-violet-600" />
        </div>
        {!isNeutral && (
          <span className={`inline-flex items-center gap-0.5 text-xs font-medium px-2 py-0.5 rounded-full ${isPositive ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
            {isPositive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
            {Math.abs(delta)}%
          </span>
        )}
        {isNeutral && (
          <span className="inline-flex items-center gap-0.5 text-xs font-medium px-2 py-0.5 rounded-full bg-slate-50 text-slate-400">
            <Minus size={12} /> 0%
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-slate-900">{value}{suffix}</p>
      <p className="text-xs text-slate-400 mt-1">{title}</p>
    </div>
  );
}

// ── Empty State ────────────────────────────────────────────
function EmptyChart({ message = 'No data for this period' }) {
  return (
    <div className="flex items-center justify-center h-48 text-sm text-slate-400">
      {message}
    </div>
  );
}

// ── Funnel Chart ───────────────────────────────────────────
function FunnelChart({ data }) {
  const stages = ['new', 'contacted', 'booked', 'converted', 'closed'];
  const labels = { new: 'New', contacted: 'Contacted', booked: 'Booked', converted: 'Converted', closed: 'Closed' };
  const maxVal = Math.max(...stages.map(s => data[s] || 0), 1);

  return (
    <div className="space-y-3">
      {stages.map((stage, i) => {
        const val = data[stage] || 0;
        const pct = ((val / maxVal) * 100).toFixed(0);
        const dropoff = i > 0 && data[stages[i - 1]] > 0
          ? (((data[stages[i - 1]] - val) / data[stages[i - 1]]) * 100).toFixed(0)
          : null;
        return (
          <div key={stage}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-slate-600">{labels[stage]}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-800">{val}</span>
                {dropoff !== null && dropoff > 0 && (
                  <span className="text-[10px] text-red-400">-{dropoff}%</span>
                )}
              </div>
            </div>
            <div className="h-7 bg-slate-50 rounded-md overflow-hidden">
              <div
                className="h-full rounded-md transition-all duration-500"
                style={{ width: `${pct}%`, backgroundColor: STATUS_COLORS[stage] }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Donut with Legend ───────────────────────────────────────
function DonutChart({ data, nameKey, valueKey, colors = PIE_COLORS, height = 220 }) {
  const total = data.reduce((sum, d) => sum + d[valueKey], 0);
  if (total === 0) return <EmptyChart />;

  return (
    <div className="flex items-center gap-4">
      <div className="flex-1" style={{ minHeight: height }}>
        <ResponsiveContainer width="100%" height={height}>
          <PieChart>
            <Pie
              data={data}
              dataKey={valueKey}
              nameKey={nameKey}
              cx="50%"
              cy="50%"
              innerRadius="55%"
              outerRadius="80%"
              paddingAngle={2}
              stroke="none"
            >
              {data.map((_, i) => (
                <Cell key={i} fill={colors[i % colors.length]} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="space-y-1.5 min-w-[120px]">
        {data.slice(0, 8).map((d, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: colors[i % colors.length] }} />
            <span className="text-slate-500 truncate">{d[nameKey]}</span>
            <span className="font-semibold text-slate-700 ml-auto">{d[valueKey]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Format helpers ─────────────────────────────────────────
function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatDuration(seconds) {
  if (!seconds) return '0s';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function formatOutcome(key) {
  const map = {
    agent_hangup: 'Completed',
    user_hangup: 'Caller Hung Up',
    voicemail_reached: 'Voicemail',
    no_answer: 'No Answer',
    inactivity: 'Inactivity',
    dial_busy: 'Busy',
    dial_failed: 'Failed',
    dial_no_answer: 'No Answer (Dial)',
    unknown: 'Unknown',
  };
  return map[key] || key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// ── Main Component ─────────────────────────────────────────
export default function Analytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [period, setPeriod] = useState('30d');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const start = period === 'custom' ? customStart : undefined;
      const end = period === 'custom' ? customEnd : undefined;
      const result = await fetchAnalytics(period, start, end);
      setData(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (period === 'custom' && (!customStart || !customEnd)) return;
    loadData();
  }, [period, customStart, customEnd]);

  // Derived data for charts
  const callOutcomeData = useMemo(() => {
    if (!data?.call_outcomes) return [];
    return Object.entries(data.call_outcomes)
      .map(([key, value]) => ({ name: formatOutcome(key), value }))
      .filter(d => d.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [data]);

  const appointmentOutcomeData = useMemo(() => {
    if (!data?.appointment_outcomes) return [];
    return Object.entries(data.appointment_outcomes)
      .map(([key, value]) => ({ name: key.charAt(0).toUpperCase() + key.slice(1).replace('_', ' '), value }))
      .filter(d => d.value > 0);
  }, [data]);

  // Skeleton loader
  if (loading && !data) {
    return (
      <div className="max-w-[1400px] mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="h-8 w-32 bg-slate-200 rounded-lg animate-pulse" />
          <div className="h-9 w-64 bg-slate-200 rounded-lg animate-pulse" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-100/80 shadow-sm p-5 h-28 animate-pulse">
              <div className="h-4 w-16 bg-slate-200 rounded mb-3" />
              <div className="h-7 w-20 bg-slate-200 rounded" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className={`bg-white rounded-xl border border-slate-100/80 shadow-sm p-5 h-72 animate-pulse ${i === 0 ? 'lg:col-span-2' : ''}`}>
              <div className="h-4 w-32 bg-slate-200 rounded mb-4" />
              <div className="h-48 bg-slate-100 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <BarChart3 size={22} className="text-violet-600" />
            Analytics
          </h1>
          {data?.period && (
            <p className="text-xs text-slate-400 mt-1">
              {formatDate(data.period.start)} — {formatDate(data.period.end)} ({data.period.days} days)
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Period pills */}
          <div className="flex bg-slate-100 rounded-lg p-0.5">
            {['7d', '30d', '90d', 'custom'].map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                  period === p
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {p === 'custom' ? 'Custom' : p.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Custom date inputs */}
          {period === 'custom' && (
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="text-xs border border-slate-200 rounded-md px-2 py-1.5 text-slate-700"
              />
              <span className="text-xs text-slate-400">to</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="text-xs border border-slate-200 rounded-md px-2 py-1.5 text-slate-700"
              />
            </div>
          )}

          {/* Refresh */}
          <button
            onClick={loadData}
            disabled={loading}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-600 flex items-center justify-between">
          <span>Failed to load analytics: {error}</span>
          <button onClick={loadData} className="text-red-700 font-medium hover:underline text-xs">Retry</button>
        </div>
      )}

      {data && (
        <>
          {/* ── Section A: KPI Cards ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <KPICard
              title="Total Leads"
              value={data.kpis.total_leads.current}
              delta={data.kpis.total_leads.delta_pct}
              icon={Users}
            />
            <KPICard
              title="Calls Handled"
              value={data.kpis.total_calls.current}
              delta={data.kpis.total_calls.delta_pct}
              icon={Phone}
            />
            <KPICard
              title="Appointments Booked"
              value={data.kpis.appointments_booked.current}
              delta={data.kpis.appointments_booked.delta_pct}
              icon={CalendarCheck}
            />
            <KPICard
              title="Conversion Rate"
              value={data.kpis.conversion_rate.current}
              delta={data.kpis.conversion_rate.delta_pct}
              icon={Percent}
              suffix="%"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* ── A1: Lead Volume Over Time ── */}
            <ChartCard title="Lead Volume Over Time" subtitle="Daily new leads in selected period" fullWidth>
              {data.lead_volume.some(d => d.count > 0) ? (
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={data.lead_volume}>
                    <defs>
                      <linearGradient id="leadGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.15} />
                        <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={35} />
                    <Tooltip content={<ChartTooltip formatter={(v) => `${v} leads`} />} />
                    <Area type="monotone" dataKey="count" name="Leads" stroke={COLORS.primary} strokeWidth={2} fill="url(#leadGradient)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : <EmptyChart />}
            </ChartCard>

            {/* ── B1: Conversion Funnel ── */}
            <ChartCard title="Conversion Funnel" subtitle="Lead progression through pipeline stages">
              {Object.values(data.funnel).some(v => v > 0) ? (
                <FunnelChart data={data.funnel} />
              ) : <EmptyChart />}
            </ChartCard>

            {/* ── B2: Lead-to-Appointment Rate + G2: Appointment Outcomes ── */}
            <ChartCard title="Booking & Outcomes" subtitle="Appointment booking rate and outcome breakdown">
              <div className="flex flex-col items-center gap-4">
                {/* Radial gauge */}
                <div className="relative">
                  <ResponsiveContainer width={180} height={180}>
                    <RadialBarChart
                      cx="50%"
                      cy="50%"
                      innerRadius="70%"
                      outerRadius="90%"
                      startAngle={180}
                      endAngle={0}
                      data={[{ value: data.lead_to_appointment_rate, fill: COLORS.emerald }]}
                    >
                      <RadialBar background={{ fill: '#f1f5f9' }} dataKey="value" cornerRadius={8} />
                    </RadialBarChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center -mt-4">
                    <span className="text-2xl font-bold text-slate-900">{data.lead_to_appointment_rate}%</span>
                    <span className="text-[10px] text-slate-400">Booking Rate</span>
                  </div>
                </div>
                {/* Appointment outcomes donut */}
                {appointmentOutcomeData.length > 0 ? (
                  <DonutChart
                    data={appointmentOutcomeData}
                    nameKey="name"
                    valueKey="value"
                    colors={[OUTCOME_COLORS.confirmed, OUTCOME_COLORS.completed, OUTCOME_COLORS.cancelled, OUTCOME_COLORS.no_show]}
                    height={160}
                  />
                ) : <EmptyChart message="No appointments in this period" />}
              </div>
            </ChartCard>

            {/* ── C1: Call Duration ── */}
            <ChartCard title="Average Call Duration" subtitle="Mean call length per day">
              {data.call_duration_avg.length > 0 ? (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={data.call_duration_avg}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={(v) => `${Math.floor(v / 60)}m`} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={35} />
                    <Tooltip content={<ChartTooltip formatter={(v) => formatDuration(v)} />} />
                    <Bar dataKey="avg_seconds" name="Avg Duration" fill={COLORS.blue} radius={[4, 4, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <EmptyChart message="No calls in this period" />}
            </ChartCard>

            {/* ── C2: Call Outcomes ── */}
            <ChartCard title="Call Outcomes" subtitle="How calls ended">
              {callOutcomeData.length > 0 ? (
                <DonutChart
                  data={callOutcomeData}
                  nameKey="name"
                  valueKey="value"
                  colors={[COLORS.emerald, COLORS.amber, COLORS.violet, COLORS.slate, COLORS.red, COLORS.blue, COLORS.rose]}
                />
              ) : <EmptyChart message="No calls in this period" />}
            </ChartCard>

            {/* ── C3: Call Sentiment Over Time ── */}
            <ChartCard title="Call Sentiment Over Time" subtitle="Weekly caller sentiment from AI analysis" fullWidth>
              {data.call_sentiment.length > 0 ? (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={data.call_sentiment}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="week" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={35} />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px' }} />
                    <Bar dataKey="positive" name="Positive" stackId="a" fill={SENTIMENT_COLORS.positive} radius={[0, 0, 0, 0]} />
                    <Bar dataKey="neutral" name="Neutral" stackId="a" fill={SENTIMENT_COLORS.neutral} />
                    <Bar dataKey="negative" name="Negative" stackId="a" fill={SENTIMENT_COLORS.negative} />
                    <Bar dataKey="distressed" name="Distressed" stackId="a" fill={SENTIMENT_COLORS.distressed} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <EmptyChart message="No sentiment data available" />}
            </ChartCard>

            {/* ── D1: Staff Appointment Load ── */}
            <ChartCard title="Staff Appointment Load" subtitle="Appointments assigned per staff member">
              {data.staff_appointments.length > 0 ? (
                <ResponsiveContainer width="100%" height={Math.max(160, data.staff_appointments.length * 44)}>
                  <BarChart data={data.staff_appointments} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="staff_name" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} width={100} />
                    <Tooltip content={<ChartTooltip formatter={(v) => `${v} appointments`} />} />
                    <Bar dataKey="count" name="Appointments" fill={COLORS.violet} radius={[0, 4, 4, 0]} maxBarSize={28} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <EmptyChart message="No staff appointment data" />}
            </ChartCard>

            {/* ── D2: Staff Lead Assignments ── */}
            <ChartCard title="Staff Lead Assignments" subtitle="Leads assigned per staff, by status">
              {data.staff_leads.length > 0 ? (
                <ResponsiveContainer width="100%" height={Math.max(160, data.staff_leads.length * 44)}>
                  <BarChart data={data.staff_leads} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="staff_name" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} width={100} />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px' }} />
                    <Bar dataKey="new" name="New" stackId="a" fill={STATUS_COLORS.new} />
                    <Bar dataKey="contacted" name="Contacted" stackId="a" fill={STATUS_COLORS.contacted} />
                    <Bar dataKey="booked" name="Booked" stackId="a" fill={STATUS_COLORS.booked} />
                    <Bar dataKey="converted" name="Converted" stackId="a" fill={STATUS_COLORS.converted} />
                    <Bar dataKey="closed" name="Closed" stackId="a" fill={STATUS_COLORS.closed} radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <EmptyChart message="No staff lead data" />}
            </ChartCard>

            {/* ── E1: Case Type Distribution ── */}
            <ChartCard title="Case Type Distribution" subtitle="What types of inquiries are coming in">
              {data.case_type_distribution.length > 0 ? (
                <DonutChart data={data.case_type_distribution} nameKey="case_type" valueKey="count" />
              ) : <EmptyChart />}
            </ChartCard>

            {/* ── E2: Lead Source Breakdown ── */}
            <ChartCard title="Lead Source Breakdown" subtitle="Which channels are driving leads">
              {data.lead_source_distribution.length > 0 ? (
                <DonutChart data={data.lead_source_distribution} nameKey="source" valueKey="count" />
              ) : <EmptyChart />}
            </ChartCard>

            {/* ── F1: Avg Time to First Contact ── */}
            <ChartCard title="Avg Time to First Contact" subtitle="Hours from lead creation to first outbound message" fullWidth>
              {data.avg_time_to_first_contact.length > 0 ? (
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={data.avg_time_to_first_contact}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={(v) => `${v}h`} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={35} />
                    <Tooltip content={<ChartTooltip formatter={(v) => `${v} hours`} />} />
                    <Line type="monotone" dataKey="avg_hours" name="Avg Hours" stroke={COLORS.amber} strokeWidth={2} dot={{ r: 3, fill: COLORS.amber }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : <EmptyChart message="No outbound messages to measure response time" />}
            </ChartCard>

            {/* ── F2: Message Volume ── */}
            <ChartCard title="Message Volume" subtitle="Inbound vs outbound messages over time">
              {data.message_volume.length > 0 ? (
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={data.message_volume}>
                    <defs>
                      <linearGradient id="inboundGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={COLORS.blue} stopOpacity={0.15} />
                        <stop offset="95%" stopColor={COLORS.blue} stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="outboundGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={COLORS.emerald} stopOpacity={0.15} />
                        <stop offset="95%" stopColor={COLORS.emerald} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={35} />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px' }} />
                    <Area type="monotone" dataKey="inbound" name="Inbound" stroke={COLORS.blue} strokeWidth={2} fill="url(#inboundGrad)" />
                    <Area type="monotone" dataKey="outbound" name="Outbound" stroke={COLORS.emerald} strokeWidth={2} fill="url(#outboundGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : <EmptyChart message="No messages in this period" />}
            </ChartCard>

            {/* ── G1: Lead Quality Trend ── */}
            <ChartCard title="Lead Quality Trend" subtitle="Hot, warm, and cold leads over time">
              {data.lead_quality_trend.some(d => d.hot + d.warm + d.cold > 0) ? (
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={data.lead_quality_trend}>
                    <defs>
                      <linearGradient id="hotGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={SCORE_COLORS.hot} stopOpacity={0.2} />
                        <stop offset="95%" stopColor={SCORE_COLORS.hot} stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="warmGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={SCORE_COLORS.warm} stopOpacity={0.2} />
                        <stop offset="95%" stopColor={SCORE_COLORS.warm} stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="coldGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={SCORE_COLORS.cold} stopOpacity={0.2} />
                        <stop offset="95%" stopColor={SCORE_COLORS.cold} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={35} />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px' }} />
                    <Area type="monotone" dataKey="hot" name="Hot" stroke={SCORE_COLORS.hot} strokeWidth={2} fill="url(#hotGrad)" stackId="1" />
                    <Area type="monotone" dataKey="warm" name="Warm" stroke={SCORE_COLORS.warm} strokeWidth={2} fill="url(#warmGrad)" stackId="1" />
                    <Area type="monotone" dataKey="cold" name="Cold" stroke={SCORE_COLORS.cold} strokeWidth={2} fill="url(#coldGrad)" stackId="1" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : <EmptyChart />}
            </ChartCard>

            {/* ── G3: Appointment Show Rate Trend ── */}
            <ChartCard title="Appointment Show Rate" subtitle="Weekly percentage of appointments completed vs total" fullWidth>
              {data.appointment_show_rate_trend.length > 0 ? (
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={data.appointment_show_rate_trend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="week" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={40} />
                    <Tooltip content={<ChartTooltip formatter={(v) => `${v}%`} />} />
                    <Line type="monotone" dataKey="rate" name="Show Rate" stroke={COLORS.emerald} strokeWidth={2.5} dot={{ r: 4, fill: COLORS.emerald, stroke: '#fff', strokeWidth: 2 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : <EmptyChart message="No appointment data to calculate show rate" />}
            </ChartCard>

          </div>
        </>
      )}
    </div>
  );
}
