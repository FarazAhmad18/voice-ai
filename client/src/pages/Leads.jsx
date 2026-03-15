import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { fetchLeads } from '../services/api';
import ScoreBadge from '../components/ScoreBadge';
import StatusBadge from '../components/StatusBadge';
import DateFilter from '../components/DateFilter';
import { Search, Download, PhoneIncoming, ChevronRight, ArrowRight, Users, Flame, Filter } from 'lucide-react';

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

export default function Leads() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pipeline, setPipeline] = useState('all');
  const [scoreFilter, setScoreFilter] = useState('all_scores');
  const [dateRange, setDateRange] = useState('all');
  const [search, setSearch] = useState('');
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const q = searchParams.get('search');
    if (q) setSearch(q);
    const s = searchParams.get('status');
    if (s && PIPELINE.find(p => p.key === s)) setPipeline(s);
    const sc = searchParams.get('score');
    if (sc && SCORE_FILTERS.find(f => f.key === sc)) setScoreFilter(sc);
  }, [searchParams]);

  useEffect(() => {
    async function loadLeads() {
      try {
        const data = await fetchLeads();
        setLeads(data);
      } catch (err) {
        console.error('Failed to fetch leads:', err);
      } finally {
        setLoading(false);
      }
    }
    loadLeads();
  }, []);

  const visibleLeads = leads.filter(l => l.status !== 'contacted');

  let filtered = visibleLeads
    .filter((l) => pipeline === 'all' || l.status === pipeline)
    .filter((l) => scoreFilter === 'all_scores' || l.score_label === scoreFilter)
    .filter((l) => !search || l.caller_name?.toLowerCase().includes(search.toLowerCase()) || l.caller_phone?.includes(search));
  filtered = filterByDate(filtered, dateRange);

  const followUpCount = leads.filter(l => l.status === 'contacted').length;
  const hotCount = visibleLeads.filter(l => l.score_label === 'hot').length;

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
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Leads</h1>
          <div className="flex items-center gap-4 mt-2">
            <span className="text-sm text-slate-400">{visibleLeads.length} total</span>
            {hotCount > 0 && (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-600 bg-red-50 px-2.5 py-1 rounded-full">
                <Flame size={11} />
                {hotCount} hot
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {followUpCount > 0 && (
            <Link
              to="/follow-ups"
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-amber-700 bg-amber-50 border border-amber-100 rounded-xl hover:bg-amber-100 transition-colors shadow-sm"
            >
              {followUpCount} Follow Up{followUpCount !== 1 ? 's' : ''}
              <ArrowRight size={14} />
            </Link>
          )}
          <button
            onClick={() => exportToCSV(filtered)}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors shadow-sm"
          >
            <Download size={15} />
            Export
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm shadow-slate-100/50 p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300" />
            <input
              type="text"
              placeholder="Search by name or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-3 py-2.5 text-sm bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-200 focus:border-slate-200 placeholder:text-slate-300 transition-all"
            />
          </div>
          <DateFilter value={dateRange} onChange={setDateRange} />
        </div>

        <div className="flex items-center justify-between gap-3 flex-wrap">
          {/* Pipeline tabs */}
          <div className="flex items-center gap-1 bg-slate-50 rounded-xl p-1">
            {PIPELINE.map((p) => {
              const count = p.key === 'all' ? visibleLeads.length : visibleLeads.filter((l) => l.status === p.key).length;
              return (
                <button
                  key={p.key}
                  onClick={() => setPipeline(p.key)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                    pipeline === p.key
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  {p.label}
                  <span className={`text-[10px] ${pipeline === p.key ? 'text-slate-500' : 'text-slate-300'}`}>
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
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  scoreFilter === f.key
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                }`}
              >
                {f.label}
              </button>
            ))}
            <span className="ml-2 text-xs text-slate-300">{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>
          </div>
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm py-16 text-center">
          <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <PhoneIncoming size={22} className="text-slate-300" />
          </div>
          <p className="text-sm font-medium text-slate-600">No leads found</p>
          <p className="text-xs text-slate-400 mt-1">Try adjusting your filters or wait for new calls</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm shadow-slate-100/50 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="text-left px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Client</th>
                <th className="text-left px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 hidden sm:table-cell">Phone</th>
                <th className="text-left px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 hidden md:table-cell">Case</th>
                <th className="text-left px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Score</th>
                <th className="text-left px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 hidden sm:table-cell">Status</th>
                <th className="text-left px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 hidden lg:table-cell">When</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map((lead) => {
                const initials = lead.caller_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
                return (
                  <tr key={lead.id} className="hover:bg-slate-50/70 transition-colors group">
                    <td className="px-5 py-3.5">
                      <Link to={`/leads/${lead.id}`} className="flex items-center gap-3">
                        <div className="relative">
                          <div className="w-9 h-9 bg-slate-100 rounded-full flex items-center justify-center text-[10px] font-semibold text-slate-600 group-hover:bg-slate-200 transition-colors">
                            {initials}
                          </div>
                          {lead.score_label === 'hot' && (
                            <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white" />
                          )}
                        </div>
                        <div>
                          <span className="text-sm font-medium text-slate-800 group-hover:text-blue-600 transition-colors">{lead.caller_name}</span>
                          {lead.urgency === 'high' && (
                            <span className="ml-2 text-[10px] font-medium text-red-500 bg-red-50 px-1.5 py-0.5 rounded">Urgent</span>
                          )}
                        </div>
                      </Link>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-slate-500 hidden sm:table-cell">{lead.caller_phone}</td>
                    <td className="px-5 py-3.5 text-sm text-slate-500 capitalize hidden md:table-cell">{lead.case_type}</td>
                    <td className="px-5 py-3.5"><ScoreBadge score={lead.score} label={lead.score_label} /></td>
                    <td className="px-5 py-3.5 hidden sm:table-cell"><StatusBadge status={lead.status} /></td>
                    <td className="px-5 py-3.5 text-xs text-slate-400 hidden lg:table-cell">{formatRelativeTime(lead.created_at)}</td>
                    <td className="px-3 py-3.5">
                      <Link to={`/leads/${lead.id}`}>
                        <ChevronRight size={16} className="text-slate-200 group-hover:text-blue-500 transition-colors" />
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
