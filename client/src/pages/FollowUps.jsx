import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { fetchLeads, updateLead } from '../services/api';
import { toast } from 'sonner';
import ScoreBadge from '../components/ScoreBadge';
import DateFilter from '../components/DateFilter';
import {
  Search, UserCheck, ChevronRight, CalendarCheck, Clock,
  AlertTriangle, ArrowUpRight, Phone, MessageSquare,
} from 'lucide-react';

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

export default function FollowUps() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dateRange, setDateRange] = useState('all');
  const [scoreFilter, setScoreFilter] = useState('all');

  useEffect(() => {
    async function loadLeads() {
      try {
        const data = await fetchLeads();
        setLeads(data.filter(l => l.status === 'contacted'));
      } catch (err) {
        console.error('Failed to fetch leads:', err);
      } finally {
        setLoading(false);
      }
    }
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
      <div className="flex items-center justify-center h-96">
        <div className="w-8 h-8 border-[3px] border-slate-200 border-t-slate-900 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Follow Ups</h1>
          <span className="text-sm font-semibold text-amber-600 bg-amber-50 px-3 py-1 rounded-full">
            {leads.length}
          </span>
        </div>
        <p className="text-sm text-slate-400 mt-1.5">
          Leads you've contacted that need follow-up action
        </p>
      </div>

      {/* Summary cards */}
      {leads.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className={`rounded-xl p-4 border ${overdue.length > 0 ? 'bg-red-50 border-red-100' : 'bg-slate-50 border-slate-100'}`}>
            <p className={`text-2xl font-bold ${overdue.length > 0 ? 'text-red-600' : 'text-slate-300'}`}>{overdue.length}</p>
            <p className={`text-xs font-medium mt-1 ${overdue.length > 0 ? 'text-red-500' : 'text-slate-400'}`}>Overdue</p>
          </div>
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
            <p className="text-2xl font-bold text-amber-600">{upcoming.length}</p>
            <p className="text-xs font-medium text-amber-500 mt-1">Scheduled</p>
          </div>
          <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
            <p className="text-2xl font-bold text-slate-500">{noDate.length}</p>
            <p className="text-xs font-medium text-slate-400 mt-1">No Date Set</p>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm shadow-slate-100/50 p-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300" />
            <input
              type="text"
              placeholder="Search follow-ups..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-3 py-2.5 text-sm bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-200 focus:border-slate-200 placeholder:text-slate-300 transition-all"
            />
          </div>
          <DateFilter value={dateRange} onChange={setDateRange} />
          <div className="flex items-center gap-1.5">
            {[
              { key: 'all', label: 'All' },
              { key: 'hot', label: 'Hot' },
              { key: 'warm', label: 'Warm' },
              { key: 'cold', label: 'Cold' },
            ].map(f => (
              <button
                key={f.key}
                onClick={() => setScoreFilter(f.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  scoreFilter === f.key
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm py-16 text-center">
          <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <UserCheck size={22} className="text-slate-300" />
          </div>
          <p className="text-sm font-medium text-slate-600">No follow-ups</p>
          <p className="text-xs text-slate-400 mt-1">Contacted leads will appear here</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((lead) => {
            const initials = lead.caller_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
            const days = daysSince(lead.created_at);
            const isOverdue = lead.follow_up_date && lead.follow_up_date <= today;
            const daysLeft = lead.follow_up_date ? daysUntil(lead.follow_up_date) : null;
            const hasNotes = lead.notes || (lead.call_notes && lead.call_notes.length > 0);

            return (
              <Link
                key={lead.id}
                to={`/leads/${lead.id}`}
                state={{ from: 'follow-ups' }}
                className={`block bg-white rounded-xl border shadow-sm transition-all hover:shadow-md group ${
                  isOverdue ? 'border-red-200 hover:border-red-300' : 'border-slate-100 hover:border-slate-200'
                }`}
              >
                <div className="flex items-center gap-4 px-5 py-4">
                  {/* Avatar */}
                  <div className="relative flex-shrink-0">
                    <div className="w-11 h-11 bg-slate-100 rounded-full flex items-center justify-center text-xs font-semibold text-slate-600 group-hover:bg-slate-200 transition-colors">
                      {initials}
                    </div>
                    {lead.score_label === 'hot' && (
                      <div className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-red-500 rounded-full border-2 border-white" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-slate-900 group-hover:text-blue-600 transition-colors truncate">
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
                          <span className="inline-flex items-center gap-1 text-blue-400">
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
                      <div className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg ${
                        isOverdue
                          ? 'bg-red-50 text-red-600 ring-1 ring-red-100'
                          : daysLeft <= 1
                            ? 'bg-amber-50 text-amber-600'
                            : 'bg-slate-50 text-slate-500'
                      }`}>
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
                      className="px-3 py-1.5 text-xs font-medium text-violet-700 bg-violet-50 rounded-lg hover:bg-violet-100 transition-colors ring-1 ring-violet-100"
                    >
                      Book
                    </button>

                    <ChevronRight size={16} className="text-slate-200 group-hover:text-slate-400 transition-colors" />
                  </div>
                </div>

                {/* AI summary preview */}
                {lead.notes && (
                  <div className="px-5 pb-4 -mt-1">
                    <p className="text-xs text-slate-400 bg-slate-50 rounded-lg px-3 py-2 line-clamp-2 leading-relaxed">
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
