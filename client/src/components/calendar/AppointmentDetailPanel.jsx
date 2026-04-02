import { Link } from 'react-router-dom';
import { X, Clock, User, Phone, FileText, Calendar, ChevronRight, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { getStaffColor, getInitials } from './calendarUtils';
import StatusBadge from '../StatusBadge';
import { useState } from 'react';

export default function AppointmentDetailPanel({ appointment, staffMap, onClose, onUpdateStatus }) {
  const [updating, setUpdating] = useState(null);

  if (!appointment) return null;

  const staff = appointment.assigned_staff_id ? staffMap?.[appointment.assigned_staff_id] : null;
  const staffColor = getStaffColor(appointment.assigned_staff_id);
  const initials = getInitials(appointment.caller_name);

  async function handleStatus(status) {
    setUpdating(status);
    try {
      await onUpdateStatus(appointment.id, status);
    } finally {
      setUpdating(null);
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />

      {/* Panel */}
      <div className="fixed right-0 top-0 bottom-0 w-full max-w-sm bg-white dark:bg-zinc-900 shadow-xl z-50 flex flex-col border-l border-slate-200 dark:border-zinc-700">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-zinc-800">
          <div>
            <p className="text-lg font-semibold text-slate-900 dark:text-zinc-100">{appointment.appointment_time}</p>
            <p className="text-xs text-slate-400 dark:text-zinc-500 mt-0.5">{appointment.appointment_date}</p>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={appointment.status} />
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800/50 text-slate-400 dark:text-zinc-500 transition-colors">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Client */}
          <div className="flex items-start gap-3">
            <div className={`w-11 h-11 rounded-lg flex items-center justify-center text-sm font-bold text-white ${staffColor.dot.replace('bg-', 'bg-')}`}>
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-900 dark:text-zinc-100">{appointment.caller_name || 'Unknown'}</p>
              {appointment.caller_phone && (
                <p className="text-xs text-slate-400 dark:text-zinc-500 mt-0.5 flex items-center gap-1.5">
                  <Phone size={11} /> {appointment.caller_phone}
                </p>
              )}
            </div>
          </div>

          {/* Details */}
          <div className="space-y-3">
            {appointment.case_type && (
              <div className="flex items-center gap-3 text-sm">
                <FileText size={14} className="text-slate-300 dark:text-zinc-600 flex-shrink-0" />
                <span className="text-slate-600 dark:text-zinc-500 capitalize">{appointment.case_type}</span>
              </div>
            )}
            <div className="flex items-center gap-3 text-sm">
              <Clock size={14} className="text-slate-300 dark:text-zinc-600 flex-shrink-0" />
              <span className="text-slate-600 dark:text-zinc-500">{appointment.appointment_date} at {appointment.appointment_time}</span>
            </div>
            {appointment.urgency && appointment.urgency !== 'low' && (
              <div className="flex items-center gap-3 text-sm">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  appointment.urgency === 'high' ? 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400' : 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
                }`}>
                  {appointment.urgency} urgency
                </span>
              </div>
            )}
          </div>

          {/* Staff */}
          {staff && (
            <div className="bg-slate-50 dark:bg-zinc-900 rounded-lg p-3">
              <p className="text-[10px] font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-2">Assigned To</p>
              <div className="flex items-center gap-2.5">
                <span className={`w-2.5 h-2.5 rounded-full ${staffColor.dot}`} />
                <div>
                  <p className="text-sm font-medium text-slate-700 dark:text-zinc-300">{staff.name}</p>
                  {staff.specialization && <p className="text-xs text-slate-400 dark:text-zinc-500">{staff.specialization}</p>}
                </div>
              </div>
            </div>
          )}

          {/* Notes */}
          {appointment.notes && (
            <div>
              <p className="text-[10px] font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-2">Notes</p>
              <p className="text-sm text-slate-600 dark:text-zinc-500 leading-relaxed">{appointment.notes}</p>
            </div>
          )}

          {/* Lead link */}
          {appointment.lead_id && (
            <Link
              to={`/leads/${appointment.lead_id}`}
              className="flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-zinc-900 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800/50 transition-colors group"
            >
              <span className="text-sm font-medium text-slate-600 dark:text-zinc-500 group-hover:text-slate-900 dark:hover:text-zinc-100">View Lead Details</span>
              <ChevronRight size={16} className="text-slate-300 dark:text-zinc-600 group-hover:text-slate-500 dark:group-hover:text-zinc-500" />
            </Link>
          )}
        </div>

        {/* Actions */}
        {appointment.status === 'confirmed' && (
          <div className="px-5 py-4 border-t border-slate-100 dark:border-zinc-800 flex gap-3">
            <button
              onClick={() => handleStatus('completed')}
              disabled={!!updating}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-500 text-white text-sm font-medium rounded-lg hover:bg-emerald-600 transition-colors disabled:opacity-50"
            >
              {updating === 'completed' ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
              Complete
            </button>
            <button
              onClick={() => handleStatus('cancelled')}
              disabled={!!updating}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-white dark:bg-zinc-900 text-red-600 dark:text-red-400 text-sm font-medium rounded-lg border border-red-200 dark:border-red-700 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors disabled:opacity-50"
            >
              {updating === 'cancelled' ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
              Cancel
            </button>
          </div>
        )}
      </div>
    </>
  );
}
