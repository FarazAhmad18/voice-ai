import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { fetchAppointments, updateAppointment } from '../services/api';
import { toast } from 'sonner';
import DateFilter from '../components/DateFilter';
import StatusBadge from '../components/StatusBadge';
import { CalendarCheck, Clock, Phone, User, ChevronRight, CheckCircle, XCircle, AlertCircle, Calendar, Users } from 'lucide-react';

/* ─── Inject keyframe styles once ─── */
const STYLE_ID = '__appointments-premium-styles';
if (typeof document !== 'undefined' && !document.getElementById(STYLE_ID)) {
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    @keyframes aptFadeInUp {
      from { opacity: 0; transform: translateY(16px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes aptShimmer {
      0%   { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }
    .apt-fade-in-up {
      animation: aptFadeInUp 0.4s ease forwards;
      opacity: 0;
    }
    .apt-shimmer {
      background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%);
      background-size: 200% 100%;
      animation: aptShimmer 1.5s ease-in-out infinite;
    }
    .apt-card-lift {
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    }
    .apt-card-lift:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 25px -5px rgba(0,0,0,0.08), 0 4px 10px -6px rgba(0,0,0,0.04);
    }
  `;
  document.head.appendChild(style);
}

const STATUS_TABS = [
  { key: 'all', label: 'All' },
  { key: 'confirmed', label: 'Upcoming' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
];

function getStatusBorderColor(status) {
  if (status === 'confirmed') return 'border-l-violet-500';
  if (status === 'completed') return 'border-l-emerald-500';
  if (status === 'cancelled') return 'border-l-red-400';
  return 'border-l-slate-300';
}

function getTimeBadgeStyle(status) {
  if (status === 'confirmed') return 'bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg shadow-violet-200/50';
  if (status === 'completed') return 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-200/50';
  if (status === 'cancelled') return 'bg-gradient-to-br from-slate-300 to-slate-400 text-white';
  return 'bg-gradient-to-br from-slate-400 to-slate-500 text-white';
}

export default function Appointments() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('all');
  const [dateRange, setDateRange] = useState('all');
  const [actionLoading, setActionLoading] = useState(null);

  async function loadAppointments() {
    setError(null);
    try {
      const data = await fetchAppointments();
      setAppointments(data);
    } catch (err) {
      setError(err.message || 'Failed to fetch appointments');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAppointments();
  }, []);

  async function handleStatusChange(id, newStatus) {
    setActionLoading(id + newStatus);
    try {
      await updateAppointment(id, { status: newStatus });
      setAppointments((prev) =>
        prev.map((apt) => (apt.id === id ? { ...apt, status: newStatus } : apt))
      );
      toast.success(`Appointment marked as ${newStatus}`);
    } catch (err) {
      toast.error('Failed to update appointment');
    } finally {
      setActionLoading(null);
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
      <div className="space-y-6">
        {/* Skeleton header */}
        <div className="flex items-end justify-between">
          <div>
            <div className="h-9 w-48 bg-slate-100 rounded-lg animate-pulse" />
            <div className="flex gap-3 mt-3">
              <div className="h-8 w-24 bg-slate-50 rounded-full animate-pulse" />
              <div className="h-8 w-28 bg-slate-50 rounded-full animate-pulse" />
            </div>
          </div>
        </div>
        {/* Skeleton filter bar */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          <div className="flex gap-2">
            {[1,2,3,4].map(i => (
              <div key={i} className="h-9 w-24 bg-slate-50 rounded-lg animate-pulse" />
            ))}
          </div>
        </div>
        {/* Skeleton cards */}
        <div className="space-y-3">
          {[1,2,3,4,5].map(i => (
            <div key={i} className="bg-white rounded-2xl border border-slate-100 border-l-4 border-l-slate-200 overflow-hidden">
              <div className="flex items-center gap-4 px-5 py-5">
                <div className="hidden sm:block w-20 h-14 apt-shimmer rounded-xl" />
                <div className="flex-1">
                  <div className="h-4 w-36 bg-slate-100 rounded animate-pulse" />
                  <div className="h-3 w-52 bg-slate-50 rounded animate-pulse mt-2" />
                </div>
                <div className="flex gap-2">
                  <div className="h-9 w-24 bg-slate-50 rounded-lg animate-pulse" />
                  <div className="h-9 w-20 bg-slate-50 rounded-lg animate-pulse" />
                </div>
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
              <p className="text-sm font-medium text-red-800">Failed to load appointments</p>
              <p className="text-xs text-red-600 mt-0.5">{error}</p>
            </div>
          </div>
          <button onClick={loadAppointments} className="px-4 py-2 text-xs font-semibold text-red-600 bg-red-100 hover:bg-red-200 rounded-lg transition-colors">
            Retry
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Appointments</h1>
          <div className="flex items-center gap-2.5 mt-3 flex-wrap">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-full">
              <Users size={12} />
              {appointments.length} total
            </span>
            {confirmed > 0 && (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-violet-600 bg-violet-50 border border-violet-100 px-3 py-1.5 rounded-full">
                <CalendarCheck size={12} />
                {confirmed} upcoming
              </span>
            )}
            {completed > 0 && (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 bg-emerald-50 border border-emerald-100 px-3 py-1.5 rounded-full">
                <CheckCircle size={12} />
                {completed} completed
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-slate-200/60 shadow-sm shadow-slate-100/50 p-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-0.5 bg-slate-50 rounded-xl p-1">
            {STATUS_TABS.map((t) => {
              const count = t.key === 'all' ? appointments.length : appointments.filter((a) => a.status === t.key).length;
              const isActive = tab === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-200 flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  {t.label}
                  <span className={`text-[10px] ${isActive ? 'text-slate-500' : 'text-slate-300'}`}>{count}</span>
                </button>
              );
            })}
          </div>
          <DateFilter value={dateRange} onChange={setDateRange} />
        </div>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm py-20 text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-violet-100 to-purple-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <CalendarCheck size={24} className="text-violet-300" />
          </div>
          <p className="text-sm font-semibold text-slate-600">No appointments</p>
          <p className="text-xs text-slate-400 mt-1.5">Booked consultations will appear here</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((apt, index) => {
            const initials = ((apt.caller_name || 'U').split(' ').map(n => n?.[0] || '').join('').slice(0, 2).toUpperCase()) || '?';
            const borderColor = getStatusBorderColor(apt.status);
            const timeBadge = getTimeBadgeStyle(apt.status);

            return (
              <div
                key={apt.id}
                className={`apt-fade-in-up bg-white rounded-2xl border border-slate-100 border-l-4 ${borderColor} shadow-sm apt-card-lift overflow-hidden`}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="flex items-center gap-4 px-5 py-4">
                  {/* Time badge */}
                  <div className={`hidden sm:flex flex-col items-center justify-center rounded-xl px-3.5 py-2.5 min-w-[80px] flex-shrink-0 ${timeBadge}`}>
                    <span className="text-sm font-bold">{apt.appointment_time}</span>
                    <span className="text-[10px] font-medium opacity-80 mt-0.5">{apt.appointment_date}</span>
                  </div>

                  {/* Avatar (mobile) */}
                  <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center text-xs font-bold text-white flex-shrink-0 sm:hidden shadow-sm">
                    {initials}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-slate-900">{apt.caller_name}</p>
                      <StatusBadge status={apt.status} />
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-400 flex-wrap">
                      <span className="capitalize font-medium text-slate-500">{apt.case_type}</span>
                      {apt.caller_phone && (
                        <>
                          <span className="text-slate-200">|</span>
                          <span className="inline-flex items-center gap-1">
                            <Phone size={10} className="text-slate-300" />
                            {apt.caller_phone}
                          </span>
                        </>
                      )}
                      {apt.urgency && apt.urgency !== 'low' && (
                        <>
                          <span className="text-slate-200">|</span>
                          <span className={`inline-flex items-center gap-1 capitalize font-semibold ${apt.urgency === 'high' ? 'text-red-500' : 'text-amber-500'}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${apt.urgency === 'high' ? 'bg-red-500' : 'bg-amber-500'}`} />
                            {apt.urgency} priority
                          </span>
                        </>
                      )}
                      <span className="sm:hidden text-slate-200">|</span>
                      <span className="sm:hidden">{apt.appointment_date} at {apt.appointment_time}</span>
                    </div>
                    {apt.notes && (
                      <p className="text-xs text-slate-400 mt-2 line-clamp-1 bg-slate-50/80 rounded-lg px-2.5 py-1.5 border border-slate-100/50">{apt.notes}</p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {apt.status === 'confirmed' && (
                      <>
                        <button
                          onClick={() => handleStatusChange(apt.id, 'completed')}
                          disabled={actionLoading === apt.id + 'completed'}
                          className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-white bg-gradient-to-r from-emerald-500 to-teal-500 rounded-xl hover:from-emerald-600 hover:to-teal-600 transition-all shadow-sm shadow-emerald-200/50 disabled:opacity-50"
                        >
                          {actionLoading === apt.id + 'completed' ? (
                            <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          ) : (
                            <CheckCircle size={13} />
                          )}
                          Complete
                        </button>
                        <button
                          onClick={() => handleStatusChange(apt.id, 'cancelled')}
                          disabled={actionLoading === apt.id + 'cancelled'}
                          className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-red-600 bg-red-50 rounded-xl hover:bg-red-100 transition-all ring-1 ring-red-200/60 disabled:opacity-50"
                        >
                          {actionLoading === apt.id + 'cancelled' ? (
                            <div className="w-3.5 h-3.5 border-2 border-red-300 border-t-red-600 rounded-full animate-spin" />
                          ) : (
                            <XCircle size={13} />
                          )}
                          Cancel
                        </button>
                      </>
                    )}
                    {apt.lead_id && (
                      <Link to={`/leads/${apt.lead_id}`} className="p-2.5 hover:bg-slate-50 rounded-xl transition-colors group/link">
                        <ChevronRight size={16} className="text-slate-300 group-hover/link:text-violet-400 transition-colors" />
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
