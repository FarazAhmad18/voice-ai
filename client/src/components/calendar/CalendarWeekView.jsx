import { getWeekDays, toDateStr, isToday, getTimeSlots, getBlockStyle, getGridHeight, getStaffColor, START_HOUR, END_HOUR, PIXELS_PER_MINUTE } from './calendarUtils';

const HOUR_HEIGHT = 60; // px per hour
const SLOT_PX = HOUR_HEIGHT / 2; // 30px per 30-min slot

function timeToTop(timeStr) {
  const match = timeStr?.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return 0;
  let h = parseInt(match[1]);
  const m = parseInt(match[2]);
  if (match[3].toUpperCase() === 'PM' && h !== 12) h += 12;
  if (match[3].toUpperCase() === 'AM' && h === 12) h = 0;
  return (h - START_HOUR) * HOUR_HEIGHT + (m / 60) * HOUR_HEIGHT;
}

export default function CalendarWeekView({ currentDate, appointments, staffMap, onSelectAppointment }) {
  const days = getWeekDays(currentDate);
  const totalHeight = (END_HOUR - START_HOUR) * HOUR_HEIGHT;

  const byDate = {};
  appointments.forEach(apt => {
    const key = apt.appointment_date;
    if (!byDate[key]) byDate[key] = [];
    byDate[key].push(apt);
  });

  const now = new Date();
  const nowH = now.getHours();
  const nowM = now.getMinutes();
  const nowTop = (nowH - START_HOUR) * HOUR_HEIGHT + (nowM / 60) * HOUR_HEIGHT;
  const showNow = nowH >= START_HOUR && nowH < END_HOUR;

  const hours = [];
  for (let h = START_HOUR; h < END_HOUR; h++) {
    const ampm = h >= 12 ? 'PM' : 'AM';
    const display = h > 12 ? h - 12 : h === 0 ? 12 : h;
    hours.push({ label: `${display} ${ampm}`, hour: h });
  }

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-lg border border-slate-200 dark:border-zinc-700 overflow-hidden">
      {/* Day headers */}
      <div className="grid border-b border-slate-200 dark:border-zinc-700 sticky top-0 bg-white dark:bg-zinc-900 z-10" style={{ gridTemplateColumns: '52px repeat(7, 1fr)' }}>
        <div className="border-r border-slate-100 dark:border-zinc-800" />
        {days.map(d => {
          const ds = toDateStr(d);
          const td = isToday(ds);
          return (
            <div key={ds} className={`py-2.5 text-center border-r border-slate-100 dark:border-zinc-800 last:border-r-0 ${td ? 'bg-violet-50/50 dark:bg-violet-900/20' : ''}`}>
              <p className="text-[10px] font-medium text-slate-400 dark:text-zinc-500 uppercase tracking-wider">{d.toLocaleDateString('en-US', { weekday: 'short' })}</p>
              <p className={`text-base font-semibold mt-0.5 leading-none ${td ? 'w-7 h-7 mx-auto flex items-center justify-center bg-violet-600 text-white rounded-full' : 'text-slate-800 dark:text-zinc-200'}`}>{d.getDate()}</p>
            </div>
          );
        })}
      </div>

      {/* Time grid */}
      <div className="overflow-y-auto" style={{ maxHeight: 520 }}>
        <div className="grid relative" style={{ gridTemplateColumns: '52px repeat(7, 1fr)', height: totalHeight }}>
          {/* Time gutter */}
          <div className="border-r border-slate-100 dark:border-zinc-800 relative">
            {hours.map(({ label, hour }) => (
              <div key={hour} className="absolute right-2 -translate-y-1/2 text-[10px] text-slate-400 dark:text-zinc-500 font-medium whitespace-nowrap" style={{ top: (hour - START_HOUR) * HOUR_HEIGHT }}>
                {label}
              </div>
            ))}
          </div>

          {/* Day columns */}
          {days.map(d => {
            const ds = toDateStr(d);
            const dayApts = byDate[ds] || [];
            const td = isToday(ds);

            return (
              <div key={ds} className={`border-r border-slate-100 dark:border-zinc-800/60 last:border-r-0 relative ${td ? 'bg-violet-50/20 dark:bg-violet-900/10' : ''}`}>
                {/* Hour lines */}
                {hours.map(({ hour }) => (
                  <div key={hour} className="absolute left-0 right-0 border-t border-slate-100/80 dark:border-zinc-800/60" style={{ top: (hour - START_HOUR) * HOUR_HEIGHT }} />
                ))}
                {/* Half-hour dashed lines */}
                {hours.map(({ hour }) => (
                  <div key={`half-${hour}`} className="absolute left-0 right-0 border-t border-dashed border-slate-50 dark:border-zinc-800/30" style={{ top: (hour - START_HOUR) * HOUR_HEIGHT + HOUR_HEIGHT / 2 }} />
                ))}

                {/* Appointment blocks */}
                {dayApts.map(apt => {
                  const top = timeToTop(apt.appointment_time);
                  const color = getStaffColor(apt.assigned_staff_id);
                  const staff = staffMap?.[apt.assigned_staff_id];
                  return (
                    <button
                      key={apt.id}
                      onClick={() => onSelectAppointment(apt)}
                      className={`absolute left-0.5 right-0.5 rounded px-1.5 py-1 overflow-hidden cursor-pointer border-l-2 ${color.border} ${color.bg} hover:brightness-95 transition-all z-10 text-left`}
                      style={{ top, height: SLOT_PX - 2 }}
                    >
                      <p className={`text-[10px] font-semibold ${color.text} leading-tight truncate`}>{apt.appointment_time} · {apt.caller_name}</p>
                      {staff && SLOT_PX > 25 && <p className="text-[9px] text-slate-500 dark:text-zinc-500 truncate leading-tight">{staff.name}</p>}
                    </button>
                  );
                })}

                {/* Now line */}
                {td && showNow && (
                  <div className="absolute left-0 right-0 z-20 flex items-center pointer-events-none" style={{ top: nowTop }}>
                    <div className="w-2 h-2 rounded-full bg-red-500 -ml-1 shadow-sm" />
                    <div className="flex-1 h-px bg-red-500" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
