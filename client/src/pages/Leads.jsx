import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { fetchLeads } from '../services/api';
import ScoreBadge from '../components/ScoreBadge';
import StatusBadge from '../components/StatusBadge';
import DateFilter from '../components/DateFilter';
import { Search, Download, PhoneIncoming, ChevronRight } from 'lucide-react';

const PIPELINE = [
  { key: 'all', label: 'All' },
  { key: 'new', label: 'New' },
  { key: 'contacted', label: 'Contacted' },
  { key: 'booked', label: 'Booked' },
  { key: 'converted', label: 'Converted' },
  { key: 'closed', label: 'Closed' },
];

const SCORE_FILTERS = [
  { key: 'all_scores', label: 'All Scores' },
  { key: 'hot', label: 'Hot' },
  { key: 'warm', label: 'Warm' },
  { key: 'cold', label: 'Cold' },
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

  let filtered = leads
    .filter((l) => pipeline === 'all' || l.status === pipeline)
    .filter((l) => scoreFilter === 'all_scores' || l.score_label === scoreFilter)
    .filter((l) => !search || l.caller_name?.toLowerCase().includes(search.toLowerCase()) || l.caller_phone?.includes(search));
  filtered = filterByDate(filtered, dateRange);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-6 h-6 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      {/* Controls row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
            <input
              type="text"
              placeholder="Search leads..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-64 pl-9 pr-3 py-2 text-sm bg-white border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-200 placeholder:text-slate-300"
            />
          </div>
          <DateFilter value={dateRange} onChange={setDateRange} />
        </div>
        <button
          onClick={() => exportToCSV(filtered)}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-100 rounded-xl hover:bg-slate-50 transition-colors"
        >
          <Download size={15} />
          Export CSV
        </button>
      </div>

      {/* Pipeline tabs */}
      <div className="flex items-center gap-1 bg-slate-50 rounded-xl p-1">
        {PIPELINE.map((p) => {
          const count = p.key === 'all' ? leads.length : leads.filter((l) => l.status === p.key).length;
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
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
              scoreFilter === f.key
                ? 'bg-slate-900 text-white'
                : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
            }`}
          >
            {f.label}
          </button>
        ))}
        <span className="ml-auto text-xs text-slate-400">{filtered.length} lead{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 py-16 text-center">
          <PhoneIncoming size={28} className="text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-500">No leads found</p>
          <p className="text-xs text-slate-400 mt-1">Try adjusting your filters</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-50">
                <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Client</th>
                <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Phone</th>
                <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Case</th>
                <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Score</th>
                <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Status</th>
                <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Date</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map((lead) => (
                <tr key={lead.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-5 py-3">
                    <Link to={`/leads/${lead.id}`} className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-[10px] font-semibold text-slate-600">
                        {lead.caller_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      <span className="text-sm font-medium text-slate-800 group-hover:text-blue-600 transition-colors">{lead.caller_name}</span>
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-sm text-slate-500">{lead.caller_phone}</td>
                  <td className="px-5 py-3 text-sm text-slate-500 capitalize">{lead.case_type}</td>
                  <td className="px-5 py-3"><ScoreBadge score={lead.score} label={lead.score_label} /></td>
                  <td className="px-5 py-3"><StatusBadge status={lead.status} /></td>
                  <td className="px-5 py-3 text-sm text-slate-400">{new Date(lead.created_at).toLocaleDateString()}</td>
                  <td className="px-3 py-3">
                    <Link to={`/leads/${lead.id}`}>
                      <ChevronRight size={14} className="text-slate-300 group-hover:text-blue-500 transition-colors" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
