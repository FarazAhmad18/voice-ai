import { useState, useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { fetchLeads } from '../services/api';
import { supabase } from '../services/supabase';
import ScoreBadge from '../components/ScoreBadge';
import StatusBadge from '../components/StatusBadge';
import DateFilter from '../components/DateFilter';
import { Search, Download, PhoneIncoming, ChevronRight, ArrowRight, Users, Flame, Filter, AlertCircle, LayoutGrid, LayoutList, TrendingUp, Zap, Clock } from 'lucide-react';

const PIPELINE = [
  { key: 'all', label: 'All' },
  { key: 'new', label: 'New' },
  { key: 'booked', label: 'Booked' },
  { key: 'converted', label: 'Converted' },
  { key: 'closed', label: 'Closed' },
];

const SCORE_FILTERS = [
  { key: 'all_scores', label: 'All', icon: null },
  { key: 'hot', label: 'Hot', color: 'text-red-600 bg-red-50' },
  { key: 'warm', label: 'Warm', color: 'text-amber-600 bg-amber-50' },
  { key: 'cold', label: 'Cold', color: 'text-slate-500 bg-slate-50' },
];

function filterByDate(leads, dateRange) {
  if (dateRange === 'all') return leads;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return leads.filter((l) => {
    const created = new Date(l.created_at);
    if (dateRange === 'today') return created >= today;
    if (dateRange === 'week') {
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);
      return created >= weekAgo;
    }
    if (dateRange === 'month') {
      const monthAgo = new Date(today);
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      return created >= monthAgo;
    }
    return true;
  });
}

