import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, Calendar, Settings, Phone, Scale } from 'lucide-react';

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/leads', label: 'Leads', icon: Users },
  { path: '/appointments', label: 'Appointments', icon: Calendar },
  { path: '/settings', label: 'Settings', icon: Settings },
];

export default function Sidebar() {
  const location = useLocation();

  return (
    <aside className="w-72 bg-slate-900 text-white min-h-screen flex flex-col">
      {/* Brand */}
      <div className="px-6 py-6 border-b border-slate-700/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Scale size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight">LawVoice AI</h1>
            <p className="text-xs text-slate-400">Mitchell Family Law</p>
          </div>
        </div>
      </div>

      {/* AI Assistant Status */}
      <div className="px-4 py-4 border-b border-slate-700/50">
        <div className="flex items-center gap-3 px-3 py-3 bg-slate-800/60 rounded-xl border border-slate-700/50">
          <div className="relative">
            <div className="w-9 h-9 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-full flex items-center justify-center text-sm font-bold shadow-lg shadow-emerald-500/20">
              S
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-400 rounded-full border-2 border-slate-900 animate-pulse"></div>
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-slate-200">Sarah</p>
            <p className="text-[11px] text-emerald-400 font-medium">Online - Taking Calls</p>
          </div>
          <Phone size={14} className="text-emerald-400" />
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-5 space-y-1">
        <p className="px-3 mb-3 text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">Menu</p>
        {navItems.map((item) => {
          const isActive = location.pathname === item.path ||
            (item.path !== '/' && location.pathname.startsWith(item.path));
          const Icon = item.icon;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200 ${
                isActive
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                  : 'text-slate-400 hover:bg-slate-800/70 hover:text-white'
              }`}
            >
              <Icon size={18} strokeWidth={isActive ? 2.5 : 1.8} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-slate-700/50">
        <div className="flex items-center gap-3 px-2">
          <div className="w-9 h-9 bg-gradient-to-br from-slate-600 to-slate-700 rounded-full flex items-center justify-center text-xs font-bold text-slate-300">
            ML
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-slate-300">Mitchell Law</p>
            <p className="text-[11px] text-slate-500">Admin Account</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
