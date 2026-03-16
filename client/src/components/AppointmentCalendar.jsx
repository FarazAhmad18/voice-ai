import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Calendar, Clock, Phone, X } from 'lucide-react';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const STATUS_STYLE = {
  confirmed: { bar: 'bg-violet-500', badge: 'bg-violet-50 text-violet-700 ring-violet-200', dot: 'bg-violet-500' },
  completed: { bar: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700 ring-emerald-200', dot: 'bg-emerald-500' },
  cancelled: { bar: 'bg-red-400', badge: 'bg-red-50 text-red-600 ring-red-200', dot: 'bg-red-400' },
  no_show: { bar: 'bg-slate-400', badge: 'bg-slate-50 text-slate-600 ring-slate-200', dot: 'bg-slate-400' },
};

export default function AppointmentCalendar({ appointments = [] }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  // Monday-start: get day of week for 1st (0=Mon, 6=Sun)
  const firstDayOfMonth = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrev = new Date(year, month, 0).getDate();

  // Group appointments by date
  const aptsByDate = {};
  appointments.forEach(apt => {
    if (!apt.appointment_date) return;
    if (!aptsByDate[apt.appointment_date]) aptsByDate[apt.appointment_date] = [];
    aptsByDate[apt.appointment_date].push(apt);
  });

  // Count for this month
  const monthAptCount = Object.keys(aptsByDate).filter(d => d.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`)).reduce((sum, d) => sum + aptsByDate[d].length, 0);

  // Build cells
  const cells = [];
  for (let i = 0; i < firstDayOfMonth; i++) {
    cells.push({ day: daysInPrev - firstDayOfMonth + 1 + i, outside: true });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push({ day: d, outside: false, dateStr, apts: aptsByDate[dateStr] || [] });
  }
  const remaining = 7 - (cells.length % 7);
  if (remaining < 7) {
    for (let i = 1; i <= remaining; i++) cells.push({ day: i, outside: true });
  }

  const selectedApts = selectedDay ? (aptsByDate[selectedDay] || []) : [];

  return (
    <div className="bg-white rounded-2xl border border-slate-100/80 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-violet-200/50">
            <Calendar size={18} className="text-white" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">{MONTHS[month]} {year}</h3>
            <p className="text-xs text-slate-400 mt-0.5">{monthAptCount} appointment{monthAptCount !== 1 ? 's' : ''} this month</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCurrentDate(new Date())}
            className="px-3.5 py-2 text-xs font-semibold text-violet-600 hover:bg-violet-50 rounded-lg transition-colors"
          >
            Today
          </button>
          <div className="w-px h-5 bg-slate-100 mx-1" />
          <button onClick={() => setCurrentDate(new Date(year, month - 1, 1))} className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-slate-50 transition-colors">
            <ChevronLeft size={18} className="text-slate-400" />
          </button>
          <button onClick={() => setCurrentDate(new Date(year, month + 1, 1))} className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-slate-50 transition-colors">
            <ChevronRight size={18} className="text-slate-400" />
          </button>
        </div>
      </div>

      <div className="flex">
        {/* Calendar Grid */}
        <div className={`${selectedDay ? 'flex-1' : 'w-full'} transition-all duration-300`}>
          {/* Day headers */}
          <div className="grid grid-cols-7 px-4">
            {DAYS.map(d => (
              <div key={d} className="text-center text-[11px] font-semibold text-slate-400 uppercase tracking-wider py-2.5">
                {d}
              </div>
            ))}
          </div>

          {/* Cells */}
          <div className="grid grid-cols-7 px-4 pb-4">
            {cells.map((cell, idx) => {
              const isToday = cell.dateStr === todayStr;
              const isSelected = cell.dateStr === selectedDay;
              const hasApts = cell.apts?.length > 0;
              const isWeekend = idx % 7 >= 5;

              return (
                <button
                  key={idx}
                  onClick={() => {
                    if (cell.outside) return;
                    if (hasApts) {
                      setSelectedDay(isSelected ? null : cell.dateStr);
                    }
                  }}
                  disabled={cell.outside}
                  className={`
                    relative flex flex-col items-center py-2.5 rounded-xl transition-all duration-150 group
                    ${cell.outside ? 'opacity-20 cursor-default' : 'cursor-pointer'}
                    ${isSelected ? 'bg-violet-50 ring-2 ring-violet-200' : ''}
                    ${isToday && !isSelected ? 'bg-slate-50' : ''}
                    ${!cell.outside && !isSelected ? 'hover:bg-slate-50' : ''}
                  `}
                >
                  {/* Day number */}
                  <span className={`
                    text-sm font-medium w-8 h-8 flex items-center justify-center rounded-full transition-colors
                    ${isToday ? 'bg-violet-600 text-white font-bold shadow-sm shadow-violet-200' : ''}
                    ${isSelected && !isToday ? 'text-violet-700 font-bold' : ''}
                    ${!isToday && !isSelected && !cell.outside ? (isWeekend ? 'text-slate-400' : 'text-slate-700') : ''}
                  `}>
                    {cell.day}
                  </span>

                  {/* Appointment indicators */}
                  {hasApts && (
                    <div className="flex items-center gap-1 mt-1.5">
                      {cell.apts.slice(0, 4).map((apt, i) => {
                        const st = STATUS_STYLE[apt.status] || STATUS_STYLE.confirmed;
                        return (
                          <div key={i} className={`w-[6px] h-[6px] rounded-full ${st.dot} ${isSelected ? 'scale-110' : 'group-hover:scale-110'} transition-transform`} />
                        );
                      })}
                      {cell.apts.length > 4 && (
                        <span className="text-[9px] font-bold text-slate-400">+{cell.apts.length - 4}</span>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="px-6 py-3.5 border-t border-slate-50 flex items-center gap-5">
            {[
              { label: 'Confirmed', dot: 'bg-violet-500' },
              { label: 'Completed', dot: 'bg-emerald-500' },
              { label: 'Cancelled', dot: 'bg-red-400' },
              { label: 'Today', dot: 'bg-violet-600', ring: true },
            ].map(l => (
              <div key={l.label} className="flex items-center gap-2">
                {l.ring ? (
                  <div className="w-3 h-3 bg-violet-600 rounded-full" />
                ) : (
                  <div className={`w-2.5 h-2.5 rounded-full ${l.dot}`} />
                )}
                <span className="text-[11px] text-slate-400 font-medium">{l.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Side Panel — Appointment Details */}
        {selectedDay && (
          <div className="w-80 border-l border-slate-100 bg-slate-50/50 flex flex-col animate-slideIn">
            {/* Panel Header */}
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-white">
              <div>
                <p className="text-sm font-bold text-slate-900">
                  {new Date(selectedDay + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {selectedApts.length} appointment{selectedApts.length !== 1 ? 's' : ''}
                </p>
              </div>
              <button
                onClick={() => setSelectedDay(null)}
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X size={14} className="text-slate-400" />
              </button>
            </div>

            {/* Appointment Cards */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {selectedApts.length === 0 ? (
                <div className="text-center py-10">
                  <Calendar size={24} className="text-slate-200 mx-auto mb-2" />
                  <p className="text-sm text-slate-400">No appointments</p>
                </div>
              ) : (
                selectedApts
                  .sort((a, b) => (a.appointment_time || '').localeCompare(b.appointment_time || ''))
                  .map((apt, i) => {
                    const st = STATUS_STYLE[apt.status] || STATUS_STYLE.confirmed;
                    const initials = ((apt.caller_name || 'U').split(' ').map(n => n?.[0] || '').join('').slice(0, 2).toUpperCase()) || '?';

                    return (
                      <Link
                        key={apt.id || i}
                        to={apt.lead_id ? `/leads/${apt.lead_id}` : '/appointments'}
                        className="block bg-white rounded-xl border border-slate-100 hover:border-slate-200 hover:shadow-md transition-all p-4 group"
                      >
                        {/* Time + Status */}
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <Clock size={13} className="text-violet-400" />
                            <span className="text-sm font-bold text-slate-900">{apt.appointment_time || 'TBD'}</span>
                          </div>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ring-1 capitalize ${st.badge}`}>
                            {apt.status}
                          </span>
                        </div>

                        {/* Person */}
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold ${st.badge} flex-shrink-0`}>
                            {initials}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-800 group-hover:text-violet-600 transition-colors truncate">
                              {apt.caller_name}
                            </p>
                            <p className="text-xs text-slate-400 capitalize mt-0.5 truncate">{apt.case_type}</p>
                          </div>
                        </div>

                        {/* Contact */}
                        {apt.caller_phone && (
                          <div className="flex items-center gap-1.5 mt-2.5 pt-2.5 border-t border-slate-50">
                            <Phone size={11} className="text-slate-300" />
                            <span className="text-[11px] text-slate-400">{apt.caller_phone}</span>
                          </div>
                        )}

                        {/* Notes preview */}
                        {apt.notes && (
                          <p className="text-[11px] text-slate-400 mt-2 line-clamp-2 leading-relaxed">{apt.notes}</p>
                        )}
                      </Link>
                    );
                  })
              )}
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(12px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .animate-slideIn {
          animation: slideIn 0.2s ease forwards;
        }
      `}</style>
    </div>
  );
}
