import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { fetchFirms, fetchLogs } from '../../services/api';
import {
  Building2, Users, Phone, AlertTriangle, ChevronRight, Activity,
  TrendingUp, Zap, Shield, ArrowUpRight, Globe, Server,
  PhoneCall, DollarSign, Crown, Sparkles, Eye, Pencil,
  Pause, Play, Clock, CheckCircle2, XCircle, AlertCircle,
} from 'lucide-react';

/* ── Inject admin-specific styles once ── */
const STYLE_ID = '__admin-command-center-styles';
if (typeof document !== 'undefined' && !document.getElementById(STYLE_ID)) {
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    @keyframes adminGradientShift {
      0%   { background-position: 0% 50%; }
      50%  { background-position: 100% 50%; }
      100% { background-position: 0% 50%; }
    }
    @keyframes adminFadeInUp {
      from { opacity: 0; transform: translateY(10px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes adminPulse {
      0%   { transform: scale(1); opacity: 1; }
      100% { transform: scale(2.4); opacity: 0; }
    }
    @keyframes adminSkeletonShimmer {
      0%   { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }
    @keyframes adminNumberCount {
      0%   { transform: scale(0.7); opacity: 0; }
      60%  { transform: scale(1.08); }
      100% { transform: scale(1); opacity: 1; }
    }
    @keyframes adminGlow {
      0%, 100% { opacity: 0.3; }
      50%      { opacity: 0.6; }
    }
    .admin-gradient-animate {
      background-size: 200% 200%;
      animation: adminGradientShift 12s ease infinite;
    }
    .admin-fade-in {
      animation: adminFadeInUp 0.5s ease forwards;
      opacity: 0;
    }
    .admin-pulse-ring {
      animation: adminPulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
    }
    .admin-skeleton {
      background: linear-gradient(90deg, #1e1b4b 25%, #312e81 50%, #1e1b4b 75%);
      background-size: 200% 100%;
      animation: adminSkeletonShimmer 1.5s ease-in-out infinite;
    }
    .admin-number-pop {
      animation: adminNumberCount 0.5s ease forwards;
    }
    .admin-glow {
      animation: adminGlow 3s ease-in-out infinite;
    }
    .admin-card-lift {
      transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
    }
    .admin-card-lift:hover {
      transform: translateY(-2px);
      box-shadow: 0 12px 30px -8px rgba(49,46,129,0.15), 0 4px 12px -4px rgba(0,0,0,0.08);
    }
  `;
  document.head.appendChild(style);
}

function formatRelativeTime(dateStr) {
  if (!dateStr) return '';
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now - date;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay === 1) return 'Yesterday';
  return `${diffDay}d ago`;
}

const PLAN_PRICES = { free: 0, starter: 49, pro: 149, enterprise: 499 };

const INDUSTRY_COLORS = {
  legal: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20', dot: 'bg-blue-400' },
  dental: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20', dot: 'bg-emerald-400' },
  plumbing: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20', dot: 'bg-amber-400' },
  real_estate: { bg: 'bg-violet-500/10', text: 'text-violet-400', border: 'border-violet-500/20', dot: 'bg-violet-400' },
  medical: { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/20', dot: 'bg-rose-400' },
  other: { bg: 'bg-slate-500/10', text: 'text-slate-400', border: 'border-slate-500/20', dot: 'bg-slate-400' },
};

const PLAN_COLORS = {
  free: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  starter: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  pro: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
  enterprise: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
};

/* ── Skeleton Loading ── */
function AdminSkeleton() {
  return (
    <div className="space-y-6">
      <div className="admin-skeleton rounded-2xl h-56" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <div className="admin-skeleton rounded-2xl h-80" />
        </div>
        <div className="space-y-5">
          <div className="admin-skeleton rounded-2xl h-40" />
          <div className="admin-skeleton rounded-2xl h-52" />
        </div>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const [firms, setFirms] = useState([]);
  const [errorCounts, setErrorCounts] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [firmsData, logsData] = await Promise.all([
          fetchFirms(),
          fetchLogs({ level: 'error', limit: 1 }).catch(() => ({ error_counts: {} })),
        ]);
        setFirms(firmsData);
        setErrorCounts(logsData.error_counts || {});
      } catch (err) {
        // error handled by UI state
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return <AdminSkeleton />;
  }

  const totalLeads = firms.reduce((sum, f) => sum + (f._counts?.leads || 0), 0);
  const totalAppointments = firms.reduce((sum, f) => sum + (f._counts?.appointments || 0), 0);
  const activeClients = firms.filter(f => f.status === 'active').length;
  const totalErrors = Object.values(errorCounts).reduce((sum, c) => sum + c, 0);
  const totalStaff = firms.reduce((sum, f) => sum + (f._counts?.staff || 0), 0);

  // Revenue calculation
  const planCounts = { free: 0, starter: 0, pro: 0, enterprise: 0 };
  firms.forEach(f => {
    const plan = f.plan || 'free';
    if (planCounts[plan] !== undefined) planCounts[plan]++;
    else planCounts.free++;
  });
  const estimatedMRR = Object.entries(planCounts).reduce((sum, [plan, count]) => sum + (PLAN_PRICES[plan] || 0) * count, 0);

  // Activity feed: recent firms sorted by created_at
  const recentActivity = [...firms]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 8);

  // Error categories for monitor
  const errorCategories = [
    { key: 'retell_webhook', label: 'Retell' },
    { key: 'sms', label: 'SMS' },
    { key: 'crm_push', label: 'CRM' },
    { key: 'calendar', label: 'Calendar' },
    { key: 'auth', label: 'Auth' },
    { key: 'system', label: 'System' },
  ];

  return (
    <div className="max-w-[1400px] mx-auto space-y-6">

      {/* ═══════════════════════════════════════════════
          COMMAND CENTER HERO
          ═══════════════════════════════════════════════ */}
      <div
        className="relative overflow-hidden rounded-2xl admin-gradient-animate"
        style={{
          background: 'linear-gradient(135deg, #1e1b4b 0%, #0f172a 30%, #312e81 60%, #0f172a 100%)',
        }}
      >
        {/* Background effects */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)',
          backgroundSize: '20px 20px',
        }} />
        <div className="absolute top-0 right-0 w-96 h-96 rounded-full blur-[120px] opacity-20 bg-indigo-500 admin-glow" />
        <div className="absolute bottom-0 left-0 w-72 h-72 rounded-full blur-[100px] opacity-10 bg-violet-600" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-[200px] opacity-[0.05] bg-white" />

        <div className="relative z-10 p-7 sm:p-8">
          {/* Top bar */}
          <div className="flex items-start justify-between mb-7">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-9 h-9 bg-indigo-500/20 backdrop-blur-xl rounded-xl flex items-center justify-center border border-indigo-400/10">
                  <Shield size={16} className="text-indigo-300" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white tracking-tight">Command Center</h2>
                  <p className="text-[11px] text-indigo-300/50 uppercase tracking-widest font-medium">VoibixAI Platform</p>
                </div>
              </div>
            </div>

            {/* Platform health */}
            <div className="flex items-center gap-2.5 bg-white/[0.06] backdrop-blur-xl border border-white/[0.06] rounded-xl px-4 py-2.5">
              <div className="relative">
                <div className={`w-2 h-2 rounded-full ${totalErrors === 0 ? 'bg-emerald-400' : totalErrors < 5 ? 'bg-amber-400' : 'bg-red-400'}`} />
                {totalErrors === 0 && <div className="absolute inset-0 w-2 h-2 bg-emerald-400 rounded-full admin-pulse-ring" />}
              </div>
              <span className="text-[11px] font-medium text-white/60">
                {totalErrors === 0 ? 'All systems operational' : `${totalErrors} error${totalErrors !== 1 ? 's' : ''} detected`}
              </span>
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <HeroStat
              icon={Building2}
              label="Active Clients"
              value={activeClients}
              suffix={`/ ${firms.length}`}
              trend={firms.length > 0 ? `${Math.round((activeClients / firms.length) * 100)}% active` : null}
              color="indigo"
            />
            <HeroStat
              icon={Users}
              label="Total Leads"
              value={totalLeads}
              trend={`${totalStaff} staff across all`}
              color="blue"
            />
            <HeroStat
              icon={PhoneCall}
              label="Appointments"
              value={totalAppointments}
              trend="All clients combined"
              color="violet"
            />
            <HeroStat
              icon={DollarSign}
              label="Est. MRR"
              value={`$${estimatedMRR.toLocaleString()}`}
              trend={`${firms.length} client${firms.length !== 1 ? 's' : ''} total`}
              color="emerald"
            />
            <Link to="/admin/logs?level=error" className="block">
              <HeroStat
                icon={AlertTriangle}
                label="Errors (24h)"
                value={totalErrors}
                trend={totalErrors === 0 ? 'No issues' : 'Click to view'}
                color={totalErrors > 0 ? 'red' : 'slate'}
                clickable
              />
            </Link>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════
          MAIN CONTENT
          ═══════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

        {/* ── Left: Client Cards + Activity ── */}
        <div className="lg:col-span-8 space-y-5">

          {/* Client Overview Cards */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-gradient-to-br from-indigo-50 to-violet-50 rounded-xl flex items-center justify-center">
                  <Globe size={16} className="text-indigo-500" />
                </div>
                <div>
                  <h3 className="text-[15px] font-semibold text-slate-900">Client Overview</h3>
                  <p className="text-xs text-slate-400">{firms.length} client{firms.length !== 1 ? 's' : ''} on the platform</p>
                </div>
              </div>
              <Link
                to="/admin/clients/new"
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white text-xs font-semibold rounded-xl hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-200"
              >
                <Sparkles size={13} />
                Deploy Client
              </Link>
            </div>

            {firms.length === 0 ? (
              <div className="py-20 text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-indigo-50 to-violet-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Building2 size={24} className="text-indigo-400" />
                </div>
                <p className="text-sm font-semibold text-slate-700">No clients deployed</p>
                <p className="text-xs text-slate-400 mt-1.5 max-w-xs mx-auto">Deploy your first client to start managing AI voice agents.</p>
                <Link to="/admin/clients/new" className="inline-flex items-center gap-1.5 mt-4 text-sm font-medium text-indigo-600 hover:text-indigo-700">
                  <Sparkles size={14} /> Deploy first client
                </Link>
              </div>
            ) : (
              <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                {firms.map((firm, idx) => (
                  <ClientCard key={firm.id} firm={firm} delay={idx * 50} />
                ))}
              </div>
            )}

            {firms.length > 0 && (
              <div className="px-6 py-3 border-t border-slate-50">
                <Link to="/admin/clients" className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-500 hover:text-indigo-700 transition-colors">
                  View all clients <ArrowUpRight size={12} />
                </Link>
              </div>
            )}
          </div>

          {/* Platform Activity Feed */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl flex items-center justify-center">
                  <Activity size={16} className="text-slate-600" />
                </div>
                <div>
                  <h3 className="text-[15px] font-semibold text-slate-900">Platform Activity</h3>
                  <p className="text-xs text-slate-400">Latest across all clients</p>
                </div>
              </div>
              <Link to="/admin/logs" className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-slate-600 transition-colors">
                View logs <ArrowUpRight size={12} />
              </Link>
            </div>

            {recentActivity.length === 0 ? (
              <div className="py-16 text-center">
                <p className="text-sm text-slate-400">No activity yet</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {recentActivity.map((firm, idx) => {
                  const ic = INDUSTRY_COLORS[firm.industry] || INDUSTRY_COLORS.other;
                  return (
                    <Link
                      key={firm.id}
                      to={`/admin/clients/${firm.id}`}
                      className="flex items-center gap-4 px-6 py-3.5 hover:bg-slate-50/60 transition-all group admin-fade-in"
                      style={{ animationDelay: `${idx * 40}ms` }}
                    >
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold text-white flex-shrink-0 shadow-sm"
                        style={{ backgroundColor: firm.brand_color || '#6d28d9' }}
                      >
                        {firm.name?.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-slate-800 group-hover:text-indigo-600 transition-colors truncate">{firm.name}</p>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold border ${ic.bg} ${ic.text} ${ic.border} capitalize`}>
                            {firm.industry}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {firm._counts?.leads || 0} leads
                          <span className="mx-1.5 text-slate-200">&middot;</span>
                          {firm._counts?.staff || 0} staff
                          <span className="mx-1.5 text-slate-200">&middot;</span>
                          {firm.retell_phone_number || 'No phone'}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className="text-[10px] text-slate-300 font-medium">{formatRelativeTime(firm.created_at)}</span>
                        <ChevronRight size={14} className="text-slate-200 group-hover:text-indigo-400 transition-colors" />
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Right Sidebar ── */}
        <div className="lg:col-span-4 space-y-5">

          {/* Revenue Overview */}
          <div className="bg-gradient-to-br from-indigo-950 to-slate-900 rounded-2xl p-6 shadow-lg border border-indigo-900/30">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 bg-indigo-500/20 rounded-xl flex items-center justify-center">
                <Crown size={16} className="text-indigo-300" />
              </div>
              <div>
                <h3 className="text-[15px] font-semibold text-white">Revenue</h3>
                <p className="text-[10px] text-indigo-300/50 uppercase tracking-widest font-medium">Monthly Recurring</p>
              </div>
            </div>

            <p className="text-3xl font-bold text-white mb-5 admin-number-pop tracking-tight">
              ${estimatedMRR.toLocaleString()}
              <span className="text-sm text-indigo-300/40 font-normal ml-1">/mo</span>
            </p>

            <div className="space-y-2.5">
              {[
                { plan: 'Enterprise', count: planCounts.enterprise, price: PLAN_PRICES.enterprise, color: 'bg-amber-400' },
                { plan: 'Pro', count: planCounts.pro, price: PLAN_PRICES.pro, color: 'bg-violet-400' },
                { plan: 'Starter', count: planCounts.starter, price: PLAN_PRICES.starter, color: 'bg-blue-400' },
                { plan: 'Free', count: planCounts.free, price: PLAN_PRICES.free, color: 'bg-slate-500' },
              ].map(tier => (
                <div key={tier.plan} className="flex items-center gap-3">
                  <div className={`w-2.5 h-2.5 rounded-[3px] flex-shrink-0 ${tier.color}`} />
                  <span className="text-[13px] text-indigo-200/70 flex-1">{tier.plan}</span>
                  <span className="text-[13px] font-bold text-white tabular-nums">{tier.count}</span>
                  <span className="text-[11px] text-indigo-300/30 w-16 text-right tabular-nums">
                    ${(tier.count * tier.price).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>

            {/* Plan distribution bar */}
            {firms.length > 0 && (
              <div className="flex h-2 rounded-full overflow-hidden bg-indigo-900/50 mt-5">
                {planCounts.enterprise > 0 && <div className="bg-amber-400" style={{ width: `${(planCounts.enterprise / firms.length) * 100}%` }} />}
                {planCounts.pro > 0 && <div className="bg-violet-400" style={{ width: `${(planCounts.pro / firms.length) * 100}%` }} />}
                {planCounts.starter > 0 && <div className="bg-blue-400" style={{ width: `${(planCounts.starter / firms.length) * 100}%` }} />}
                {planCounts.free > 0 && <div className="bg-slate-500" style={{ width: `${(planCounts.free / firms.length) * 100}%` }} />}
              </div>
            )}
          </div>

          {/* Error Monitor */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                totalErrors === 0 ? 'bg-emerald-50' : totalErrors < 5 ? 'bg-amber-50' : 'bg-red-50'
              }`}>
                <Server size={16} className={
                  totalErrors === 0 ? 'text-emerald-500' : totalErrors < 5 ? 'text-amber-500' : 'text-red-500'
                } />
              </div>
              <div>
                <h3 className="text-[15px] font-semibold text-slate-900">Error Monitor</h3>
                <p className="text-xs text-slate-400">Last 24 hours</p>
              </div>
            </div>

            {totalErrors === 0 ? (
              <div className="flex items-center gap-3 py-4 px-4 bg-emerald-50/50 rounded-xl border border-emerald-100/50">
                <CheckCircle2 size={18} className="text-emerald-500 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-emerald-800">All clear</p>
                  <p className="text-[11px] text-emerald-600/60">No errors in the last 24 hours</p>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {errorCategories.map(cat => {
                  const count = errorCounts[cat.key] || 0;
                  return (
                    <Link
                      key={cat.key}
                      to={`/admin/logs?level=error&category=${cat.key}`}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 transition-colors group"
                    >
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        count === 0 ? 'bg-emerald-400' : count < 3 ? 'bg-amber-400' : 'bg-red-400'
                      }`} />
                      <span className="text-[13px] text-slate-600 flex-1 group-hover:text-slate-900 transition-colors">{cat.label}</span>
                      <span className={`text-[13px] font-bold tabular-nums ${
                        count === 0 ? 'text-slate-300' : count < 3 ? 'text-amber-600' : 'text-red-600'
                      }`}>{count}</span>
                    </Link>
                  );
                })}
              </div>
            )}

            {totalErrors > 0 && (
              <Link
                to="/admin/logs?level=error"
                className="mt-4 flex items-center justify-center gap-1.5 text-xs font-semibold text-red-600 hover:text-red-700 transition-colors bg-red-50 rounded-xl px-4 py-2.5"
              >
                View all errors <ArrowUpRight size={12} />
              </Link>
            )}
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <h3 className="text-[15px] font-semibold text-slate-900 mb-4">Quick Actions</h3>
            <div className="space-y-2">
              <Link to="/admin/clients/new" className="flex items-center gap-3 px-4 py-3 rounded-xl bg-indigo-50/50 border border-indigo-100/50 hover:bg-indigo-50 transition-all group admin-card-lift">
                <Sparkles size={15} className="text-indigo-500" />
                <span className="text-sm font-medium text-indigo-700">Deploy New Client</span>
                <ChevronRight size={14} className="text-indigo-300 ml-auto group-hover:text-indigo-500 transition-colors" />
              </Link>
              <Link to="/admin/templates" className="flex items-center gap-3 px-4 py-3 rounded-xl bg-violet-50/50 border border-violet-100/50 hover:bg-violet-50 transition-all group admin-card-lift">
                <Zap size={15} className="text-violet-500" />
                <span className="text-sm font-medium text-violet-700">Prompt Templates</span>
                <ChevronRight size={14} className="text-violet-300 ml-auto group-hover:text-violet-500 transition-colors" />
              </Link>
              <Link to="/admin/logs" className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-50/50 border border-slate-100/50 hover:bg-slate-100/50 transition-all group admin-card-lift">
                <Activity size={15} className="text-slate-500" />
                <span className="text-sm font-medium text-slate-700">System Logs</span>
                <ChevronRight size={14} className="text-slate-300 ml-auto group-hover:text-slate-500 transition-colors" />
              </Link>
              <Link to="/admin/clients" className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-50/50 border border-slate-100/50 hover:bg-slate-100/50 transition-all group admin-card-lift">
                <Building2 size={15} className="text-slate-500" />
                <span className="text-sm font-medium text-slate-700">All Clients</span>
                <ChevronRight size={14} className="text-slate-300 ml-auto group-hover:text-slate-500 transition-colors" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Client Card ── */
function ClientCard({ firm, delay }) {
  const ic = INDUSTRY_COLORS[firm.industry] || INDUSTRY_COLORS.other;
  const planColor = PLAN_COLORS[firm.plan || 'free'] || PLAN_COLORS.free;
  const isActive = firm.status === 'active';
  const hasAgent = !!firm.retell_agent_id;

  return (
    <div
      className="relative rounded-xl border border-slate-100 p-4 hover:border-indigo-200/60 admin-card-lift admin-fade-in group"
      style={{
        animationDelay: `${delay}ms`,
        borderLeftWidth: '3px',
        borderLeftColor: firm.brand_color || '#6d28d9',
      }}
    >
      <div className="flex items-start gap-3.5">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold text-white flex-shrink-0 shadow-sm"
          style={{ backgroundColor: firm.brand_color || '#6d28d9' }}
        >
          {firm.name?.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="text-sm font-semibold text-slate-900 truncate group-hover:text-indigo-600 transition-colors">{firm.name}</p>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border ${ic.bg} ${ic.text} ${ic.border} capitalize`}>
              {firm.industry}
            </span>
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border ${planColor} capitalize`}>
              {firm.plan || 'free'}
            </span>
            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold ${
              isActive ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-amber-50 text-amber-600 border border-amber-100'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              {firm.status}
            </span>
          </div>
        </div>
      </div>

      {/* Mini stats */}
      <div className="flex items-center gap-4 mt-3.5 pt-3 border-t border-slate-50">
        <div className="flex items-center gap-1.5">
          <Users size={12} className="text-slate-300" />
          <span className="text-xs font-semibold text-slate-700">{firm._counts?.leads || 0}</span>
          <span className="text-[10px] text-slate-400">leads</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Phone size={12} className="text-slate-300" />
          <span className="text-xs font-semibold text-slate-700">{firm._counts?.staff || 0}</span>
          <span className="text-[10px] text-slate-400">staff</span>
        </div>
        <div className="flex items-center gap-1.5 ml-auto">
          <div className={`w-1.5 h-1.5 rounded-full ${hasAgent ? 'bg-emerald-400' : 'bg-slate-300'}`} />
          <span className="text-[10px] text-slate-400">{hasAgent ? 'Agent live' : 'No agent'}</span>
        </div>
      </div>

      {/* Quick actions on hover */}
      <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Link
          to={`/admin/clients/${firm.id}`}
          className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center hover:bg-indigo-100 transition-colors"
          title="View"
        >
          <Eye size={13} className="text-indigo-500" />
        </Link>
        <Link
          to={`/admin/clients/${firm.id}`}
          className="w-7 h-7 rounded-lg bg-slate-50 flex items-center justify-center hover:bg-slate-100 transition-colors"
          title="Edit"
        >
          <Pencil size={12} className="text-slate-500" />
        </Link>
      </div>
    </div>
  );
}

/* ── Hero Stat Card ── */
function HeroStat({ icon: Icon, label, value, suffix, trend, color, clickable }) {
  const colorMap = {
    indigo: 'bg-indigo-500/15 text-indigo-300',
    blue: 'bg-blue-500/15 text-blue-300',
    violet: 'bg-violet-500/15 text-violet-300',
    emerald: 'bg-emerald-500/15 text-emerald-300',
    red: 'bg-red-500/15 text-red-300',
    slate: 'bg-slate-500/15 text-slate-400',
  };

  return (
    <div className={`relative overflow-hidden rounded-xl px-4 py-4 backdrop-blur-xl border border-white/[0.06] bg-white/[0.04] hover:bg-white/[0.08] transition-all ${clickable ? 'cursor-pointer' : ''}`}>
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${colorMap[color]}`}>
          <Icon size={13} />
        </div>
        <span className="text-[10px] text-white/35 uppercase tracking-widest font-medium">{label}</span>
      </div>
      <p className="text-2xl font-bold text-white admin-number-pop tracking-tight">
        {value}
        {suffix && <span className="text-sm text-white/25 font-normal ml-1">{suffix}</span>}
      </p>
      {trend && (
        <p className="text-[10px] text-white/25 mt-1.5 font-medium">{trend}</p>
      )}
    </div>
  );
}
