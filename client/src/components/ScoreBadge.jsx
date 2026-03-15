export default function ScoreBadge({ score, label }) {
  const themes = {
    hot: { bg: 'bg-red-50', text: 'text-red-700' },
    warm: { bg: 'bg-amber-50', text: 'text-amber-700' },
    cold: { bg: 'bg-slate-50', text: 'text-slate-500' },
  };

  const theme = themes[label] || themes.cold;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${theme.bg} ${theme.text}`}>
      {score}
      <span className="capitalize opacity-70">{label}</span>
    </span>
  );
}
