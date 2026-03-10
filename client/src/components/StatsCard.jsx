export default function StatsCard({ title, value, subtitle, icon: Icon, trend, color = 'blue' }) {
  const themes = {
    blue: { bg: 'bg-blue-50', iconBg: 'bg-blue-100', iconColor: 'text-blue-600', accent: 'text-blue-600' },
    green: { bg: 'bg-emerald-50', iconBg: 'bg-emerald-100', iconColor: 'text-emerald-600', accent: 'text-emerald-600' },
    purple: { bg: 'bg-violet-50', iconBg: 'bg-violet-100', iconColor: 'text-violet-600', accent: 'text-violet-600' },
    red: { bg: 'bg-rose-50', iconBg: 'bg-rose-100', iconColor: 'text-rose-600', accent: 'text-rose-600' },
    amber: { bg: 'bg-amber-50', iconBg: 'bg-amber-100', iconColor: 'text-amber-600', accent: 'text-amber-600' },
  };

  const theme = themes[color] || themes.blue;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/60 p-5 shadow-sm hover:shadow-md transition-shadow duration-200">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-[13px] font-medium text-slate-500">{title}</p>
          <p className="text-3xl font-bold text-slate-900 mt-2 tracking-tight">{value}</p>
          {subtitle && (
            <div className="flex items-center gap-1.5 mt-2">
              {trend && (
                <span className={`text-xs font-semibold ${trend > 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                  {trend > 0 ? '+' : ''}{trend}%
                </span>
              )}
              <p className="text-xs text-slate-400">{subtitle}</p>
            </div>
          )}
        </div>
        {Icon && (
          <div className={`w-11 h-11 ${theme.iconBg} rounded-xl flex items-center justify-center`}>
            <Icon size={20} className={theme.iconColor} />
          </div>
        )}
      </div>
    </div>
  );
}
