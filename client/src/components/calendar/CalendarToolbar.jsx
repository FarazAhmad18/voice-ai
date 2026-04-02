import { ChevronLeft, ChevronRight, LayoutGrid, Columns3, Clock, Building2, CalendarDays } from 'lucide-react';
import { formatMonthYear, getWeekDays, toDateStr } from './calendarUtils';

const VIEW_MODES = [
  { key: 'month', label: 'Month', icon: LayoutGrid },
  { key: 'week', label: 'Week', icon: Columns3 },
  { key: 'day', label: 'Day', icon: Clock },
];

export default function CalendarToolbar({
  viewMode, setViewMode, currentDate, setCurrentDate,
  isFirmView, setIsFirmView, appointmentCount, children,
}) {
  function navigate(dir) {
    const d = new Date(currentDate);
    if (viewMode === 'month') d.setMonth(d.getMonth() + dir);
    else if (viewMode === 'week') d.setDate(d.getDate() + 7 * dir);
    else d.setDate(d.getDate() + dir);
    setCurrentDate(d);
  }

  function getTitle() {
    if (viewMode === 'month') return formatMonthYear(currentDate);
    if (viewMode === 'week') {
      const days = getWeekDays(currentDate);
      const from = days[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const to = days[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      return `${from} – ${to}`;
    }
    return currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  }

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-lg border border-slate-200 dark:border-zinc-700 px-4 py-3">
      <div className="flex items-center gap-4 flex-wrap">
        {/* Title + count */}
        <div className="flex items-center gap-3 mr-auto">
          <div className="flex items-center gap-1.5">
            <button onClick={() => navigate(-1)} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-zinc-800/50 text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-400 transition-colors">
              <ChevronLeft size={16} />
            </button>
            <button onClick={() => navigate(1)} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-zinc-800/50 text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-400 transition-colors">
              <ChevronRight size={16} />
            </button>
          </div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-zinc-100 whitespace-nowrap">{getTitle()}</h2>
          <button
            onClick={() => setCurrentDate(new Date())}
            className="px-2 py-0.5 text-[11px] font-medium text-slate-500 dark:text-zinc-500 hover:text-slate-700 dark:hover:text-zinc-300 border border-slate-200 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-900 rounded transition-colors"
          >
            Today
          </button>
          {typeof appointmentCount === 'number' && (
            <span className="text-[11px] text-slate-400 dark:text-zinc-500 tabular-nums">{appointmentCount} appt{appointmentCount !== 1 ? 's' : ''}</span>
          )}
        </div>

        {/* Staff filter slot */}
        {children}

        {/* View switcher */}
        <div className="flex items-center bg-slate-100 dark:bg-zinc-800/50 rounded-lg p-0.5">
          {VIEW_MODES.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setViewMode(key)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                viewMode === key
                  ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 shadow-sm'
                  : 'text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-400'
              }`}
            >
              <Icon size={13} />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>

        {/* Firm view toggle */}
        <button
          onClick={() => setIsFirmView(!isFirmView)}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors border ${
            isFirmView
              ? 'bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 border-violet-200 dark:border-violet-700'
              : 'text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-400 border-slate-200 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-900'
          }`}
        >
          <Building2 size={13} />
          <span className="hidden sm:inline">Team</span>
        </button>
      </div>
    </div>
  );
}
