export default function DateFilter({ value, onChange }) {
  const options = [
    { key: 'today', label: 'Today' },
    { key: 'week', label: 'This Week' },
    { key: 'month', label: 'This Month' },
    { key: 'all', label: 'All Time' },
  ];

  return (
    <div className="flex items-center bg-slate-50 dark:bg-zinc-900 rounded-xl p-1 gap-0.5">
      {options.map((opt) => (
        <button
          key={opt.key}
          onClick={() => onChange(opt.key)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            value === opt.key
              ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 shadow-sm'
              : 'text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-400'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
