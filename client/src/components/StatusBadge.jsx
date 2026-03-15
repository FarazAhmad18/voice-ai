export default function StatusBadge({ status }) {
  const themes = {
    new: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
    contacted: { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' },
    booked: { bg: 'bg-violet-50', text: 'text-violet-700', dot: 'bg-violet-500' },
    converted: { bg: 'bg-teal-50', text: 'text-teal-700', dot: 'bg-teal-500' },
    closed: { bg: 'bg-slate-50', text: 'text-slate-500', dot: 'bg-slate-400' },
    confirmed: { bg: 'bg-violet-50', text: 'text-violet-700', dot: 'bg-violet-500' },
    cancelled: { bg: 'bg-red-50', text: 'text-red-600', dot: 'bg-red-500' },
    completed: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  };

  const theme = themes[status] || themes.new;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${theme.bg} ${theme.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${theme.dot}`} />
      <span className="capitalize">{status}</span>
    </span>
  );
}
