import { useState, useEffect } from 'react';
import { fetchAppointments, updateAppointment } from '../services/api';
import DateFilter from '../components/DateFilter';
import { CalendarCheck } from 'lucide-react';

const STATUS_TABS = [
  { key: 'all', label: 'All' },
  { key: 'confirmed', label: 'Upcoming' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
];

export default function Appointments() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('all');
  const [dateRange, setDateRange] = useState('all');

  useEffect(() => {
    async function loadAppointments() {
      try {
        const data = await fetchAppointments();
        setAppointments(data);
      } catch (err) {
        console.error('Failed to fetch appointments:', err);
      } finally {
        setLoading(false);
      }
    }
    loadAppointments();
  }, []);

  async function handleStatusChange(id, newStatus) {
    try {
      await updateAppointment(id, { status: newStatus });
      setAppointments((prev) =>
        prev.map((apt) => (apt.id === id ? { ...apt, status: newStatus } : apt))
      );
    } catch (err) {
      console.error('Failed to update appointment:', err);
    }
  }

  let filtered = appointments.filter((a) => tab === 'all' || a.status === tab);
  if (dateRange !== 'all') {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    filtered = filtered.filter((a) => {
      const created = new Date(a.created_at);
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 bg-slate-50 rounded-xl p-1">
          {STATUS_TABS.map((t) => {
            const count = t.key === 'all' ? appointments.length : appointments.filter((a) => a.status === t.key).length;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                  tab === t.key
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                {t.label}
                <span className={`text-[10px] ${tab === t.key ? 'text-slate-500' : 'text-slate-300'}`}>{count}</span>
              </button>
            );
          })}
        </div>
        <DateFilter value={dateRange} onChange={setDateRange} />
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 py-16 text-center">
          <CalendarCheck size={24} className="text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-400">No appointments</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 divide-y divide-slate-50">
          {filtered.map((apt) => {
            const initials = apt.caller_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
            const statusDot = apt.status === 'confirmed' ? 'bg-slate-900' : apt.status === 'completed' ? 'bg-emerald-500' : 'bg-red-400';
            return (
              <div key={apt.id} className="flex items-center justify-between px-5 py-4">
                {/* Left: avatar + info */}
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-9 h-9 bg-slate-100 rounded-full flex items-center justify-center text-xs font-semibold text-slate-600 flex-shrink-0">
                    {initials}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900">{apt.caller_name}</p>
                    <p className="text-xs text-slate-400 capitalize">{apt.case_type} · {apt.caller_phone}</p>
                  </div>
                </div>

                {/* Center: date + time */}
                <div className="hidden sm:flex items-center gap-6 text-sm">
                  <span className="text-slate-700 font-medium">{apt.appointment_date}</span>
                  <span className="text-slate-400">{apt.appointment_time}</span>
                  <span className="text-xs text-slate-400 capitalize">{apt.urgency}</span>
                </div>

                {/* Right: status + actions */}
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 capitalize">
                    <span className={`w-1.5 h-1.5 rounded-full ${statusDot}`} />
                    {apt.status}
                  </span>
                  {apt.status === 'confirmed' && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleStatusChange(apt.id, 'completed')}
                        className="px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors"
                      >
                        Complete
                      </button>
                      <button
                        onClick={() => handleStatusChange(apt.id, 'cancelled')}
                        className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
