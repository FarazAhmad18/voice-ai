import { useState, useEffect } from 'react';
import { fetchAppointments, updateAppointment } from '../services/api';
import StatusBadge from '../components/StatusBadge';
import { CalendarCheck, Clock, CheckCircle2, XCircle, Phone, User } from 'lucide-react';

export default function Appointments() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-sm text-slate-400">Loading appointments...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Appointments</h1>
        <p className="text-sm text-slate-400 mt-1">{appointments.length} consultations booked by Sarah</p>
      </div>

      {appointments.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-12 text-center">
          <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <CalendarCheck size={24} className="text-slate-400" />
          </div>
          <p className="text-base font-semibold text-slate-700">No appointments yet</p>
          <p className="text-sm text-slate-400 mt-1">When Sarah books a consultation, appointments will appear here.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left px-5 py-3.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">Client</th>
                <th className="text-left px-5 py-3.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">Phone</th>
                <th className="text-left px-5 py-3.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">Case Type</th>
                <th className="text-left px-5 py-3.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">Date</th>
                <th className="text-left px-5 py-3.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">Time</th>
                <th className="text-left px-5 py-3.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">Urgency</th>
                <th className="text-left px-5 py-3.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">Status</th>
                <th className="text-left px-5 py-3.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {appointments.map((apt) => (
                <tr key={apt.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-gradient-to-br from-violet-100 to-violet-200 rounded-full flex items-center justify-center text-[10px] font-bold text-violet-600">
                        {apt.caller_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{apt.caller_name}</p>
                        {apt.caller_email && <p className="text-[11px] text-slate-400">{apt.caller_email}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-1.5 text-sm text-slate-600">
                      <Phone size={12} className="text-slate-400" />
                      {apt.caller_phone}
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-sm text-slate-600 capitalize">{apt.case_type}</td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                      <CalendarCheck size={13} className="text-violet-500" />
                      {apt.appointment_date}
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-1.5 text-sm text-slate-600">
                      <Clock size={13} className="text-slate-400" />
                      {apt.appointment_time}
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`text-xs font-semibold capitalize ${
                      apt.urgency === 'high' ? 'text-rose-600' :
                      apt.urgency === 'medium' ? 'text-amber-600' :
                      'text-slate-500'
                    }`}>
                      {apt.urgency}
                    </span>
                  </td>
                  <td className="px-5 py-3.5"><StatusBadge status={apt.status} /></td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-1.5">
                      {apt.status === 'confirmed' && (
                        <>
                          <button
                            onClick={() => handleStatusChange(apt.id, 'completed')}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 border border-emerald-200 transition-colors"
                          >
                            <CheckCircle2 size={12} />
                            Complete
                          </button>
                          <button
                            onClick={() => handleStatusChange(apt.id, 'cancelled')}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-100 border border-rose-200 transition-colors"
                          >
                            <XCircle size={12} />
                            Cancel
                          </button>
                        </>
                      )}
                    </div>
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
