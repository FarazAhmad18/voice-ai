import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { fetchLeads, updateLead } from '../services/api';
import { toast } from 'sonner';
import ScoreBadge from '../components/ScoreBadge';
import DateFilter from '../components/DateFilter';
import {
  Search, UserCheck, ChevronRight, CalendarCheck, Clock,
  AlertTriangle, ArrowUpRight, Phone, MessageSquare, AlertCircle,
  Flame, TrendingUp, Zap,
} from 'lucide-react';

/* ─── Inject keyframe styles once ─── */
const STYLE_ID = '__followups-premium-styles';
if (typeof document !== 'undefined' && !document.getElementById(STYLE_ID)) {
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    @keyframes followUpFadeInUp {
      from { opacity: 0; transform: translateY(16px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes followUpPulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
    @keyframes followUpShimmer {
      0%   { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }
    .fu-fade-in-up {
      animation: followUpFadeInUp 0.4s ease forwards;
      opacity: 0;
    }
    .fu-pulse-indicator {
      animation: followUpPulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
    }
    .fu-shimmer {
      background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%);
      background-size: 200% 100%;
      animation: followUpShimmer 1.5s ease-in-out infinite;
    }
    .fu-card-lift {
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    }
    .fu-card-lift:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 25px -5px rgba(0,0,0,0.08), 0 4px 10px -6px rgba(0,0,0,0.04);
    }
  `;
  document.head.appendChild(style);
}

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

function daysSince(dateStr) {
  if (!dateStr) return null;
  const diff = new Date() - new Date(dateStr);
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const diff = new Date(dateStr) - new Date();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function getAvatarGradient(scoreLabel) {
  if (scoreLabel === 'hot') return 'from-red-500 to-orange-500';
  if (scoreLabel === 'warm') return 'from-amber-400 to-orange-400';
  return 'from-slate-400 to-slate-500';
}

export default function FollowUps() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [dateRange, setDateRange] = useState('all');
  const [scoreFilter, setScoreFilter] = useState('all');

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  async function loadLeads() {
    setError(null);
    try {
      const data = await fetchLeads();
      setLeads(data.filter(l => l.status === 'contacted'));
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

  async function handleMarkBooked(e, id) {
    e.preventDefault();
    e.stopPropagation();
    try {
      await updateLead(id, { status: 'booked' });
      setLeads(prev => prev.filter(l => l.id !== id));
      toast.success('Lead marked as booked');
    } catch (err) {
      toast.error('Failed to mark as booked');
    }
  }

  let filtered = leads
    .filter(l => !search || l.caller_name?.toLowerCase().includes(search.toLowerCase()) || l.caller_phone?.includes(search))
    .filter(l => scoreFilter === 'all' || l.score_label === scoreFilter);
  filtered = filterByDate(filtered, dateRange);

  // Sort: overdue first, then by follow_up_date asc, then by created_at desc
  const today = new Date().toISOString().split('T')[0];
  filtered.sort((a, b) => {
    const aOverdue = a.follow_up_date && a.follow_up_date <= today;
    const bOverdue = b.follow_up_date && b.follow_up_date <= today;
    if (aOverdue && !bOverdue) return -1;
    if (!aOverdue && bOverdue) return 1;
    if (a.follow_up_date && b.follow_up_date) return a.follow_up_date.localeCompare(b.follow_up_date);
    if (a.follow_up_date) return -1;
    if (b.follow_up_date) return 1;
    return new Date(b.created_at) - new Date(a.created_at);
  });

  const overdue = filtered.filter(l => l.follow_up_date && l.follow_up_date <= today);
  const upcoming = filtered.filter(l => l.follow_up_date && l.follow_up_date > today);
  const noDate = filtered.filter(l => !l.follow_up_date);

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Skeleton header */}
        <div>
          <div className="h-9 w-44 bg-slate-100 rounded-lg animate-pulse" />
          <div className="h-4 w-64 bg-slate-50 rounded animate-pulse mt-3" />
        </div>
        {/* Skeleton summary cards */}
        <div className="grid grid-cols-3 gap-4">
          {[1,2,3].map(i => (
            <div key={i} className="rounded-2xl p-5 border border-slate-100 bg-white">
              <div className="h-8 w-12 fu-shimmer rounded-lg mb-2" />
              <div className="h-3 w-20 fu-shimmer rounded" />
            </div>
          ))}
        </div>
        {/* Skeleton filter bar */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          <div className="h-11 bg-slate-50 rounded-xl animate-pulse" />
        </div>
        {/* Skeleton cards */}
        <div className="space-y-3">
          {[1,2,3,4,5].map(i => (
            <div key={i} className="bg-white rounded-2xl border border-slate-100 p-5">
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 bg-slate-100 rounded-xl animate-pulse" />
                <div className="flex-1">
                  <div className="h-4 w-36 bg-slate-100 rounded animate-pulse" />
                  <div className="h-3 w-52 bg-slate-50 rounded animate-pulse mt-2" />
                </div>
                <div className="h-7 w-24 bg-slate-50 rounded-lg animate-pulse" />
              </div>
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
              <p className="text-sm font-medium text-red-800">Failed to load follow-ups</p>
              <p className="text-xs text-red-600 mt-0.5">{error}</p>
            </div>
          </div>
          <button onClick={loadLeads} className="px-4 py-2 text-xs font-semibold text-red-600 bg-red-100 hover:bg-red-200 rounded-lg transition-colors">
            Retry
          </button>
        </div>
      )}

      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Follow Ups</h1>
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/60 px-3 py-1.5 rounded-full">
            <Clock size={12} />
            {leads.length}
          </span>
        </div>
        <p className="text-sm text-slate-400 mt-2">
          Leads you've contacted that need follow-up action
        </p>
      </div>

      {/* Summary cards */}
      {leads.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div
            className={`relative overflow-hidden rounded-2xl p-5 fu-card-lift cursor-default ${
              overdue.length > 0
                ? 'bg-gradient-to-br from-red-500 to-rose-600 text-white shadow-lg shadow-red-200/50'
                : 'bg-white border border-slate-100'
            }`}
          >
            {overdue.length > 0 && (
              <div className="absolute top-3 right-3">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-40" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-white/80" />
                </span>
              </div>
            )}
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle size={14} className={overdue.length > 0 ? 'text-white/80' : 'text-slate-300'} />
              <span className={`text-xs font-semibold uppercase tracking-wider ${overdue.length > 0 ? 'text-white/70' : 'text-slate-400'}`}>Overdue</span>
            </div>
            <p className={`text-3xl font-extrabold ${overdue.length > 0 ? 'text-white' : 'text-slate-300'}`}>{overdue.length}</p>
          </div>

          <div className="relative overflow-hidden rounded-2xl p-5 bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-lg shadow-amber-200/50 fu-card-lift cursor-default">
            <div className="flex items-center gap-2 mb-1">
              <CalendarCheck size={14} className="text-white/80" />
              <span className="text-xs font-semibold uppercase tracking-wider text-white/70">Scheduled</span>
            </div>
            <p className="text-3xl font-extrabold text-white">{upcoming.length}</p>
          </div>

          <div className="relative overflow-hidden rounded-2xl p-5 bg-gradient-to-br from-slate-600 to-slate-700 text-white shadow-lg shadow-slate-300/50 fu-card-lift cursor-default">
            <div className="flex items-center gap-2 mb-1">
              <Clock size={14} className="text-white/80" />
              <span className="text-xs font-semibold uppercase tracking-wider text-white/70">No Date</span>
            </div>
            <p className="text-3xl font-extrabold text-white">{noDate.length}</p>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-slate-200/60 shadow-sm shadow-slate-100/50 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="relative flex-1 max-w-md group">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-violet-400 transition-colors" />
            <input
              type="text"
              placeholder="Search follow-ups..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full pl-11 pr-4 py-3 text-sm bg-slate-50/80 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-300 focus:bg-white placeholder:text-slate-300 transition-all"
            />
          </div>
          <DateFilter value={dateRange} onChange={setDateRange} />
          <div className="flex items-center gap-1 bg-slate-50 rounded-xl p-1">
            {[
              { key: 'all', label: 'All' },
              { key: 'hot', label: 'Hot', icon: Flame, color: 'text-red-600' },
              { key: 'warm', label: 'Warm', icon: TrendingUp, color: 'text-amber-600' },
              { key: 'cold', label: 'Cold' },
            ].map(f => {
              const isActive = scoreFilter === f.key;
              return (
                <button
                  key={f.key}
                  onClick={() => setScoreFilter(f.key)}
                  className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  {f.icon && isActive && <f.icon size={11} className={f.color} />}
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm py-20 text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-slate-100 to-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <UserCheck size={24} className="text-slate-300" />
          </div>
          <p className="text-sm font-semibold text-slate-600">No follow-ups</p>
          <p className="text-xs text-slate-400 mt-1.5">Contacted leads will appear here</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((lead, index) => {
            const initials = ((lead.caller_name || 'U').split(' ').map(n => n?.[0] || '').join('').slice(0, 2).toUpperCase()) || '?';
            const days = daysSince(lead.created_at);
            const isOverdue = lead.follow_up_date && lead.follow_up_date <= today;
            const daysLeft = lead.follow_up_date ? daysUntil(lead.follow_up_date) : null;
            const hasNotes = lead.notes || (lead.call_notes && lead.call_notes.length > 0);
            const gradient = getAvatarGradient(lead.score_label);

            return (
              <Link
                key={lead.id}
                to={`/leads/${lead.id}?from=follow-ups`}
                className={`fu-fade-in-up block rounded-2xl border shadow-sm transition-all fu-card-lift group overflow-hidden ${
                  isOverdue
                    ? 'bg-red-50/30 border-red-200/60 hover:border-red-300'
                    : 'bg-white border-slate-100 hover:border-slate-200'
                }`}
                style={{ animationDelay: `${index * 50}ms`, borderLeft: isOverdue ? '4px solid rgb(239, 68, 68)' : undefined }}
              >
                <div className="flex items-center gap-4 px-5 py-4">
                  {/* Avatar */}
                  <div className="relative flex-shrink-0">
                    <div className={`w-11 h-11 bg-gradient-to-br ${gradient} rounded-xl flex items-center justify-center text-xs font-bold text-white shadow-sm`}>
                      {initials}
                    </div>
                    {lead.score_label === 'hot' && (
                      <div className="absolute -top-1 -right-1">
                        <span className="relative flex h-3 w-3">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 border-2 border-white" />
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-slate-900 group-hover:text-violet-600 transition-colors truncate">
                        {lead.caller_name}
                      </p>
                      <ScoreBadge score={lead.score} label={lead.score_label} />
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
                      <span className="capitalize">{lead.case_type}</span>
                      <span className="text-slate-200">|</span>
                      <span>{lead.caller_phone}</span>
                      <span className="text-slate-200">|</span>
                      <span>Contacted {days}d ago</span>
                      {hasNotes && (
                        <>
                          <span className="text-slate-200">|</span>
                          <span className="inline-flex items-center gap-1 text-violet-400">
                            <MessageSquare size={10} />
                            Notes
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Follow-up status */}
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {lead.follow_up_date ? (
                      <div className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg ${
                        isOverdue
                          ? 'bg-red-100 text-red-700 ring-1 ring-red-200'
                          : daysLeft <= 1
                            ? 'bg-amber-100 text-amber-700 ring-1 ring-amber-200'
                            : 'bg-slate-100 text-slate-600'
                      }`}>
                        {isOverdue && (
                          <span className="relative flex h-2 w-2 mr-0.5">
                            <span className="fu-pulse-indicator absolute inline-flex h-full w-full rounded-full bg-red-500" />
                          </span>
                        )}
                        {isOverdue ? <AlertTriangle size={12} /> : <CalendarCheck size={12} />}
                        {isOverdue ? `${Math.abs(daysLeft)}d overdue` : daysLeft === 0 ? 'Today' : daysLeft === 1 ? 'Tomorrow' : `In ${daysLeft}d`}
                      </div>
                    ) : (
                      <span className="flex items-center gap-1.5 text-xs text-slate-300 px-3 py-1.5">
                        <Clock size={12} />
                        No date
                      </span>
                    )}

                    <button
                      onClick={(e) => handleMarkBooked(e, lead.id)}
                      className="px-3.5 py-1.5 text-xs font-semibold text-violet-700 bg-gradient-to-r from-violet-50 to-purple-50 rounded-lg hover:from-violet-100 hover:to-purple-100 transition-all ring-1 ring-violet-200/60 shadow-sm"
                    >
                      Book
                    </button>

                    <ChevronRight size={16} className="text-slate-200 group-hover:text-violet-400 transition-colors" />
                  </div>
                </div>

                {/* AI summary preview */}
                {lead.notes && (
                  <div className="px-5 pb-4 -mt-1">
                    <p className="text-xs text-slate-400 bg-slate-50/80 rounded-lg px-3 py-2 line-clamp-2 leading-relaxed border border-slate-100/50">
                      {lead.notes}
                    </p>
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
