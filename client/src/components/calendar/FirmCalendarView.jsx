import { toDateStr, isToday, getStaffColor, getInitials, groupByStaff, START_HOUR, END_HOUR } from './calendarUtils';

const HOUR_HEIGHT = 60;

function timeToTop(timeStr) {
  const match = timeStr?.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return 0;
  let h = parseInt(match[1]);
  const m = parseInt(match[2]);
  if (match[3].toUpperCase() === 'PM' && h !== 12) h += 12;
  if (match[3].toUpperCase() === 'AM' && h === 12) h = 0;
  return (h - START_HOUR) * HOUR_HEIGHT + (m / 60) * HOUR_HEIGHT;
}

export default function FirmCalendarView({ currentDate, viewMode, appointments, staff, staffMap, onSelectAppointment }) {
  const activeStaff = staff.filter(s => s.is_active);
  const totalHeight = (END_HOUR - START_HOUR) * HOUR_HEIGHT;

  if (viewMode === 'month') {
    return (
      <div className="bg-white rounded-lg border border-slate-200 p-8 text-center">
        <p className="text-sm text-slate-500">Team view works best in Week or Day mode.</p>
        <p className="text-xs text-slate-400 mt-1">Switch to see all staff side-by-side.</p>
      </div>
    );
  }

  const dateStr = toDateStr(currentDate);
  const today = isToday(dateStr);
  const dayApts = appointments.filter(a => a.appointment_date === dateStr);
  const byStaff = groupByStaff(dayApts);
  const hasUnassigned = byStaff['_unassigned']?.length > 0;
  const colCount = activeStaff.length + (hasUnassigned ? 1 : 0);

  const now = new Date();
  const nowH = now.getHours();
  const nowM = now.getMinutes();
  const nowTop = (nowH - START_HOUR) * HOUR_HEIGHT + (nowM / 60) * HOUR_HEIGHT;
  const showNow = today && nowH >= START_HOUR && nowH < END_HOUR;

  const hours = [];
  for (let h = START_HOUR; h < END_HOUR; h++) {
    const ampm = h >= 12 ? 'PM' : 'AM';
    const display = h > 12 ? h - 12 : h === 0 ? 12 : h;
    hours.push({ label: `${display} ${ampm}`, hour: h });
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
      <div className="overflow-x-auto">
        <div style={{ minWidth: 72 + colCount * 180 }}>
          {/* Staff headers */}
          <div className="grid border-b border-slate-200 sticky top-0 bg-white z-10" style={{ gridTemplateColumns: `52px repeat(${colCount}, minmax(180px, 1fr))` }}>
            <div className="border-r border-slate-100" />
            {activeStaff.map(s => {
              const color = getStaffColor(s.id);
              const count = (byStaff[s.id] || []).length;
              return (
                <div key={s.id} className="px-3 py-2.5 border-r border-slate-100 last:border-r-0">
                  <div className="flex items-center gap-2">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold text-white ${color.dot}`}>
                      {getInitials(s.name)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-700 truncate">{s.name}</p>
                      <p className="text-[10px] text-slate-400">{count} appt{count !== 1 ? 's' : ''}</p>
                    </div>
                  </div>
                </div>
              );
            })}
            {hasUnassigned && (
              <div className="px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold text-white bg-slate-400">?</div>
                  <p className="text-xs font-semibold text-slate-500">Unassigned</p>
                </div>
              </div>
            )}
          </div>

          {/* Grid */}
          <div className="overflow-y-auto" style={{ maxHeight: 520 }}>
            <div className="grid relative" style={{ gridTemplateColumns: `52px repeat(${colCount}, minmax(180px, 1fr))`, height: totalHeight }}>
              {/* Time gutter */}
              <div className="border-r border-slate-100 relative">
                {hours.map(({ label, hour }) => (
                  <div key={hour} className="absolute right-2 -translate-y-1/2 text-[10px] text-slate-400 font-medium whitespace-nowrap" style={{ top: (hour - START_HOUR) * HOUR_HEIGHT }}>
                    {label}
                  </div>
                ))}
              </div>

              {/* Staff columns */}
              {activeStaff.map(s => {
                const color = getStaffColor(s.id);
                const staffApts = byStaff[s.id] || [];
                return (
                  <div key={s.id} className="border-r border-slate-100 last:border-r-0 relative">
                    {hours.map(({ hour }) => (
                      <div key={hour} className="absolute left-0 right-0 border-t border-slate-100/80" style={{ top: (hour - START_HOUR) * HOUR_HEIGHT }} />
                    ))}
                    {staffApts.map(apt => {
                      const top = timeToTop(apt.appointment_time);
                      return (
                        <button
                          key={apt.id}
                          onClick={() => onSelectAppointment(apt)}
                          className={`absolute left-0.5 right-0.5 rounded px-1.5 py-1 overflow-hidden cursor-pointer border-l-2 ${color.border} ${color.bg} hover:brightness-95 transition-all z-10 text-left`}
                          style={{ top, height: HOUR_HEIGHT / 2 - 2 }}
                        >
                          <p className={`text-[10px] font-semibold ${color.text} truncate`}>{apt.appointment_time}</p>
                          <p className="text-[9px] text-slate-600 truncate">{apt.caller_name}</p>
                        </button>
                      );
                    })}
                    {showNow && <div className="absolute left-0 right-0 z-20 h-px bg-red-500/40 pointer-events-none" style={{ top: nowTop }} />}
                  </div>
                );
              })}

              {/* Unassigned column */}
              {hasUnassigned && (
                <div className="relative">
                  {hours.map(({ hour }) => (
                    <div key={hour} className="absolute left-0 right-0 border-t border-slate-100/80" style={{ top: (hour - START_HOUR) * HOUR_HEIGHT }} />
                  ))}
                  {byStaff['_unassigned'].map(apt => {
                    const top = timeToTop(apt.appointment_time);
                    return (
                      <button
                        key={apt.id}
                        onClick={() => onSelectAppointment(apt)}
                        className="absolute left-0.5 right-0.5 rounded px-1.5 py-1 overflow-hidden cursor-pointer border-l-2 border-slate-300 bg-slate-100 hover:brightness-95 transition-all z-10 text-left"
                        style={{ top, height: HOUR_HEIGHT / 2 - 2 }}
                      >
                        <p className="text-[10px] font-semibold text-slate-600 truncate">{apt.appointment_time}</p>
                        <p className="text-[9px] text-slate-500 truncate">{apt.caller_name}</p>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
