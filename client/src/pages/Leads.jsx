import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { fetchLeads } from '../services/api';
import ScoreBadge from '../components/ScoreBadge';
import StatusBadge from '../components/StatusBadge';
import { Search, Filter, PhoneIncoming, ChevronRight } from 'lucide-react';

const FILTERS = [
  { key: 'all', label: 'All Leads' },
  { key: 'hot', label: 'Hot' },
  { key: 'warm', label: 'Warm' },
  { key: 'cold', label: 'Cold' },
  { key: 'new', label: 'New' },
  { key: 'booked', label: 'Booked' },
];

export default function Leads() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

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

  const filteredLeads = leads
    .filter((l) => filter === 'all' || l.score_label === filter || l.status === filter)
    .filter((l) => !search || l.caller_name?.toLowerCase().includes(search.toLowerCase()) || l.caller_phone?.includes(search));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-sm text-slate-400">Loading leads...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Leads</h1>
          <p className="text-sm text-slate-400 mt-1">{leads.length} total leads from AI intake calls</p>
        </div>
        {/* Search */}
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full sm:w-72 pl-9 pr-4 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
          />
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 mb-5 overflow-x-auto pb-1">
        <Filter size={14} className="text-slate-400 mr-1 flex-shrink-0" />
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all duration-200 ${
              filter === f.key
                ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/25'
                : 'bg-white text-slate-500 border border-slate-200 hover:border-slate-300 hover:text-slate-700'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filteredLeads.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-12 text-center">
          <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <PhoneIncoming size={24} className="text-slate-400" />
          </div>
          <p className="text-base font-semibold text-slate-700">No leads found</p>
          <p className="text-sm text-slate-400 mt-1">
            {filter !== 'all' || search
              ? 'Try adjusting your filters or search query.'
              : 'When someone calls Sarah, leads will appear here.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left px-5 py-3.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">Client</th>
                <th className="text-left px-5 py-3.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">Phone</th>
                <th className="text-left px-5 py-3.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">Case Type</th>
                <th className="text-left px-5 py-3.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">Score</th>
                <th className="text-left px-5 py-3.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">Status</th>
                <th className="text-left px-5 py-3.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">Date</th>
                <th className="px-3 py-3.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLeads.map((lead) => (
                <tr key={lead.id} className="hover:bg-slate-50/70 transition-colors group">
                  <td className="px-5 py-3.5">
                    <Link to={`/leads/${lead.id}`} className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-gradient-to-br from-slate-100 to-slate-200 rounded-full flex items-center justify-center text-[10px] font-bold text-slate-600">
                        {lead.caller_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">{lead.caller_name}</p>
                        {lead.caller_email && (
                          <p className="text-[11px] text-slate-400">{lead.caller_email}</p>
                        )}
                      </div>
                    </Link>
                  </td>
                  <td className="px-5 py-3.5 text-sm text-slate-600">{lead.caller_phone}</td>
                  <td className="px-5 py-3.5 text-sm text-slate-600 capitalize">{lead.case_type}</td>
                  <td className="px-5 py-3.5"><ScoreBadge score={lead.score} label={lead.score_label} /></td>
                  <td className="px-5 py-3.5"><StatusBadge status={lead.status} /></td>
                  <td className="px-5 py-3.5 text-sm text-slate-400">
                    {new Date(lead.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-3 py-3.5">
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
