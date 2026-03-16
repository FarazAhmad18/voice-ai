import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { fetchFirms, updateFirm } from '../../services/api';
import { toast } from 'sonner';
import {
  Building2, Search, Plus, ChevronRight, Users, Phone, Eye,
  Pencil, Pause, Play, Sparkles, Globe, TrendingUp,
  Filter, X, ArrowUpRight, Shield, Crown, PhoneCall,
} from 'lucide-react';

/* ── Admin list styles ── */
const STYLE_ID = '__admin-client-list-styles';
if (typeof document !== 'undefined' && !document.getElementById(STYLE_ID)) {
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    @keyframes clFadeIn {
      from { opacity: 0; transform: translateY(8px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .cl-fade-in {
      animation: clFadeIn 0.4s ease forwards;
      opacity: 0;
    }
    .cl-card-lift {
      transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
    }
    .cl-card-lift:hover {
      transform: translateY(-2px);
      box-shadow: 0 10px 25px -6px rgba(49,46,129,0.12), 0 4px 10px -4px rgba(0,0,0,0.06);
      border-color: rgba(99,102,241,0.25);
    }
  `;
  document.head.appendChild(style);
}

const INDUSTRY_COLORS = {
  legal: { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-100', label: 'Legal' },
  dental: { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-100', label: 'Dental' },
  plumbing: { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-100', label: 'Plumbing' },
  real_estate: { bg: 'bg-violet-50', text: 'text-violet-600', border: 'border-violet-100', label: 'Real Estate' },
  medical: { bg: 'bg-rose-50', text: 'text-rose-600', border: 'border-rose-100', label: 'Medical' },
  other: { bg: 'bg-slate-50', text: 'text-slate-500', border: 'border-slate-100', label: 'Other' },
};

const PLAN_BADGES = {
  free: { bg: 'bg-slate-50', text: 'text-slate-500', border: 'border-slate-100', icon: null },
  starter: { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-100', icon: null },
  pro: { bg: 'bg-violet-50', text: 'text-violet-600', border: 'border-violet-100', icon: Crown },
  enterprise: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-100', icon: Crown },
};

export default function ClientList() {
  const [firms, setFirms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [industryFilter, setIndustryFilter] = useState('all');
  const [toggling, setToggling] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const data = await fetchFirms();
        setFirms(data);
      } catch (err) {
        console.error('Failed to fetch firms:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filtered = firms
    .filter(f => statusFilter === 'all' || f.status === statusFilter)
    .filter(f => industryFilter === 'all' || f.industry === industryFilter)
    .filter(f => !search || f.name?.toLowerCase().includes(search.toLowerCase()) || f.industry?.toLowerCase().includes(search.toLowerCase()) || f.email?.toLowerCase().includes(search.toLowerCase()));

  // Computed stats
  const totalLeads = firms.reduce((sum, f) => sum + (f._counts?.leads || 0), 0);
  const activeCount = firms.filter(f => f.status === 'active').length;
  const activePct = firms.length > 0 ? Math.round((activeCount / firms.length) * 100) : 0;
  const industries = [...new Set(firms.map(f => f.industry).filter(Boolean))];

  async function handleToggleStatus(firm) {
    const newStatus = firm.status === 'active' ? 'paused' : 'active';
    setToggling(firm.id);
    try {
      await updateFirm(firm.id, { status: newStatus });
      setFirms(prev => prev.map(f => f.id === firm.id ? { ...f, status: newStatus } : f));
      toast.success(`${firm.name} ${newStatus === 'active' ? 'activated' : 'paused'}`);
    } catch (err) {
      toast.error(`Failed to update: ${err.message}`);
    } finally {
      setToggling(null);
    }
  }

  if (loading) {
    return (
      <div className="max-w-[1400px] mx-auto space-y-5">
        <div className="h-24 bg-gradient-to-r from-indigo-50 to-violet-50 rounded-2xl animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-48 bg-slate-50 rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const hasActiveFilters = statusFilter !== 'all' || industryFilter !== 'all' || search;

  return (
    <div className="max-w-[1400px] mx-auto space-y-5">

      {/* ── Platform Stats Bar ── */}
      <div className="bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-950 rounded-2xl p-5 flex flex-wrap items-center gap-6 border border-indigo-900/30">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-indigo-500/20 rounded-xl flex items-center justify-center">
            <Shield size={16} className="text-indigo-300" />
          </div>
          <div>
            <p className="text-lg font-bold text-white tracking-tight">{firms.length}</p>
            <p className="text-[10px] text-indigo-300/50 uppercase tracking-widest font-medium">Total Clients</p>
          </div>
        </div>
        <div className="w-px h-10 bg-indigo-800/40" />
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-emerald-500/15 rounded-xl flex items-center justify-center">
            <Globe size={16} className="text-emerald-300" />
          </div>
          <div>
            <p className="text-lg font-bold text-white tracking-tight">{activePct}%</p>
            <p className="text-[10px] text-emerald-300/50 uppercase tracking-widest font-medium">Active Rate</p>
          </div>
        </div>
        <div className="w-px h-10 bg-indigo-800/40" />
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-500/15 rounded-xl flex items-center justify-center">
            <Users size={16} className="text-blue-300" />
          </div>
          <div>
            <p className="text-lg font-bold text-white tracking-tight">{totalLeads.toLocaleString()}</p>
            <p className="text-[10px] text-blue-300/50 uppercase tracking-widest font-medium">Total Leads</p>
          </div>
        </div>
        <div className="w-px h-10 bg-indigo-800/40 hidden sm:block" />
        <div className="flex items-center gap-3 hidden sm:flex">
          <div className="w-9 h-9 bg-violet-500/15 rounded-xl flex items-center justify-center">
            <TrendingUp size={16} className="text-violet-300" />
          </div>
          <div>
            <p className="text-lg font-bold text-white tracking-tight">{industries.length}</p>
            <p className="text-[10px] text-violet-300/50 uppercase tracking-widest font-medium">Industries</p>
          </div>
        </div>

        <div className="ml-auto">
          <Link
            to="/admin/clients/new"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-900/30"
          >
            <Sparkles size={14} />
            Deploy Client
          </Link>
        </div>
      </div>

      {/* ── Search & Filters ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
            <input
              type="text"
              placeholder="Search by name, industry, email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-72 pl-9 pr-3 py-2.5 text-sm bg-white border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-200 placeholder:text-slate-300"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500">
                <X size={14} />
              </button>
            )}
          </div>

          {/* Status filter chips */}
          <div className="flex items-center gap-1 bg-slate-50 rounded-xl p-1">
            {['all', 'active', 'paused', 'cancelled'].map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize ${
                  statusFilter === s ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                {s === 'all' ? 'All Status' : s}
              </button>
            ))}
          </div>

          {/* Industry filter */}
          {industries.length > 1 && (
            <div className="flex items-center gap-1 bg-slate-50 rounded-xl p-1">
              <button
                onClick={() => setIndustryFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  industryFilter === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                All Industries
              </button>
              {industries.map(ind => {
                const ic = INDUSTRY_COLORS[ind] || INDUSTRY_COLORS.other;
                return (
                  <button
                    key={ind}
                    onClick={() => setIndustryFilter(ind)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize ${
                      industryFilter === ind ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    {ic.label || ind}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {hasActiveFilters && (
          <button
            onClick={() => { setSearch(''); setStatusFilter('all'); setIndustryFilter('all'); }}
            className="text-xs text-indigo-500 font-medium hover:text-indigo-700 transition-colors flex items-center gap-1"
          >
            <X size={12} /> Clear filters
          </button>
        )}
      </div>

      {/* Result count */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-400">
          {filtered.length} client{filtered.length !== 1 ? 's' : ''}
          {hasActiveFilters ? ` (filtered from ${firms.length})` : ''}
        </p>
      </div>

      {/* ── Client Cards Grid ── */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 py-20 text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-indigo-50 to-violet-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Building2 size={24} className="text-indigo-400" />
          </div>
          <p className="text-sm font-semibold text-slate-700">No clients found</p>
          <p className="text-xs text-slate-400 mt-1.5">
            {hasActiveFilters ? 'Try adjusting your filters.' : 'Deploy your first client to get started.'}
          </p>
          {!hasActiveFilters && (
            <Link to="/admin/clients/new" className="inline-flex items-center gap-1.5 mt-4 text-sm font-medium text-indigo-600 hover:text-indigo-700">
              <Sparkles size={14} /> Deploy first client
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((firm, idx) => {
            const ic = INDUSTRY_COLORS[firm.industry] || INDUSTRY_COLORS.other;
            const pb = PLAN_BADGES[firm.plan || 'free'] || PLAN_BADGES.free;
            const PlanIcon = pb.icon;
            const isActive = firm.status === 'active';
            const hasAgent = !!firm.retell_agent_id;

            return (
              <div
                key={firm.id}
                className="relative bg-white rounded-2xl border border-slate-100 overflow-hidden cl-card-lift cl-fade-in group"
                style={{ animationDelay: `${idx * 40}ms` }}
              >
                {/* Color accent bar */}
                <div className="h-1" style={{ backgroundColor: firm.brand_color || '#6d28d9' }} />

                <div className="p-5">
                  {/* Header */}
                  <div className="flex items-start gap-3.5 mb-4">
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold text-white flex-shrink-0 shadow-sm"
                      style={{ backgroundColor: firm.brand_color || '#6d28d9' }}
                    >
                      {firm.name?.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <Link to={`/admin/clients/${firm.id}`} className="text-sm font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors truncate block">
                        {firm.name}
                      </Link>
                      <p className="text-xs text-slate-400 mt-0.5 truncate">{firm.email || firm.retell_phone_number || 'No contact'}</p>
                    </div>
                    {/* Status dot */}
                    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-semibold ${
                      isActive ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                      firm.status === 'paused' ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                      'bg-slate-50 text-slate-500 border border-slate-100'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        isActive ? 'bg-emerald-500' :
                        firm.status === 'paused' ? 'bg-amber-500' :
                        'bg-slate-400'
                      }`} />
                      {firm.status}
                    </div>
                  </div>

                  {/* Badges */}
                  <div className="flex items-center gap-1.5 flex-wrap mb-4">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold border ${ic.bg} ${ic.text} ${ic.border}`}>
                      {ic.label}
                    </span>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border ${pb.bg} ${pb.text} ${pb.border} capitalize`}>
                      {PlanIcon && <PlanIcon size={9} />}
                      {firm.plan || 'free'}
                    </span>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                      hasAgent ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-slate-50 text-slate-400 border border-slate-100'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${hasAgent ? 'bg-emerald-400' : 'bg-slate-300'}`} />
                      {hasAgent ? `${firm.agent_name || 'Agent'} live` : 'No agent'}
                    </span>
                  </div>

                  {/* Stats row */}
                  <div className="flex items-center gap-5 py-3 border-t border-slate-50">
                    <div>
                      <p className="text-lg font-bold text-slate-900 tabular-nums">{firm._counts?.leads || 0}</p>
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">Leads</p>
                    </div>
                    <div className="w-px h-8 bg-slate-100" />
                    <div>
                      <p className="text-lg font-bold text-slate-900 tabular-nums">{firm._counts?.appointments || 0}</p>
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">Appts</p>
                    </div>
                    <div className="w-px h-8 bg-slate-100" />
                    <div>
                      <p className="text-lg font-bold text-slate-900 tabular-nums">{firm._counts?.staff || 0}</p>
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">Staff</p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-50">
                    <Link
                      to={`/admin/clients/${firm.id}`}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-indigo-50 text-indigo-600 text-xs font-semibold rounded-lg hover:bg-indigo-100 transition-colors"
                    >
                      <Eye size={13} /> View
                    </Link>
                    <Link
                      to={`/admin/clients/${firm.id}`}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-50 text-slate-600 text-xs font-semibold rounded-lg hover:bg-slate-100 transition-colors"
                    >
                      <Pencil size={12} /> Edit
                    </Link>
                    <button
                      onClick={() => handleToggleStatus(firm)}
                      disabled={toggling === firm.id}
                      className={`flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition-colors ${
                        isActive
                          ? 'bg-amber-50 text-amber-600 hover:bg-amber-100'
                          : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                      } ${toggling === firm.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {toggling === firm.id ? (
                        <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                      ) : isActive ? (
                        <><Pause size={12} /> Pause</>
                      ) : (
                        <><Play size={12} /> Activate</>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
