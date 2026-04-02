import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { fetchAppointments, updateAppointment, fetchStaff } from '../services/api';
import { toast } from 'sonner';
import DateFilter from '../components/DateFilter';
import StatusBadge from '../components/StatusBadge';
import ConfirmModal from '../components/ConfirmModal';
import { getStaffColor } from '../components/calendar/calendarUtils';
import { CalendarCheck, Clock, Phone, ChevronRight, CheckCircle, XCircle, AlertCircle, Users } from 'lucide-react';

const STATUS_TABS = [
  { key: 'all', label: 'All' },
  { key: 'confirmed', label: 'Upcoming' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
];

export default function Appointments() {
  const [appointments, setAppointments] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('all');
  const [dateRange, setDateRange] = useState('all');
  const [actionLoading, setActionLoading] = useState(null);
  const [confirmCancel, setConfirmCancel] = useState(null);

  const staffMap = useMemo(() => {
    const map = {};
    staff.forEach(s => { map[s.id] = s; });
    return map;
  }, [staff]);

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
    fetchStaff().then(data => setStaff(Array.isArray(data) ? data : [])).catch(() => {});
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

  // Filter by tab
  let filtered = appointments.filter((a) => tab === 'all' || a.status === tab);

  // Filter by date range
  if (dateRange !== 'all') {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    filtered = filtered.filter((a) => {
      const aptDate = a.appointment_date ? new Date(a.appointment_date + 'T00:00:00') : new Date(a.created_at);
      if (dateRange === 'today') return aptDate >= today && aptDate < new Date(today.getTime() + 86400000);
      if (dateRange === 'week') {
        const weekAgo = new Date(today); weekAgo.setDate(weekAgo.getDate() - 7);
        return aptDate >= weekAgo;
      }
      if (dateRange === 'month') {
        const monthAgo = new Date(today); monthAgo.setMonth(monthAgo.getMonth() - 1);
        return aptDate >= monthAgo;
      }
      return true;
    });
  }

  // Sort: upcoming → newest first (today on top), past → newest first
  filtered.sort((a, b) => {
    const aConfirmed = a.status === 'confirmed';
    const bConfirmed = b.status === 'confirmed';
    if (aConfirmed && !bConfirmed) return -1;
    if (!aConfirmed && bConfirmed) return 1;
    // Both same group: newest date first (descending)
    return (b.appointment_date || '').localeCompare(a.appointment_date || '');
  });

  const confirmed = appointments.filter(a => a.status === 'confirmed').length;
  const completed = appointments.filter(a => a.status === 'completed').length;
  const todayStr = new Date().toISOString().split('T')[0];

  // Group for "All" tab: upcoming section + past section
  const upcomingFiltered = filtered.filter(a => a.status === 'confirmed');
  const pastFiltered = filtered.filter(a => a.status !== 'confirmed');

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="h-8 w-48 bg-slate-100 dark:bg-zinc-800/50 rounded-lg animate-pulse" />
        <div className="bg-white dark:bg-zinc-900 rounded-lg border border-slate-100 dark:border-zinc-800 p-4">
          <div className="flex gap-2">
            {[1,2,3,4].map(i => <div key={i} className="h-8 w-20 bg-slate-50 dark:bg-zinc-900 rounded-lg animate-pulse" />)}
          </div>
        </div>
        <div className="space-y-2">
          {[1,2,3,4,5].map(i => <div key={i} className="h-20 bg-white dark:bg-zinc-900 rounded-lg border border-slate-100 dark:border-zinc-800 skeleton-shimmer" />)}
        </div>
      </div>
    );
  }

  function renderAppointmentRow(apt) {
    const staffMember = apt.assigned_staff_id ? staffMap[apt.assigned_staff_id] : null;
    const staffColor = getStaffColor(apt.assigned_staff_id);
    const isToday = apt.appointment_date === todayStr;
    const isPast = apt.status !== 'confirmed';

    return (
      <div
        key={apt.id}
        className={`flex items-center gap-3 px-4 py-2.5 bg-white dark:bg-zinc-900 rounded-lg border border-slate-100 dark:border-zinc-800 hover:border-slate-200 dark:hover:border-zinc-700 transition-all ${isPast ? 'opacity-60' : ''}`}
      >
        {/* Time */}
        <div className={`hidden sm:block text-right min-w-[52px] flex-shrink-0 ${isToday && !isPast ? 'text-violet-600 dark:text-violet-400' : 'text-slate-500 dark:text-zinc-500'}`}>
          <p className="text-xs font-bold">{apt.appointment_time || '—'}</p>
          <p className="text-[10px] text-slate-400 dark:text-zinc-500">{isToday ? 'Today' : apt.appointment_date ? new Date(apt.appointment_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}</p>
        </div>

        <div className="hidden sm:block w-px h-8 bg-slate-100 dark:bg-zinc-800/50 flex-shrink-0" />

        {/* Name — fixed width so status aligns */}
        <div className="w-[140px] sm:w-[180px] flex-shrink-0 min-w-0">
          <p className="text-sm font-semibold text-slate-800 dark:text-zinc-200 truncate">{apt.caller_name || 'Unknown'}</p>
        </div>

        {/* Status */}
        <div className="w-[90px] flex-shrink-0">
          <div className="flex items-center gap-1.5">
            <StatusBadge status={apt.status} />
            {apt.urgency === 'high' && <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />}
          </div>
        </div>

        {/* Details */}
        <div className="flex-1 min-w-0 hidden sm:flex items-center gap-2 text-[11px] text-slate-400 dark:text-zinc-500">
          <span className="capitalize">{apt.case_type?.replace(/_/g, ' ') || '—'}</span>
          {apt.caller_phone && <><span className="text-slate-200 dark:text-zinc-700">·</span><span>{apt.caller_phone}</span></>}
          {staffMember && <><span className="text-slate-200 dark:text-zinc-700">·</span><span className="flex items-center gap-1"><span className={`w-1.5 h-1.5 rounded-full ${staffColor.dot}`} />{staffMember.name}</span></>}
        </div>

        {/* Actions — fixed width so rows align */}
        <div className="flex items-center gap-1.5 flex-shrink-0 w-[88px] justify-end">
          {apt.status === 'confirmed' ? (
            <>
              <button
                onClick={() => handleStatusChange(apt.id, 'completed')}
                disabled={!!actionLoading}
                className="p-1.5 rounded-lg text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-colors disabled:opacity-50"
                title="Complete"
              >
                {actionLoading === apt.id + 'completed' ? <div className="w-4 h-4 border-2 border-emerald-200 dark:border-emerald-700 border-t-emerald-500 rounded-full animate-spin" /> : <CheckCircle size={16} />}
              </button>
              <button
                onClick={() => setConfirmCancel(apt)}
                disabled={!!actionLoading}
                className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors disabled:opacity-50"
                title="Cancel"
              >
                <XCircle size={16} />
              </button>
            </>
          ) : null}
          {apt.lead_id && (
            <Link to={`/leads/${apt.lead_id}`} className="p-1.5 hover:bg-slate-50 dark:hover:bg-zinc-900 rounded-lg transition-colors">
              <ChevronRight size={14} className="text-slate-300 dark:text-zinc-600" />
            </Link>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <ConfirmModal
        open={!!confirmCancel}
        onCancel={() => setConfirmCancel(null)}
        onConfirm={() => { handleStatusChange(confirmCancel.id, 'cancelled'); setConfirmCancel(null); }}
        loading={actionLoading === confirmCancel?.id + 'cancelled'}
        danger
        title="Cancel appointment?"
        message={confirmCancel ? `Cancel the appointment for ${confirmCancel.caller_name || 'this client'}${confirmCancel.appointment_date ? ` on ${confirmCancel.appointment_date}` : ''}${confirmCancel.appointment_time ? ` at ${confirmCancel.appointment_time}` : ''}? This cannot be undone.` : ''}
        confirmLabel="Cancel Appointment"
      />

      {error && (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-100 dark:border-red-800 rounded-lg px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertCircle size={16} className="text-red-500" />
            <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
          </div>
          <button onClick={loadAppointments} className="px-3 py-1.5 text-xs font-semibold text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/40 hover:bg-red-200 rounded-lg transition-colors">Retry</button>
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-zinc-100">Appointments</h1>
        <div className="flex items-center gap-2 mt-2">
          <span className="text-xs text-slate-400 dark:text-zinc-500">{appointments.length} total</span>
          {confirmed > 0 && <span className="text-xs text-violet-600 dark:text-violet-400 font-medium">{confirmed} upcoming</span>}
          {completed > 0 && <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">{completed} completed</span>}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-zinc-900 rounded-lg border border-slate-200 dark:border-zinc-700 px-4 py-3 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-0.5 bg-slate-100 dark:bg-zinc-800/50 rounded-lg p-0.5">
          {STATUS_TABS.map((t) => {
            const count = t.key === 'all' ? appointments.length : appointments.filter((a) => a.status === t.key).length;
            const isActive = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all flex items-center gap-1.5 ${
                  isActive ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 shadow-sm' : 'text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-400'
                }`}
              >
                {t.label}
                <span className={`text-[10px] tabular-nums ${isActive ? 'text-slate-500 dark:text-zinc-500' : 'text-slate-300 dark:text-zinc-600'}`}>{count}</span>
              </button>
            );
          })}
        </div>
        <DateFilter value={dateRange} onChange={setDateRange} />
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 rounded-lg border border-slate-100 dark:border-zinc-800 py-16 text-center">
          <CalendarCheck size={24} className="text-slate-300 dark:text-zinc-600 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-500 dark:text-zinc-500">No appointments</p>
          <p className="text-xs text-slate-400 dark:text-zinc-500 mt-1">Booked consultations will appear here</p>
        </div>
      ) : tab === 'all' ? (
        /* Grouped view for "All" tab */
        <div className="space-y-6">
          {upcomingFiltered.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <CalendarCheck size={14} className="text-violet-500" />
                <h3 className="text-xs font-semibold text-slate-500 dark:text-zinc-500 uppercase tracking-wider">Upcoming</h3>
                <span className="text-[10px] text-slate-300 dark:text-zinc-600">{upcomingFiltered.length}</span>
              </div>
              <div className="space-y-2">
                {upcomingFiltered.map(renderAppointmentRow)}
              </div>
            </div>
          )}
          {pastFiltered.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Clock size={14} className="text-slate-400 dark:text-zinc-500" />
                <h3 className="text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Completed & Cancelled</h3>
                <span className="text-[10px] text-slate-300 dark:text-zinc-600">{pastFiltered.length}</span>
              </div>
              <div className="space-y-2">
                {pastFiltered.map(renderAppointmentRow)}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Single-status tab view */
        <div className="space-y-2">
          {filtered.map(renderAppointmentRow)}
        </div>
      )}
    </div>
  );
}
