export default function StatsCard({ title, value, subtitle, icon: Icon, trend, color = 'slate' }) {
  const iconColors = {
    blue: 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
    green: 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400',
    purple: 'bg-violet-50 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400',
    red: 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400',
    amber: 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
    slate: 'bg-slate-50 dark:bg-zinc-900 text-slate-600 dark:text-zinc-500',
  };

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-lg p-5 border border-slate-100 dark:border-zinc-800">
      <div className="flex items-start justify-between mb-4">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${iconColors[color]}`}>
          <Icon size={18} />
        </div>
        {trend !== undefined && (
          <span className={`text-xs font-medium ${trend >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
            {trend >= 0 ? '+' : ''}{trend}%
          </span>
        )}
      </div>
      <p className="text-2xl font-semibold text-slate-900 dark:text-zinc-100 tracking-tight">{value}</p>
      <p className="text-sm text-slate-400 dark:text-zinc-500 mt-1">{title}</p>
      {subtitle && <p className="text-xs text-slate-400 dark:text-zinc-500 mt-0.5">{subtitle}</p>}
    </div>
  );
}
