export default function ScoreBadge({ score, label }) {
  const themes = {
    hot: { bg: 'bg-red-50 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400' },
    warm: { bg: 'bg-amber-50 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400' },
    cold: { bg: 'bg-slate-50 dark:bg-zinc-900', text: 'text-slate-500 dark:text-zinc-500' },
  };

  const theme = themes[label] || themes.cold;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${theme.bg} ${theme.text}`}>
      {score}
      <span className="capitalize opacity-70">{label}</span>
    </span>
  );
}
