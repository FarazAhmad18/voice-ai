import { Phone, Calendar, UserPlus, AlertTriangle } from 'lucide-react';

const iconMap = {
  call: { icon: Phone, bg: 'bg-blue-50', color: 'text-blue-600' },
  appointment: { icon: Calendar, bg: 'bg-violet-50', color: 'text-violet-600' },
  lead: { icon: UserPlus, bg: 'bg-emerald-50', color: 'text-emerald-600' },
  alert: { icon: AlertTriangle, bg: 'bg-red-50', color: 'text-red-600' },
};

export default function ActivityFeed({ activities = [] }) {
  if (activities.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-slate-400">No recent activity</p>
        <p className="text-xs text-slate-300 mt-1">Activity will appear here as calls come in</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {activities.map((activity, i) => {
        const config = iconMap[activity.type] || iconMap.call;
        const Icon = config.icon;
        return (
          <div key={i} className="flex items-start gap-3 px-4 py-3 rounded-xl hover:bg-slate-50 transition-colors">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${config.bg}`}>
              <Icon size={14} className={config.color} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-slate-700">{activity.text}</p>
              <p className="text-xs text-slate-400 mt-0.5">{activity.time}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
