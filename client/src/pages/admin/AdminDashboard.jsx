import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { fetchFirms, fetchLogs } from '../../services/api';
import { Building2, Users, Phone, AlertTriangle, ChevronRight, Activity } from 'lucide-react';

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
        console.error('Failed to load admin dashboard:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-6 h-6 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const totalLeads = firms.reduce((sum, f) => sum + (f._counts?.leads || 0), 0);
  const totalAppointments = firms.reduce((sum, f) => sum + (f._counts?.appointments || 0), 0);
  const activeClients = firms.filter(f => f.status === 'active').length;
  const totalErrors = Object.values(errorCounts).reduce((sum, c) => sum + c, 0);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900 tracking-tight">Admin Dashboard</h2>
        <p className="text-sm text-slate-400 mt-1">Platform overview across all clients</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Building2} label="Active Clients" value={activeClients} total={firms.length} color="blue" />
        <StatCard icon={Users} label="Total Leads" value={totalLeads} color="green" />
        <StatCard icon={Phone} label="Appointments" value={totalAppointments} color="purple" />
        <Link to="/admin/logs?level=error" className="block">
          <StatCard icon={AlertTriangle} label="Errors (24h)" value={totalErrors} color={totalErrors > 0 ? 'red' : 'slate'} />
        </Link>
      </div>

      {/* Client List */}
      <div className="bg-white rounded-2xl border border-slate-100">
        <div className="px-5 py-4 border-b border-slate-50 flex justify-between items-center">
          <h3 className="text-sm font-semibold text-slate-800">Clients</h3>
          <Link to="/admin/clients/new" className="px-4 py-2 bg-slate-900 text-white text-xs font-medium rounded-xl hover:bg-slate-800 transition-colors">
            + New Client
          </Link>
        </div>
        {firms.length === 0 ? (
          <div className="py-12 text-center">
            <Building2 size={24} className="text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-400">No clients yet</p>
            <Link to="/admin/clients/new" className="text-sm text-blue-600 mt-2 inline-block">Create your first client</Link>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {firms.map((firm) => (
              <Link key={firm.id} to={`/admin/clients/${firm.id}`} className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50/50 transition-colors group">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold text-white" style={{ backgroundColor: firm.brand_color || '#6d28d9' }}>
                    {firm.name?.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-800">{firm.name}</p>
                    <p className="text-xs text-slate-400 capitalize">{firm.industry} · {firm.retell_phone_number || 'No phone'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right hidden sm:block">
                    <p className="text-sm font-medium text-slate-700">{firm._counts?.leads || 0} leads</p>
                    <p className="text-xs text-slate-400">{firm._counts?.staff || 0} staff</p>
                  </div>
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
                  <ChevronRight size={14} className="text-slate-300 group-hover:text-slate-500" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Error Summary */}
      {totalErrors > 0 && (
        <div className="bg-red-50 rounded-2xl border border-red-100 p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={16} className="text-red-600" />
            <h3 className="text-sm font-semibold text-red-800">Errors in last 24 hours</h3>
          </div>
          <div className="flex flex-wrap gap-3">
            {Object.entries(errorCounts).map(([cat, count]) => (
              <span key={cat} className="px-3 py-1.5 bg-white rounded-lg text-xs font-medium text-red-700">
                {cat}: {count}
              </span>
            ))}
          </div>
          <Link to="/admin/logs?level=error" className="text-xs text-red-600 font-medium mt-3 inline-block">View all errors →</Link>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, total, color }) {
  const colors = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-emerald-50 text-emerald-600',
    purple: 'bg-violet-50 text-violet-600',
    red: 'bg-red-50 text-red-600',
    slate: 'bg-slate-50 text-slate-600',
  };

  return (
    <div className="bg-white rounded-2xl p-5 border border-slate-100">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${colors[color]}`}>
        <Icon size={18} />
      </div>
      <p className="text-2xl font-semibold text-slate-900 tracking-tight">
        {value}
        {total !== undefined && <span className="text-sm text-slate-400 font-normal"> / {total}</span>}
      </p>
      <p className="text-sm text-slate-400 mt-1">{label}</p>
    </div>
  );
}