function exportToCSV(leads) {
  const headers = ['Name', 'Phone', 'Email', 'Case Type', 'Score', 'Score Label', 'Status', 'Urgency', 'Date'];
  const rows = leads.map((l) => [
    l.caller_name, l.caller_phone, l.caller_email || '', l.case_type,
    l.score, l.score_label, l.status, l.urgency,
    new Date(l.created_at).toLocaleDateString(),
  ]);
  const csv = [headers, ...rows].map((r) => r.map((v) => `"${v}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `leads-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
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
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function getAvatarGradient(scoreLabel) {
  if (scoreLabel === 'hot') return 'from-red-500 to-orange-500';
  if (scoreLabel === 'warm') return 'from-amber-400 to-orange-400';
  return 'from-slate-400 to-slate-500';
}

function LeadCardView({ lead }) {
  const initials = ((lead.caller_name || 'U').split(' ').map(n => n?.[0] || '').join('').slice(0, 2).toUpperCase()) || '?';
  const gradient = getAvatarGradient(lead.score_label);

  return (
    <Link
      to={`/leads/${lead.id}`}
      className="group relative bg-white rounded-2xl border border-slate-100 p-5 hover:shadow-lg hover:shadow-slate-200/50 hover:-translate-y-0.5 transition-all duration-200"
    >
      {lead.urgency === 'high' && (
        <div className="absolute top-4 right-4">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
          </span>
        </div>
      )}
      <div className="flex items-start gap-3.5">
        <div className={`w-11 h-11 bg-gradient-to-br ${gradient} rounded-xl flex items-center justify-center text-xs font-bold text-white shadow-sm flex-shrink-0`}>
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-900 truncate group-hover:text-violet-600 transition-colors">{lead.caller_name}</p>
          <p className="text-xs text-slate-400 mt-0.5 truncate">{lead.caller_phone}</p>
        </div>
      </div>
      <div className="mt-4 flex items-center gap-2 flex-wrap">
        <ScoreBadge score={lead.score} label={lead.score_label} />
        <StatusBadge status={lead.status} />
      </div>
      <div className="mt-3 pt-3 border-t border-slate-50 flex items-center justify-between">
        <span className="text-[11px] text-slate-400 capitalize">{lead.case_type}</span>
        <span className="text-[11px] text-slate-300">{formatRelativeTime(lead.created_at)}</span>
      </div>
    </Link>
  );
}

export default function Leads() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pipeline, setPipeline] = useState('all');
  const [scoreFilter, setScoreFilter] = useState('all_scores');
  const [dateRange, setDateRange] = useState('all');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [searchParams] = useSearchParams();
  const [viewMode, setViewMode] = useState('table');
  const pipelineRef = useRef(null);
  const [sliderStyle, setSliderStyle] = useState({});

  useEffect(() => {
    const q = searchParams.get('search');
    if (q) { setSearch(q); setSearchInput(q); }
    const s = searchParams.get('status');
    if (s && PIPELINE.find(p => p.key === s)) setPipeline(s);
    const sc = searchParams.get('score');
    if (sc && SCORE_FILTERS.find(f => f.key === sc)) setScoreFilter(sc);
  }, [searchParams]);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Slide indicator for pipeline tabs
  useEffect(() => {
    if (!pipelineRef.current) return;
    const activeBtn = pipelineRef.current.querySelector('[data-active="true"]');
    if (activeBtn) {
      setSliderStyle({
        width: activeBtn.offsetWidth,
        transform: `translateX(${activeBtn.offsetLeft - pipelineRef.current.firstChild?.offsetLeft}px)`,
      });
    }
  }, [pipeline, loading]);

  async function loadLeads() {
    setError(null);
    try {
      const data = await fetchLeads();
      setLeads(data);
    } catch (err) {
      console.error('Failed to fetch leads:', err);
      setError(err.message || 'Failed to fetch leads');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLeads();
  }, []);

  // Supabase Realtime: listen for new and updated leads
  useEffect(() => {
    const channel = supabase
      .channel('leads-changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'leads' },
        (payload) => {
          setLeads((prev) => [payload.new, ...prev]);
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'leads' },
        (payload) => {
          setLeads((prev) =>
            prev.map((lead) =>
              lead.id === payload.new.id ? payload.new : lead
            )
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const visibleLeads = leads.filter(l => l.status !== 'contacted');

  let filtered = visibleLeads
    .filter((l) => pipeline === 'all' || l.status === pipeline)
    .filter((l) => scoreFilter === 'all_scores' || l.score_label === scoreFilter)
    .filter((l) => !search || l.caller_name?.toLowerCase().includes(search.toLowerCase()) || l.caller_phone?.includes(search));
  filtered = filterByDate(filtered, dateRange);

  const followUpCount = leads.filter(l => l.status === 'contacted').length;
  const hotCount = visibleLeads.filter(l => l.score_label === 'hot').length;
  const warmCount = visibleLeads.filter(l => l.score_label === 'warm').length;
  const todayCount = visibleLeads.filter(l => {
    const d = new Date(l.created_at);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  }).length;

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Skeleton header */}
        <div className="flex items-end justify-between">
          <div>
            <div className="h-8 w-32 bg-slate-100 rounded-lg animate-pulse" />
            <div className="flex gap-3 mt-3">
              <div className="h-8 w-24 bg-slate-50 rounded-full animate-pulse" />
              <div className="h-8 w-20 bg-slate-50 rounded-full animate-pulse" />
              <div className="h-8 w-28 bg-slate-50 rounded-full animate-pulse" />
            </div>
          </div>
          <div className="flex gap-2">
            <div className="h-10 w-28 bg-slate-50 rounded-xl animate-pulse" />
          </div>
        </div>
        {/* Skeleton filter bar */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          <div className="h-10 bg-slate-50 rounded-xl animate-pulse mb-3" />
          <div className="flex gap-2">
            {[1,2,3,4,5].map(i => (
              <div key={i} className="h-8 w-16 bg-slate-50 rounded-lg animate-pulse" />
            ))}
          </div>
        </div>
        {/* Skeleton rows */}
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="flex items-center gap-4 px-5 py-4 border-b border-slate-50">
              <div className="w-10 h-10 bg-slate-100 rounded-xl animate-pulse" />
              <div className="flex-1">
                <div className="h-4 w-32 bg-slate-100 rounded animate-pulse" />
                <div className="h-3 w-24 bg-slate-50 rounded animate-pulse mt-2" />
              </div>
              <div className="h-6 w-16 bg-slate-50 rounded-lg animate-pulse" />
              <div className="h-6 w-16 bg-slate-50 rounded-lg animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50/80 backdrop-blur-sm border border-red-100 rounded-2xl px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <AlertCircle size={16} className="text-red-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-red-800">Failed to load leads</p>
              <p className="text-xs text-red-600 mt-0.5">{error}</p>
            </div>
          </div>
          <button onClick={loadLeads} className="px-4 py-2 text-xs font-semibold text-red-600 bg-red-100 hover:bg-red-200 rounded-lg transition-colors">
            Retry
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Leads</h1>
          <div className="flex items-center gap-2.5 mt-3 flex-wrap">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-full">
              <Users size={12} />
              {visibleLeads.length} total
            </span>
            {hotCount > 0 && (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600 bg-red-50 border border-red-100 px-3 py-1.5 rounded-full">
                <Flame size={12} />
                {hotCount} hot
              </span>
            )}
            {warmCount > 0 && (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-600 bg-amber-50 border border-amber-100 px-3 py-1.5 rounded-full">
                <TrendingUp size={12} />
                {warmCount} warm
              </span>
            )}
            {todayCount > 0 && (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-violet-600 bg-violet-50 border border-violet-100 px-3 py-1.5 rounded-full">
                <Zap size={12} />
                {todayCount} today
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {followUpCount > 0 && (
            <Link
              to="/follow-ups"
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-amber-700 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/60 rounded-xl hover:from-amber-100 hover:to-orange-100 transition-all shadow-sm"
            >
              <Clock size={14} />
              {followUpCount} Follow Up{followUpCount !== 1 ? 's' : ''}
              <ArrowRight size={14} />
            </Link>
          )}
          {/* View toggle */}
          <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('table')}
              className={`p-2 rounded-md transition-all ${viewMode === 'table' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}
              title="Table view"
            >
              <LayoutList size={15} />
            </button>
            <button
              onClick={() => setViewMode('card')}
              className={`p-2 rounded-md transition-all ${viewMode === 'card' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}
              title="Card view"
            >
              <LayoutGrid size={15} />
            </button>
          </div>
          <button
            onClick={() => exportToCSV(filtered)}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm"
          >
            <Download size={15} />
            Export
          </button>
        </div>
      </div>

      {/* Filters Bar — Glass morphism */}
      <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-slate-200/60 shadow-sm shadow-slate-100/50 p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="relative flex-1 max-w-md group">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-violet-400 transition-colors" />
            <input
              type="text"
              placeholder="Search by name or phone..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full pl-11 pr-4 py-3 text-sm bg-slate-50/80 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-300 focus:bg-white placeholder:text-slate-300 transition-all"
            />
          </div>
          <DateFilter value={dateRange} onChange={setDateRange} />
        </div>

        <div className="flex items-center justify-between gap-3 flex-wrap">
          {/* Pipeline tabs with slide indicator */}
          <div ref={pipelineRef} className="relative flex items-center gap-0.5 bg-slate-50 rounded-xl p-1">
            {/* Sliding active indicator */}
            <div
              className="absolute top-1 left-1 h-[calc(100%-8px)] bg-white rounded-lg shadow-sm transition-all duration-300 ease-out"
              style={sliderStyle}
            />
            {PIPELINE.map((p) => {
              const count = p.key === 'all' ? visibleLeads.length : visibleLeads.filter((l) => l.status === p.key).length;
              const isActive = pipeline === p.key;
              return (
                <button
                  key={p.key}
                  data-active={isActive}
                  onClick={() => setPipeline(p.key)}
                  className={`relative z-10 px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-200 flex items-center gap-1.5 ${
                    isActive
                      ? 'text-slate-900'
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  {p.label}
                  <span className={`text-[10px] font-medium tabular-nums ${isActive ? 'text-violet-500' : 'text-slate-300'}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Score filter */}
          <div className="flex items-center gap-1.5">
            {SCORE_FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setScoreFilter(f.key)}
                className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all duration-200 ${
                  scoreFilter === f.key
                    ? f.key === 'hot' ? 'bg-gradient-to-r from-red-500 to-orange-500 text-white shadow-sm shadow-red-500/20'
                    : f.key === 'warm' ? 'bg-gradient-to-r from-amber-400 to-orange-400 text-white shadow-sm shadow-amber-400/20'
                    : f.key === 'cold' ? 'bg-slate-800 text-white shadow-sm'
                    : 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                }`}
              >
                {f.label}
              </button>
            ))}
            <div className="ml-3 h-4 w-px bg-slate-200" />
            <span className="ml-2 text-xs font-medium text-slate-400 tabular-nums">{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>
          </div>
        </div>
      </div>

      {/* Content */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm py-20 text-center">
          <div className="relative mx-auto w-20 h-20 mb-6">
            <div className="absolute inset-0 bg-slate-100 rounded-3xl rotate-6 animate-pulse" />
            <div className="relative w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center">
              <PhoneIncoming size={28} className="text-slate-300" />
            </div>
          </div>
          <p className="text-base font-semibold text-slate-700">No leads found</p>
          <p className="text-sm text-slate-400 mt-2 max-w-xs mx-auto">Try adjusting your filters or wait for new calls to come in</p>
          {(pipeline !== 'all' || scoreFilter !== 'all_scores' || search) && (
            <button
              onClick={() => { setPipeline('all'); setScoreFilter('all_scores'); setSearchInput(''); setSearch(''); setDateRange('all'); }}
              className="mt-5 px-5 py-2.5 text-sm font-medium text-violet-600 bg-violet-50 hover:bg-violet-100 rounded-xl transition-colors"
            >
              Clear all filters
            </button>
          )}
        </div>
      ) : viewMode === 'card' ? (
        /* Card Grid View */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((lead) => (
            <LeadCardView key={lead.id} lead={lead} />
          ))}
        </div>
      ) : (
        /* Table View */
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm shadow-slate-100/50 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-100">
                <th className="text-left px-5 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  <span className="flex items-center gap-1.5">Client <ChevronRight size={10} className="rotate-90 opacity-40" /></span>
                </th>
                <th className="text-left px-5 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-400 hidden sm:table-cell">
                  <span className="flex items-center gap-1.5">Phone <ChevronRight size={10} className="rotate-90 opacity-40" /></span>
                </th>
                <th className="text-left px-5 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-400 hidden md:table-cell">
                  <span className="flex items-center gap-1.5">Case <ChevronRight size={10} className="rotate-90 opacity-40" /></span>
                </th>
                <th className="text-left px-5 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-400">Score</th>
                <th className="text-left px-5 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-400 hidden sm:table-cell">Status</th>
                <th className="text-left px-5 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-400 hidden lg:table-cell">When</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((lead, idx) => {
                const initials = ((lead.caller_name || 'U').split(' ').map(n => n?.[0] || '').join('').slice(0, 2).toUpperCase()) || '?';
                const gradient = getAvatarGradient(lead.score_label);
                return (
                  <tr
                    key={lead.id}
                    className={`group hover:bg-slate-50/80 hover:shadow-[0_1px_8px_-2px_rgba(0,0,0,0.06)] transition-all duration-200 ${idx % 2 === 1 ? 'bg-slate-50/30' : 'bg-white'}`}
                  >
                    <td className="px-5 py-3.5">
                      <Link to={`/leads/${lead.id}`} className="flex items-center gap-3">
                        <div className="relative">
                          <div className={`w-10 h-10 bg-gradient-to-br ${gradient} rounded-xl flex items-center justify-center text-[11px] font-bold text-white shadow-sm group-hover:shadow-md group-hover:scale-105 transition-all duration-200`}>
                            {initials}
                          </div>
                          {lead.score_label === 'hot' && (
                            <div className="absolute -top-0.5 -right-0.5">
                              <span className="relative flex h-2.5 w-2.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500 border-2 border-white" />
                              </span>
                            </div>
                          )}
                        </div>
                        <div>
                          <span className="text-sm font-semibold text-slate-800 group-hover:text-violet-600 transition-colors">{lead.caller_name}</span>
                          {lead.urgency === 'high' && (
                            <span className="ml-2 inline-flex items-center gap-1">
                              <span className="relative flex h-1.5 w-1.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500" />
                              </span>
                              <span className="text-[10px] font-semibold text-red-500">Urgent</span>
                            </span>
                          )}
                        </div>
                      </Link>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-slate-500 font-mono text-[13px] hidden sm:table-cell">{lead.caller_phone}</td>
                    <td className="px-5 py-3.5 hidden md:table-cell">
                      <span className="text-xs font-medium text-slate-600 bg-slate-50 px-2.5 py-1 rounded-md capitalize">{lead.case_type}</span>
                    </td>
                    <td className="px-5 py-3.5"><ScoreBadge score={lead.score} label={lead.score_label} /></td>
                    <td className="px-5 py-3.5 hidden sm:table-cell"><StatusBadge status={lead.status} /></td>
                    <td className="px-5 py-3.5 text-xs font-medium text-slate-400 hidden lg:table-cell">{formatRelativeTime(lead.created_at)}</td>
                    <td className="px-3 py-3.5">
                      <Link to={`/leads/${lead.id}`}>
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center group-hover:bg-violet-50 transition-colors">
                          <ChevronRight size={16} className="text-slate-200 group-hover:text-violet-500 transition-colors" />
                        </div>
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
