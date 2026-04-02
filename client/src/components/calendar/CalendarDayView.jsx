import { toDateStr, isToday, getStaffColor, START_HOUR, END_HOUR } from './calendarUtils';
import StatusBadge from '../StatusBadge';
import { Phone } from 'lucide-react';

const HOUR_HEIGHT = 64;

function timeToTop(timeStr) {
  const match = timeStr?.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return 0;
  let h = parseInt(match[1]);
  const m = parseInt(match[2]);
  if (match[3].toUpperCase() === 'PM' && h !== 12) h += 12;
  if (match[3].toUpperCase() === 'AM' && h === 12) h = 0;
  return (h - START_HOUR) * HOUR_HEIGHT + (m / 60) * HOUR_HEIGHT;
}

export default function CalendarDayView({ currentDate, appointments, staffMap, onSelectAppointment }) {
  const dateStr = toDateStr(currentDate);
  const today = isToday(dateStr);
  const totalHeight = (END_HOUR - START_HOUR) * HOUR_HEIGHT;
  const dayApts = appointments.filter(a => a.appointment_date === dateStr);

  const now = new Date();
  const nowH = now.getHours();
  const nowM = now.getMinutes();
  const nowTop = (nowH - START_HOUR) * HOUR_HEIGHT + (nowM / 60) * HOUR_HEIGHT;
  const showNow = today && nowH >= START_HOUR && nowH < END_HOUR;

  const hours = [];
  for (let h = START_HOUR; h < END_HOUR; h++) {
    const ampm = h >= 12 ? 'PM' : 'AM';
    const display = h > 12 ? h - 12 : h === 0 ? 12 : h;
    hours.push({ label: `${display}:00 ${ampm}`, hour: h });
  }

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-lg border border-slate-200 dark:border-zinc-700 overflow-hidden">
      <div className="overflow-y-auto" style={{ maxHeight: 560 }}>
        <div className="grid relative" style={{ gridTemplateColumns: '72px 1fr', height: totalHeight }}>
          {/* Time gutter */}
          <div className="border-r border-slate-100 dark:border-zinc-800 relative bg-slate-50/50 dark:bg-zinc-900/50">
            {hours.map(({ label, hour }) => (
              <div key={hour} className="absolute right-3 -translate-y-1/2 text-[10px] text-slate-400 dark:text-zinc-500 font-medium whitespace-nowrap" style={{ top: (hour - START_HOUR) * HOUR_HEIGHT }}>
                {label}
              </div>
            ))}
          </div>

          {/* Content */}
          <div className="relative">
            {/* Hour lines */}
            {hours.map(({ hour }) => (
              <div key={hour} className="absolute left-0 right-0 border-t border-slate-100 dark:border-zinc-800/60" style={{ top: (hour - START_HOUR) * HOUR_HEIGHT }} />
            ))}
            {hours.map(({ hour }) => (
              <div key={`half-${hour}`} className="absolute left-0 right-0 border-t border-dashed border-slate-50 dark:border-zinc-800/30" style={{ top: (hour - START_HOUR) * HOUR_HEIGHT + HOUR_HEIGHT / 2 }} />
            ))}

            {/* Appointment blocks */}
            {dayApts.map(apt => {
              const top = timeToTop(apt.appointment_time);
              const color = getStaffColor(apt.assigned_staff_id);
              const staff = staffMap?.[apt.assigned_staff_id];
              const blockH = HOUR_HEIGHT / 2;

              return (
                <button
                  key={apt.id}
                  onClick={() => onSelectAppointment(apt)}
                  className={`absolute left-2 right-2 rounded-lg overflow-hidden cursor-pointer border-l-4 ${color.border} ${color.light} hover:shadow-md transition-shadow z-10 text-left`}
                  style={{ top: top + 1, minHeight: Math.max(blockH - 2, 48) }}
                >
                  <div className="px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`text-xs font-bold ${color.text}`}>{apt.appointment_time}</span>
                        <span className="text-xs font-semibold text-slate-800 dark:text-zinc-200 truncate">{apt.caller_name}</span>
                      </div>
                      <StatusBadge status={apt.status} />
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-500 dark:text-zinc-500">
                      {apt.caller_phone && (
                        <span className="flex items-center gap-1"><Phone size={9} />{apt.caller_phone}</span>
                      )}
                      {apt.case_type && <span className="capitalize">{apt.case_type}</span>}
                      {staff && (
                        <span className="flex items-center gap-1">
                          <span className={`w-1.5 h-1.5 rounded-full ${color.dot}`} />{staff.name}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}

            {/* Now indicator */}
            {showNow && (
              <div className="absolute left-0 right-0 z-20 flex items-center pointer-events-none" style={{ top: nowTop }}>
                <div className="w-2.5 h-2.5 rounded-full bg-red-500 -ml-1.5 shadow-sm" />
                <div className="flex-1 h-px bg-red-500" />
              </div>
            )}

            {/* Empty state */}
            {dayApts.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center">
                <p className="text-sm text-slate-400 dark:text-zinc-500">No appointments this day</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
