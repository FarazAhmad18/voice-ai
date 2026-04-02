import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { fetchFirms, fetchLogs } from '../../services/api';
import {
  Building2, Users, AlertTriangle, ChevronRight, Activity,
  TrendingUp, Zap, Shield, ArrowUpRight, Globe, Server,
  PhoneCall, DollarSign, Crown, Sparkles, CheckCircle2,
} from 'lucide-react';


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

const PLAN_PRICES = { growth: 899, scale: 1499, enterprise: 0 }; // enterprise = custom pricing

const INDUSTRY_COLORS = {
  legal: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20', dot: 'bg-blue-400' },
  dental: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20', dot: 'bg-emerald-400' },
  plumbing: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20', dot: 'bg-amber-400' },
  real_estate: { bg: 'bg-violet-500/10', text: 'text-violet-400', border: 'border-violet-500/20', dot: 'bg-violet-400' },
  medical: { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/20', dot: 'bg-rose-400' },
  other: { bg: 'bg-slate-500/10', text: 'text-slate-400 dark:text-zinc-500', border: 'border-slate-500/20', dot: 'bg-slate-400' },
};

/* ── Skeleton Loading ── */
function AdminSkeleton() {
  return (
    <div className="space-y-6">
      <div className="skeleton-shimmer rounded-lg h-56" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <div className="skeleton-shimmer rounded-lg h-80" />
        </div>
        <div className="space-y-5">
          <div className="skeleton-shimmer rounded-lg h-40" />
          <div className="skeleton-shimmer rounded-lg h-52" />
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
  const planCounts = { growth: 0, scale: 0, enterprise: 0 };
  firms.forEach(f => {
    const plan = f.plan || 'growth';
    if (planCounts[plan] !== undefined) planCounts[plan]++;
    else planCounts.growth++;
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
        className="relative overflow-hidden rounded-lg"
        style={{ backgroundColor: '#0f172a' }}
      >
        <div className="relative z-10 p-7 sm:p-8">
          {/* Top bar */}
          <div className="flex items-start justify-between mb-7">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-9 h-9 bg-indigo-500/20 rounded-lg flex items-center justify-center border border-indigo-400/10">
                  <Shield size={16} className="text-indigo-300" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white tracking-tight">Command Center</h2>
                  <p className="text-[11px] text-indigo-300/50 uppercase tracking-widest font-medium">VoibixAI Platform</p>
                </div>
              </div>
            </div>

            {/* Platform health */}
            <div className="flex items-center gap-2.5 bg-white/10 border border-white/[0.06] rounded-lg px-4 py-2.5">
              <div className="relative">
                <div className={`w-2 h-2 rounded-full ${totalErrors === 0 ? 'bg-emerald-400' : totalErrors < 5 ? 'bg-amber-400' : 'bg-red-400'}`} />
                {totalErrors === 0 && <div className="absolute inset-0 w-2 h-2 bg-emerald-400 rounded-full" />}
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

        {/* ── Left: Ranked Clients + Activity ── */}
        <div className="lg:col-span-8 space-y-5">

          {/* Top Clients by Activity */}
          <div className="bg-white dark:bg-zinc-900 rounded-lg border border-slate-100 dark:border-zinc-800 shadow-sm">
            <div className="px-6 py-5 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-indigo-50 rounded-lg flex items-center justify-center">
                  <TrendingUp size={16} className="text-indigo-500" />
                </div>
                <div>
                  <h3 className="text-[15px] font-semibold text-slate-900 dark:text-zinc-100">Top Clients by Activity</h3>
                  <p className="text-xs text-slate-400 dark:text-zinc-500">Ranked by total leads generated</p>
                </div>
              </div>
              <Link
                to="/admin/clients/new"
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
              >
                <Sparkles size={13} />
                Deploy Client
              </Link>
            </div>

            {firms.length === 0 ? (
              <div className="py-20 text-center">
                <div className="w-16 h-16 bg-indigo-50 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <Building2 size={24} className="text-indigo-400" />
                </div>
                <p className="text-sm font-semibold text-slate-700 dark:text-zinc-300">No clients deployed</p>
                <p className="text-xs text-slate-400 dark:text-zinc-500 mt-1.5 max-w-xs mx-auto">Deploy your first client to start managing AI voice agents.</p>
                <Link to="/admin/clients/new" className="inline-flex items-center gap-1.5 mt-4 text-sm font-medium text-indigo-600 hover:text-indigo-700">
                  <Sparkles size={14} /> Deploy first client
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-slate-50 dark:divide-zinc-800/50">
                {/* Table header */}
                <div className="px-6 py-2.5 grid grid-cols-12 gap-3">
                  <div className="col-span-1 text-[10px] font-semibold text-slate-300 dark:text-zinc-600 uppercase tracking-wider">#</div>
                  <div className="col-span-5 text-[10px] font-semibold text-slate-300 dark:text-zinc-600 uppercase tracking-wider">Client</div>
                  <div className="col-span-2 text-[10px] font-semibold text-slate-300 dark:text-zinc-600 uppercase tracking-wider text-center">Leads</div>
                  <div className="col-span-2 text-[10px] font-semibold text-slate-300 dark:text-zinc-600 uppercase tracking-wider text-center">Appts</div>
                  <div className="col-span-2 text-[10px] font-semibold text-slate-300 dark:text-zinc-600 uppercase tracking-wider text-right">Status</div>
                </div>
                {[...firms]
                  .sort((a, b) => (b._counts?.leads || 0) - (a._counts?.leads || 0))
                  .slice(0, 8)
                  .map((firm, idx) => {
                    const ic = INDUSTRY_COLORS[firm.industry] || INDUSTRY_COLORS.other;
                    const isActive = firm.status === 'active';
                    const hasAgent = !!firm.retell_agent_id;
                    const maxLeads = firms.reduce((m, f) => Math.max(m, f._counts?.leads || 0), 1);
                    const barWidth = Math.max(4, Math.round(((firm._counts?.leads || 0) / maxLeads) * 100));
                    return (
                      <Link
                        key={firm.id}
                        to={`/admin/clients/${firm.id}`}
                        className="px-6 py-3.5 grid grid-cols-12 gap-3 items-center hover:bg-slate-50 dark:hover:bg-zinc-800/30 transition-all group"
                      >
                        <div className="col-span-1">
                          <span className={`text-sm font-bold ${idx === 0 ? 'text-amber-500' : idx === 1 ? 'text-slate-400 dark:text-zinc-500' : idx === 2 ? 'text-amber-700 dark:text-amber-400' : 'text-slate-300 dark:text-zinc-600'}`}>
                            {idx + 1}
                          </span>
                        </div>
                        <div className="col-span-5 flex items-center gap-3 min-w-0">
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0 shadow-sm"
                            style={{ backgroundColor: firm.brand_color || '#6d28d9' }}
                          >
                            {firm.name?.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-800 dark:text-zinc-200 group-hover:text-indigo-600 transition-colors truncate">{firm.name}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className={`text-[10px] font-medium ${ic.text} capitalize`}>{firm.industry}</span>
                              {!hasAgent && <span className="text-[10px] text-slate-300 dark:text-zinc-600">· no agent</span>}
                            </div>
                          </div>
                        </div>
                        <div className="col-span-2 flex flex-col items-center gap-1">
                          <span className="text-sm font-bold text-slate-900 dark:text-zinc-100 tabular-nums">{firm._counts?.leads || 0}</span>
                          <div className="w-full h-1 bg-slate-100 dark:bg-zinc-800/50 rounded-full overflow-hidden">
                            <div className="h-full bg-indigo-400 rounded-full transition-all" style={{ width: `${barWidth}%` }} />
                          </div>
                        </div>
                        <div className="col-span-2 text-center">
                          <span className="text-sm font-bold text-slate-900 dark:text-zinc-100 tabular-nums">{firm._counts?.appointments || 0}</span>
                        </div>
                        <div className="col-span-2 flex justify-end">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                            isActive ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800' :
                            firm.status === 'paused' ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-100 dark:border-amber-800' :
                            'bg-slate-50 dark:bg-zinc-900 text-slate-500 dark:text-zinc-500 border border-slate-100 dark:border-zinc-800'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500' : firm.status === 'paused' ? 'bg-amber-500' : 'bg-slate-400'}`} />
                            {firm.status}
                          </span>
                        </div>
                      </Link>
                    );
                  })}
              </div>
            )}

            {firms.length > 0 && (
              <div className="px-6 py-3 border-t border-slate-50 dark:border-zinc-800/50">
                <Link to="/admin/clients" className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-500 hover:text-indigo-700 transition-colors">
                  Manage all clients <ArrowUpRight size={12} />
                </Link>
              </div>
            )}
          </div>

          {/* Platform Activity Feed */}
          <div className="bg-white dark:bg-zinc-900 rounded-lg border border-slate-100 dark:border-zinc-800 shadow-sm">
            <div className="px-6 py-5 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-slate-50 dark:bg-zinc-900 rounded-lg flex items-center justify-center">
                  <Activity size={16} className="text-slate-600 dark:text-zinc-500" />
                </div>
                <div>
                  <h3 className="text-[15px] font-semibold text-slate-900 dark:text-zinc-100">Platform Activity</h3>
                  <p className="text-xs text-slate-400 dark:text-zinc-500">Latest across all clients</p>
                </div>
              </div>
              <Link to="/admin/logs" className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-400 transition-colors">
                View logs <ArrowUpRight size={12} />
              </Link>
            </div>

            {recentActivity.length === 0 ? (
              <div className="py-16 text-center">
                <p className="text-sm text-slate-400 dark:text-zinc-500">No activity yet</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50 dark:divide-zinc-800/50">
                {recentActivity.map((firm, idx) => {
                  const ic = INDUSTRY_COLORS[firm.industry] || INDUSTRY_COLORS.other;
                  return (
                    <Link
                      key={firm.id}
                      to={`/admin/clients/${firm.id}`}
                      className="flex items-center gap-4 px-6 py-3.5 hover:bg-slate-50 dark:hover:bg-zinc-800/30 transition-all group"
                    >
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0 shadow-sm"
                        style={{ backgroundColor: firm.brand_color || '#6d28d9' }}
                      >
                        {firm.name?.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-slate-800 dark:text-zinc-200 group-hover:text-indigo-600 transition-colors truncate">{firm.name}</p>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold border ${ic.bg} ${ic.text} ${ic.border} capitalize`}>
                            {firm.industry}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 dark:text-zinc-500 mt-0.5">
                          {firm._counts?.leads || 0} leads
                          <span className="mx-1.5 text-slate-200 dark:text-zinc-700">&middot;</span>
                          {firm._counts?.staff || 0} staff
                          <span className="mx-1.5 text-slate-200 dark:text-zinc-700">&middot;</span>
                          {firm.retell_phone_number || 'No phone'}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className="text-[10px] text-slate-300 dark:text-zinc-600 font-medium">{formatRelativeTime(firm.created_at)}</span>
                        <ChevronRight size={14} className="text-slate-200 dark:text-zinc-700 group-hover:text-indigo-400 transition-colors" />
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
          <div className="bg-indigo-950 rounded-lg p-6 border border-indigo-900/30">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 bg-indigo-500/20 rounded-lg flex items-center justify-center">
                <Crown size={16} className="text-indigo-300" />
              </div>
              <div>
                <h3 className="text-[15px] font-semibold text-white">Revenue</h3>
                <p className="text-[10px] text-indigo-300/50 uppercase tracking-widest font-medium">Monthly Recurring</p>
              </div>
            </div>

            <p className="text-3xl font-bold text-white mb-1 tracking-tight">
              ${estimatedMRR.toLocaleString()}
              <span className="text-sm text-indigo-300/40 font-normal ml-1">/mo</span>
            </p>
            {planCounts.enterprise > 0 && (
              <p className="text-[10px] text-amber-400/60 mb-4">+ {planCounts.enterprise} enterprise (custom pricing)</p>
            )}
            {planCounts.enterprise === 0 && <div className="mb-5" />}

            <div className="space-y-2.5">
              {[
                { plan: 'Enterprise', count: planCounts.enterprise, label: 'Custom', color: 'bg-amber-400' },
                { plan: 'Scale', count: planCounts.scale, label: '$1,499/mo', color: 'bg-violet-400' },
                { plan: 'Growth', count: planCounts.growth, label: '$899/mo', color: 'bg-blue-400' },
              ].map(tier => (
                <div key={tier.plan} className="flex items-center gap-3">
                  <div className={`w-2.5 h-2.5 rounded-[3px] flex-shrink-0 ${tier.color}`} />
                  <span className="text-[13px] text-indigo-200/70 flex-1">{tier.plan}</span>
                  <span className="text-[13px] font-bold text-white tabular-nums">{tier.count}</span>
                  <span className="text-[11px] text-indigo-300/30 w-20 text-right tabular-nums">{tier.label}</span>
                </div>
              ))}
            </div>

            {/* Plan distribution bar */}
            {firms.length > 0 && (
              <div className="flex h-2 rounded-full overflow-hidden bg-indigo-900/50 mt-5">
                {planCounts.enterprise > 0 && <div className="bg-amber-400" style={{ width: `${(planCounts.enterprise / firms.length) * 100}%` }} />}
                {planCounts.scale > 0 && <div className="bg-violet-400" style={{ width: `${(planCounts.scale / firms.length) * 100}%` }} />}
                {planCounts.growth > 0 && <div className="bg-blue-400" style={{ width: `${(planCounts.growth / firms.length) * 100}%` }} />}
              </div>
            )}
          </div>

          {/* Error Monitor */}
          <div className="bg-white dark:bg-zinc-900 rounded-lg border border-slate-100 dark:border-zinc-800 shadow-sm p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                totalErrors === 0 ? 'bg-emerald-50 dark:bg-emerald-900/30' : totalErrors < 5 ? 'bg-amber-50 dark:bg-amber-900/30' : 'bg-red-50 dark:bg-red-900/30'
              }`}>
                <Server size={16} className={
                  totalErrors === 0 ? 'text-emerald-500' : totalErrors < 5 ? 'text-amber-500' : 'text-red-500'
                } />
              </div>
              <div>
                <h3 className="text-[15px] font-semibold text-slate-900 dark:text-zinc-100">Error Monitor</h3>
                <p className="text-xs text-slate-400 dark:text-zinc-500">Last 24 hours</p>
              </div>
            </div>

            {totalErrors === 0 ? (
              <div className="flex items-center gap-3 py-4 px-4 bg-emerald-50/50 rounded-lg border border-emerald-100 dark:border-emerald-800/50">
                <CheckCircle2 size={18} className="text-emerald-500 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-emerald-800">All clear</p>
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400/60">No errors in the last 24 hours</p>
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
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-50 dark:hover:bg-zinc-900 transition-colors group"
                    >
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        count === 0 ? 'bg-emerald-400' : count < 3 ? 'bg-amber-400' : 'bg-red-400'
                      }`} />
                      <span className="text-[13px] text-slate-600 dark:text-zinc-500 flex-1 group-hover:text-slate-900 dark:hover:text-zinc-100 transition-colors">{cat.label}</span>
                      <span className={`text-[13px] font-bold tabular-nums ${
                        count === 0 ? 'text-slate-300 dark:text-zinc-600' : count < 3 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'
                      }`}>{count}</span>
                    </Link>
                  );
                })}
              </div>
            )}

            {totalErrors > 0 && (
              <Link
                to="/admin/logs?level=error"
                className="mt-4 flex items-center justify-center gap-1.5 text-xs font-semibold text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-400 transition-colors bg-red-50 dark:bg-red-900/30 rounded-lg px-4 py-2.5"
              >
                View all errors <ArrowUpRight size={12} />
              </Link>
            )}
          </div>

          {/* Quick Actions */}
          <div className="bg-white dark:bg-zinc-900 rounded-lg border border-slate-100 dark:border-zinc-800 shadow-sm p-6">
            <h3 className="text-[15px] font-semibold text-slate-900 dark:text-zinc-100 mb-4">Quick Actions</h3>
            <div className="space-y-2">
              <Link to="/admin/clients/new" className="flex items-center gap-3 px-4 py-3 rounded-lg bg-indigo-50/50 border border-indigo-100/50 hover:bg-indigo-50 transition-all group">
                <Sparkles size={15} className="text-indigo-500" />
                <span className="text-sm font-medium text-indigo-700">Deploy New Client</span>
                <ChevronRight size={14} className="text-indigo-300 ml-auto group-hover:text-indigo-500 transition-colors" />
              </Link>
              <Link to="/admin/templates" className="flex items-center gap-3 px-4 py-3 rounded-lg bg-violet-50/50 border border-violet-100 dark:border-violet-800/50 hover:bg-violet-50 dark:hover:bg-violet-900/30 transition-all group">
                <Zap size={15} className="text-violet-500" />
                <span className="text-sm font-medium text-violet-700 dark:text-violet-400">Prompt Templates</span>
                <ChevronRight size={14} className="text-violet-300 ml-auto group-hover:text-violet-500 transition-colors" />
              </Link>
              <Link to="/admin/logs" className="flex items-center gap-3 px-4 py-3 rounded-lg bg-slate-50/50 dark:bg-zinc-900/50 border border-slate-100/50 hover:bg-slate-100 dark:hover:bg-zinc-800/50 transition-all group">
                <Activity size={15} className="text-slate-500 dark:text-zinc-500" />
                <span className="text-sm font-medium text-slate-700 dark:text-zinc-300">System Logs</span>
                <ChevronRight size={14} className="text-slate-300 dark:text-zinc-600 ml-auto group-hover:text-slate-500 dark:group-hover:text-zinc-500 transition-colors" />
              </Link>
              <Link to="/admin/clients" className="flex items-center gap-3 px-4 py-3 rounded-lg bg-slate-50/50 dark:bg-zinc-900/50 border border-slate-100/50 hover:bg-slate-100 dark:hover:bg-zinc-800/50 transition-all group">
                <Building2 size={15} className="text-slate-500 dark:text-zinc-500" />
                <span className="text-sm font-medium text-slate-700 dark:text-zinc-300">All Clients</span>
                <ChevronRight size={14} className="text-slate-300 dark:text-zinc-600 ml-auto group-hover:text-slate-500 dark:group-hover:text-zinc-500 transition-colors" />
              </Link>
            </div>
          </div>
        </div>
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
    slate: 'bg-slate-500/15 text-slate-400 dark:text-zinc-500',
  };

  return (
    <div className={`relative overflow-hidden rounded-lg px-4 py-4 border border-white/[0.06] bg-white/10 hover:bg-white/[0.14] transition-all ${clickable ? 'cursor-pointer' : ''}`}>
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${colorMap[color]}`}>
          <Icon size={13} />
        </div>
        <span className="text-[10px] text-white/35 uppercase tracking-widest font-medium">{label}</span>
      </div>
      <p className="text-2xl font-bold text-white tracking-tight">
        {value}
        {suffix && <span className="text-sm text-white/25 font-normal ml-1">{suffix}</span>}
      </p>
      {trend && (
        <p className="text-[10px] text-white/25 mt-1.5 font-medium">{trend}</p>
      )}
    </div>
  );
}
