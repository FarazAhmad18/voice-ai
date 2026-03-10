import { Flame, Sun, Snowflake } from 'lucide-react';

export default function ScoreBadge({ score, label }) {
  const themes = {
    hot: {
      bg: 'bg-gradient-to-r from-rose-50 to-orange-50',
      border: 'border-rose-200',
      text: 'text-rose-700',
      icon: Flame,
      iconColor: 'text-rose-500',
    },
    warm: {
      bg: 'bg-gradient-to-r from-amber-50 to-yellow-50',
      border: 'border-amber-200',
      text: 'text-amber-700',
      icon: Sun,
      iconColor: 'text-amber-500',
    },
    cold: {
      bg: 'bg-gradient-to-r from-sky-50 to-blue-50',
      border: 'border-sky-200',
      text: 'text-sky-700',
      icon: Snowflake,
      iconColor: 'text-sky-500',
    },
  };

  const theme = themes[label] || themes.cold;
  const Icon = theme.icon;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${theme.bg} ${theme.border} ${theme.text}`}>
      <Icon size={12} className={theme.iconColor} />
      {score}
      <span className="font-medium capitalize opacity-75">{label}</span>
    </span>
  );
}
