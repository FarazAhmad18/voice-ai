export default function StatusBadge({ status }) {
  const themes = {
    new: { bg: 'bg-emerald-50 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400', dot: 'bg-emerald-500', label: 'New' },
    contacted: { bg: 'bg-amber-50 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400', dot: 'bg-amber-500', label: 'Following Up' },
    booked: { bg: 'bg-violet-50 dark:bg-violet-900/30', text: 'text-violet-700 dark:text-violet-400', dot: 'bg-violet-500', label: 'Booked' },
    converted: { bg: 'bg-teal-50 dark:bg-teal-900/30', text: 'text-teal-700 dark:text-teal-400', dot: 'bg-teal-500', label: 'Converted' },
    closed: { bg: 'bg-slate-50 dark:bg-zinc-900', text: 'text-slate-500 dark:text-zinc-500', dot: 'bg-slate-400', label: 'Closed' },
    confirmed: { bg: 'bg-violet-50 dark:bg-violet-900/30', text: 'text-violet-700 dark:text-violet-400', dot: 'bg-violet-500', label: 'Confirmed' },
    cancelled: { bg: 'bg-red-50 dark:bg-red-900/30', text: 'text-red-600 dark:text-red-400', dot: 'bg-red-500', label: 'Cancelled' },
    completed: { bg: 'bg-emerald-50 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400', dot: 'bg-emerald-500', label: 'Completed' },
    missed: { bg: 'bg-orange-50 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-400', dot: 'bg-orange-500', label: 'Missed Call' },
    no_show: { bg: 'bg-red-50 dark:bg-red-900/30', text: 'text-red-600 dark:text-red-400', dot: 'bg-red-500', label: 'No Show' },
  };

  const theme = themes[status] || themes.new;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${theme.bg} ${theme.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${theme.dot}`} />
      {theme.label}
    </span>
  );
}
