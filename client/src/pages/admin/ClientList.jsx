import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { fetchFirms } from '../../services/api';
import { Building2, Search, Plus, ChevronRight } from 'lucide-react';

export default function ClientList() {
  const [firms, setFirms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

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
    .filter(f => !search || f.name?.toLowerCase().includes(search.toLowerCase()) || f.industry?.toLowerCase().includes(search.toLowerCase()));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-6 h-6 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
            <input
              type="text"
              placeholder="Search clients..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-64 pl-9 pr-3 py-2 text-sm bg-white border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-200 placeholder:text-slate-300"
            />
          </div>
          <div className="flex items-center gap-1 bg-slate-50 rounded-xl p-1">
            {['all', 'active', 'paused', 'cancelled'].map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize ${
                  statusFilter === s ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
        <Link
          to="/admin/clients/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-xl hover:bg-slate-800 transition-colors"
        >
          <Plus size={15} />
          New Client
        </Link>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 py-16 text-center">
          <Building2 size={28} className="text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-500">No clients found</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-50">
                <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Client</th>
                <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Industry</th>
                <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Agent</th>
                <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Leads</th>
                <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Staff</th>
                <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Status</th>
                <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Plan</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map((firm) => (
                <tr key={firm.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-5 py-3">
                    <Link to={`/admin/clients/${firm.id}`} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white" style={{ backgroundColor: firm.brand_color || '#6d28d9' }}>
                        {firm.name?.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <span className="text-sm font-medium text-slate-800 group-hover:text-blue-600 transition-colors">{firm.name}</span>
                        <p className="text-xs text-slate-400">{firm.email || 'No email'}</p>
                      </div>
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-sm text-slate-500 capitalize">{firm.industry}</td>
                  <td className="px-5 py-3">
                    <span className="text-sm text-slate-500">{firm.agent_name || '—'}</span>
                    {firm.retell_agent_id && <span className="ml-1.5 w-1.5 h-1.5 bg-emerald-500 rounded-full inline-block" />}
                  </td>
                  <td className="px-5 py-3 text-sm font-medium text-slate-700">{firm._counts?.leads || 0}</td>
                  <td className="px-5 py-3 text-sm text-slate-500">{firm._counts?.staff || 0}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${
                      firm.status === 'active' ? 'bg-emerald-50 text-emerald-700' :
                      firm.status === 'paused' ? 'bg-amber-50 text-amber-700' :
                      'bg-slate-50 text-slate-500'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        firm.status === 'active' ? 'bg-emerald-500' :
                        firm.status === 'paused' ? 'bg-amber-500' :
                        'bg-slate-400'
                      }`} />
                      {firm.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-sm text-slate-400 capitalize">{firm.plan || 'free'}</td>
                  <td className="px-3 py-3">
                    <Link to={`/admin/clients/${firm.id}`}>
                      <ChevronRight size={14} className="text-slate-300 group-hover:text-blue-500 transition-colors" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-slate-400 text-right">{filtered.length} client{filtered.length !== 1 ? 's' : ''}</p>
    </div>
  );
}
