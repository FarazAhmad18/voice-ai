import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, Calendar, Settings, Phone } from 'lucide-react';

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/leads', label: 'Leads', icon: Users },
  { path: '/appointments', label: 'Appointments', icon: Calendar },
  { path: '/settings', label: 'Settings', icon: Settings },
];

export default function Sidebar() {
  const location = useLocation();

  return (
    <aside className="w-[260px] min-h-screen flex flex-col bg-white/70 backdrop-blur-xl border-r border-slate-100">
      {/* Brand */}
      <div className="px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-slate-900 rounded-xl flex items-center justify-center">
            <span className="text-white text-sm font-bold">L</span>
          </div>
          <div>
            <h1 className="text-[15px] font-semibold text-slate-900 tracking-tight">LawVoice</h1>
            <p className="text-[11px] text-slate-400 font-medium">AI Intake Platform</p>
          </div>
        </div>
      </div>

      {/* Sarah status */}
      <div className="mx-4 mb-4">
        <div className="flex items-center gap-3 px-3.5 py-3 bg-slate-50 rounded-xl">
          <div className="relative">
            <div className="w-8 h-8 bg-emerald-50 rounded-full flex items-center justify-center">
              <Phone size={14} className="text-emerald-600" />
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-800">Sarah</p>
            <p className="text-[11px] text-emerald-600 font-medium">Active</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 space-y-0.5">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path ||
            (item.path !== '/' && location.pathname.startsWith(item.path));
          const Icon = item.icon;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-150 ${
                isActive
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
              }`}
            >
              <Icon size={17} strokeWidth={isActive ? 2 : 1.7} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-slate-100">
        <div className="flex items-center gap-3 px-2">
          <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-xs font-semibold text-slate-600">
            ML
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-700 truncate">Mitchell Law</p>
            <p className="text-[11px] text-slate-400">Admin</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
