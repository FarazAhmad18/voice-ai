import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { fetchAppointments, updateAppointment } from '../services/api';
import { toast } from 'sonner';
import DateFilter from '../components/DateFilter';
import StatusBadge from '../components/StatusBadge';
import { CalendarCheck, Clock, Phone, User, ChevronRight, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

const STATUS_TABS = [
  { key: 'all', label: 'All' },
  { key: 'confirmed', label: 'Upcoming' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
];

export default function Appointments() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('all');
  const [dateRange, setDateRange] = useState('all');

  async function loadAppointments() {
    setError(null);
    try {
      const data = await fetchAppointments();
      setAppointments(data);
    } catch (err) {
      console.error('Failed to fetch appointments:', err);
      setError(err.message || 'Failed to fetch appointments');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAppointments();
  }, []);

  async function handleStatusChange(id, newStatus) {
    try {
      await updateAppointment(id, { status: newStatus });
      setAppointments((prev) =>
        prev.map((apt) => (apt.id === id ? { ...apt, status: newStatus } : apt))
      );
      toast.success(`Appointment marked as ${newStatus}`);
    } catch (err) {
      toast.error('Failed to update appointment');
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

  const confirmed = appointments.filter(a => a.status === 'confirmed').length;
  const completed = appointments.filter(a => a.status === 'completed').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-8 h-8 border-[3px] border-slate-200 border-t-slate-900 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="text-red-500" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
          <button onClick={loadAppointments} className="text-xs font-medium text-red-600 hover:text-red-700">
            Retry
          </button>
        </div>
      )}
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Appointments</h1>
          <div className="flex items-center gap-4 mt-2">
            <span className="text-sm text-slate-400">{appointments.length} total</span>
            {confirmed > 0 && (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-violet-600 bg-violet-50 px-2.5 py-1 rounded-full">
                <CalendarCheck size={11} />
                {confirmed} upcoming
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm shadow-slate-100/50 p-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
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
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm py-16 text-center">
          <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <CalendarCheck size={22} className="text-slate-300" />
          </div>
          <p className="text-sm font-medium text-slate-600">No appointments</p>
          <p className="text-xs text-slate-400 mt-1">Booked consultations will appear here</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((apt) => {
            const initials = ((apt.caller_name || 'U').split(' ').map(n => n?.[0] || '').join('').slice(0, 2).toUpperCase()) || '?';
            return (
              <div
                key={apt.id}
                className="bg-white rounded-xl border border-slate-100 shadow-sm hover:shadow-md hover:border-slate-200 transition-all overflow-hidden"
              >
                <div className="flex items-center gap-4 px-5 py-4">
                  {/* Time badge */}
                  <div className="hidden sm:flex flex-col items-center justify-center bg-violet-50 rounded-xl px-3 py-2 min-w-[72px] flex-shrink-0">
                    <span className="text-sm font-bold text-violet-700">{apt.appointment_time}</span>
                    <span className="text-[10px] text-violet-400 font-medium">{apt.appointment_date}</span>
                  </div>

                  {/* Avatar */}
                  <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-xs font-semibold text-slate-600 flex-shrink-0 sm:hidden">
                    {initials}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-slate-900">{apt.caller_name}</p>
                      <StatusBadge status={apt.status} />
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-400 flex-wrap">
                      <span className="capitalize">{apt.case_type}</span>
                      {apt.caller_phone && (
                        <>
                          <span className="text-slate-200">|</span>
                          <span className="inline-flex items-center gap-1">
                            <Phone size={10} />
                            {apt.caller_phone}
                          </span>
                        </>
                      )}
                      {apt.urgency && apt.urgency !== 'low' && (
                        <>
                          <span className="text-slate-200">|</span>
                          <span className={`capitalize font-medium ${apt.urgency === 'high' ? 'text-red-500' : 'text-amber-500'}`}>
                            {apt.urgency} priority
                          </span>
                        </>
                      )}
                      <span className="sm:hidden text-slate-200">|</span>
                      <span className="sm:hidden">{apt.appointment_date} at {apt.appointment_time}</span>
                    </div>
                    {apt.notes && (
                      <p className="text-xs text-slate-400 mt-1.5 line-clamp-1">{apt.notes}</p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {apt.status === 'confirmed' && (
                      <>
                        <button
                          onClick={() => handleStatusChange(apt.id, 'completed')}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors ring-1 ring-emerald-100"
                        >
                          <CheckCircle size={13} />
                          Complete
                        </button>
                        <button
                          onClick={() => handleStatusChange(apt.id, 'cancelled')}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors ring-1 ring-red-100"
                        >
                          <XCircle size={13} />
                          Cancel
                        </button>
                      </>
                    )}
                    {apt.lead_id && (
                      <Link to={`/leads/${apt.lead_id}`} className="p-2 hover:bg-slate-50 rounded-lg transition-colors">
                        <ChevronRight size={16} className="text-slate-300 hover:text-slate-500" />
                      </Link>
                    )}
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
