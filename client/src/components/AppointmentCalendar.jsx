import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Clock, Phone, User, MapPin } from 'lucide-react';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const STATUS_COLORS = {
  confirmed: { bg: 'bg-violet-500', dot: 'bg-violet-400', text: 'text-violet-700', light: 'bg-violet-50' },
  completed: { bg: 'bg-emerald-500', dot: 'bg-emerald-400', text: 'text-emerald-700', light: 'bg-emerald-50' },
  cancelled: { bg: 'bg-red-400', dot: 'bg-red-400', text: 'text-red-600', light: 'bg-red-50' },
  no_show: { bg: 'bg-slate-400', dot: 'bg-slate-400', text: 'text-slate-600', light: 'bg-slate-50' },
};

export default function AppointmentCalendar({ appointments = [] }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [hoveredDay, setHoveredDay] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const calendarRef = useRef(null);
  const tooltipTimeout = useRef(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  // Build calendar grid
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  // Group appointments by date
  const aptsByDate = {};
  appointments.forEach(apt => {
    const date = apt.appointment_date;
    if (!date) return;
    if (!aptsByDate[date]) aptsByDate[date] = [];
    aptsByDate[date].push(apt);
  });

  function prevMonth() {
    setCurrentDate(new Date(year, month - 1, 1));
  }

  function nextMonth() {
    setCurrentDate(new Date(year, month + 1, 1));
  }

  function goToToday() {
    setCurrentDate(new Date());
  }

  function handleDayHover(e, dateStr, dayApts) {
    if (dayApts.length === 0) return;
    clearTimeout(tooltipTimeout.current);

    const rect = e.currentTarget.getBoundingClientRect();
    const calRect = calendarRef.current?.getBoundingClientRect();

    setHoveredDay({ dateStr, appointments: dayApts });
    setTooltipPos({
      x: rect.left - (calRect?.left || 0) + rect.width / 2,
      y: rect.top - (calRect?.top || 0) - 8,
    });

    tooltipTimeout.current = setTimeout(() => setTooltipVisible(true), 150);
  }

  function handleDayLeave() {
    clearTimeout(tooltipTimeout.current);
    setTooltipVisible(false);
    tooltipTimeout.current = setTimeout(() => setHoveredDay(null), 200);
  }

  // Build grid cells
  const cells = [];

  // Previous month trailing days
  for (let i = firstDay - 1; i >= 0; i--) {
    const day = daysInPrevMonth - i;
    cells.push({ day, type: 'prev', dateStr: null });
  }

  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push({ day: d, type: 'current', dateStr, apts: aptsByDate[dateStr] || [] });
  }

  // Next month leading days
  const remaining = 42 - cells.length;
  for (let i = 1; i <= remaining; i++) {
    cells.push({ day: i, type: 'next', dateStr: null });
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100/80 shadow-sm overflow-hidden card-lift" ref={calendarRef}>
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-100/80 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-indigo-50 to-violet-50 rounded-xl flex items-center justify-center">
            <Clock size={16} className="text-indigo-500" />
          </div>
          <div>
            <h3 className="text-[15px] font-semibold text-slate-900">
              {MONTHS[month]} {year}
            </h3>
            <p className="text-xs text-slate-400">
              {Object.values(aptsByDate).flat().length} appointment{Object.values(aptsByDate).flat().length !== 1 ? 's' : ''} this month
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={goToToday}
            className="px-3 py-1.5 text-[11px] font-semibold text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-lg transition-colors"
          >
            Today
          </button>
          <button
            onClick={prevMonth}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-50 transition-colors"
          >
            <ChevronLeft size={16} className="text-slate-400" />
          </button>
          <button
            onClick={nextMonth}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-50 transition-colors"
          >
            <ChevronRight size={16} className="text-slate-400" />
          </button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="p-4 relative">
        {/* Day headers */}
        <div className="grid grid-cols-7 mb-2">
          {DAYS.map(d => (
            <div key={d} className="text-center text-[10px] font-semibold text-slate-400 uppercase tracking-wider py-2">
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7 gap-px bg-slate-100/50 rounded-xl overflow-hidden">
          {cells.map((cell, idx) => {
            const isToday = cell.dateStr === todayStr;
            const isOtherMonth = cell.type !== 'current';
            const hasApts = cell.apts?.length > 0;
            const confirmedCount = cell.apts?.filter(a => a.status === 'confirmed').length || 0;
            const completedCount = cell.apts?.filter(a => a.status === 'completed').length || 0;
            const cancelledCount = cell.apts?.filter(a => a.status === 'cancelled').length || 0;

            return (
              <div
                key={idx}
                className={`relative bg-white min-h-[68px] p-1.5 transition-all ${
                  isOtherMonth ? 'opacity-30' : ''
                } ${hasApts ? 'cursor-pointer hover:bg-slate-50/80' : ''}`}
                onMouseEnter={(e) => hasApts && handleDayHover(e, cell.dateStr, cell.apts)}
                onMouseLeave={handleDayLeave}
              >
                {/* Day number */}
                <div className={`text-xs font-medium mb-1 flex items-center justify-center w-6 h-6 rounded-full ${
                  isToday
                    ? 'bg-violet-600 text-white font-bold'
                    : isOtherMonth
                      ? 'text-slate-300'
                      : 'text-slate-600'
                }`}>
                  {cell.day}
                </div>

                {/* Appointment dots */}
                {hasApts && (
                  <div className="flex flex-wrap gap-[3px] px-0.5">
                    {cell.apts.slice(0, 3).map((apt, i) => {
                      const sc = STATUS_COLORS[apt.status] || STATUS_COLORS.confirmed;
                      return (
                        <div
                          key={i}
                          className={`h-[5px] flex-1 min-w-[5px] max-w-[16px] rounded-full ${sc.bg}`}
                        />
                      );
                    })}
                    {cell.apts.length > 3 && (
                      <span className="text-[8px] font-bold text-slate-400 leading-none self-center">
                        +{cell.apts.length - 3}
                      </span>
                    )}
                  </div>
                )}

                {/* Count badge for busy days */}
                {cell.apts?.length > 1 && (
                  <div className="absolute top-1 right-1 w-4 h-4 bg-violet-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center">
                    {cell.apts.length}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Hover Tooltip */}
        {hoveredDay && tooltipVisible && (
          <div
            className="absolute z-50 w-72 bg-white rounded-xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden transition-all duration-150"
            style={{
              left: `${Math.min(Math.max(tooltipPos.x - 144, 8), calendarRef.current?.offsetWidth - 296 || 200)}px`,
              top: `${tooltipPos.y}px`,
              transform: 'translateY(-100%)',
            }}
          >
            {/* Tooltip header */}
            <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100">
              <p className="text-xs font-semibold text-slate-700">
                {new Date(hoveredDay.dateStr + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </p>
              <p className="text-[10px] text-slate-400">{hoveredDay.appointments.length} appointment{hoveredDay.appointments.length !== 1 ? 's' : ''}</p>
            </div>

            {/* Appointment list */}
            <div className="max-h-48 overflow-y-auto">
              {hoveredDay.appointments.map((apt, i) => {
                const sc = STATUS_COLORS[apt.status] || STATUS_COLORS.confirmed;
                const initials = ((apt.caller_name || 'U').split(' ').map(n => n?.[0] || '').join('').slice(0, 2).toUpperCase()) || '?';

                return (
                  <Link
                    key={apt.id || i}
                    to={apt.lead_id ? `/leads/${apt.lead_id}` : '/appointments'}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0"
                  >
                    <div className={`w-1 h-10 rounded-full ${sc.bg} flex-shrink-0`} />
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold ${sc.light} ${sc.text} flex-shrink-0`}>
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{apt.caller_name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[11px] text-slate-400 capitalize">{apt.case_type}</span>
                        {apt.caller_phone && (
                          <>
                            <span className="text-slate-200">·</span>
                            <span className="text-[11px] text-slate-400">{apt.caller_phone}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs font-semibold text-slate-700">{apt.appointment_time}</p>
                      <p className={`text-[10px] font-medium capitalize ${sc.text}`}>{apt.status}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="px-6 py-3 border-t border-slate-50 flex items-center gap-4">
        {[
          { label: 'Confirmed', color: 'bg-violet-500' },
          { label: 'Completed', color: 'bg-emerald-500' },
          { label: 'Cancelled', color: 'bg-red-400' },
        ].map(l => (
          <div key={l.label} className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${l.color}`} />
            <span className="text-[10px] text-slate-400 font-medium">{l.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
