import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LayoutDashboard, Users, Calendar, Settings, Phone, Building2, FileText, Activity, LogOut, Shield } from 'lucide-react';

const clientNav = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/leads', label: 'Leads', icon: Users },
  { path: '/appointments', label: 'Appointments', icon: Calendar },
  { path: '/settings', label: 'Settings', icon: Settings },
];

const adminNav = [
  { path: '/admin', label: 'Overview', icon: LayoutDashboard },
  { path: '/admin/clients', label: 'Clients', icon: Building2 },
  { path: '/admin/templates', label: 'Templates', icon: FileText },
  { path: '/admin/logs', label: 'System Logs', icon: Activity },
];

export default function Sidebar() {
  const location = useLocation();
  const { user, firm, logout, isSuperAdmin } = useAuth();

  const isAdminSection = location.pathname.startsWith('/admin');
  const navItems = isSuperAdmin && isAdminSection ? adminNav : clientNav;
  const brandName = isSuperAdmin && isAdminSection ? 'LeapingAI' : (firm?.name || 'Dashboard');
  const brandSub = isSuperAdmin && isAdminSection ? 'Admin Panel' : (firm?.industry ? firm.industry.charAt(0).toUpperCase() + firm.industry.slice(1) : 'AI Platform');

  return (
    <aside className="w-[260px] min-h-screen flex flex-col bg-white/70 backdrop-blur-xl border-r border-slate-100">
      {/* Brand */}
      <div className="px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: isSuperAdmin && isAdminSection ? '#0f172a' : (firm?.brand_color || '#0f172a') }}>
            <span className="text-white text-sm font-bold">{brandName.charAt(0)}</span>
          </div>
          <div>
            <h1 className="text-[15px] font-semibold text-slate-900 tracking-tight">{brandName}</h1>
            <p className="text-[11px] text-slate-400 font-medium capitalize">{brandSub}</p>
          </div>
        </div>
      </div>

      {/* Agent status (client view only) */}
      {!isAdminSection && firm?.agent_name && (
        <div className="mx-4 mb-4">
          <div className="flex items-center gap-3 px-3.5 py-3 bg-slate-50 rounded-xl">
            <div className="relative">
              <div className="w-8 h-8 bg-emerald-50 rounded-full flex items-center justify-center">
                <Phone size={14} className="text-emerald-600" />
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-800">{firm.agent_name}</p>
              <p className="text-[11px] text-emerald-600 font-medium">Active</p>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-3 space-y-0.5">
        {navItems.map((item) => {
          const isActive = isAdminSection
            ? (item.path === '/admin' ? location.pathname === '/admin' : location.pathname.startsWith(item.path))
            : (item.path === '/' ? location.pathname === '/' : location.pathname.startsWith(item.path));
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

        {/* Switch between admin and client view */}
        {isSuperAdmin && (
          <div className="pt-4 mt-4 border-t border-slate-100">
            {isAdminSection ? (
              <Link to="/" className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[13px] font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition-all">
                <LayoutDashboard size={17} strokeWidth={1.7} />
                Client View
              </Link>
            ) : (
              <Link to="/admin" className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[13px] font-medium text-violet-600 hover:bg-violet-50 transition-all">
                <Shield size={17} strokeWidth={1.7} />
                Admin Panel
              </Link>
            )}
          </div>
        )}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-slate-100">
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-xs font-semibold text-slate-600">
              {user?.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-700 truncate">{user?.name || 'User'}</p>
              <p className="text-[11px] text-slate-400 capitalize">{user?.role?.replace('_', ' ') || ''}</p>
            </div>
          </div>
          <button onClick={logout} className="p-2 text-slate-400 hover:text-red-500 transition-colors" title="Sign out">
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </aside>
  );
}
