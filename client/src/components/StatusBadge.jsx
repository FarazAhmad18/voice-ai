export default function StatusBadge({ status }) {
  const themes = {
    new: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500', label: 'New' },
    contacted: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500', label: 'Following Up' },
    booked: { bg: 'bg-violet-50', text: 'text-violet-700', dot: 'bg-violet-500', label: 'Booked' },
    converted: { bg: 'bg-teal-50', text: 'text-teal-700', dot: 'bg-teal-500', label: 'Converted' },
    closed: { bg: 'bg-slate-50', text: 'text-slate-500', dot: 'bg-slate-400', label: 'Closed' },
    confirmed: { bg: 'bg-violet-50', text: 'text-violet-700', dot: 'bg-violet-500', label: 'Confirmed' },
    cancelled: { bg: 'bg-red-50', text: 'text-red-600', dot: 'bg-red-500', label: 'Cancelled' },
    completed: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500', label: 'Completed' },
    missed: { bg: 'bg-orange-50', text: 'text-orange-700', dot: 'bg-orange-500', label: 'Missed Call' },
    no_show: { bg: 'bg-red-50', text: 'text-red-600', dot: 'bg-red-500', label: 'No Show' },
  };

  const theme = themes[status] || themes.new;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${theme.bg} ${theme.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${theme.dot}`} />
      {theme.label}
    </span>
  );
}
