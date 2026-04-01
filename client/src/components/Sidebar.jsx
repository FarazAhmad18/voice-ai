import { useState, useRef, useEffect, useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useFirm } from '../context/FirmContext';
import { fetchLeads } from '../services/api';
import { supabase } from '../services/supabase';
import {
  LayoutDashboard, Users, Calendar, CalendarDays, Settings,
  Building2, FileText, Activity, LogOut, Search, Bell,
  Menu, X, Shield, BookOpen,
  PanelLeftClose, PanelLeft,
} from 'lucide-react';

const clientNav = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/leads', label: 'Leads', icon: Users },
  { path: '/appointments', label: 'Appointments', icon: Calendar },
  { path: '/calendar', label: 'Calendar', icon: CalendarDays },
  { path: '/staff', label: 'Staff', icon: Users, adminOnly: true },
  { path: '/settings', label: 'Settings', icon: Settings, adminOnly: true },
];

const adminNav = [
  { path: '/admin', label: 'Overview', icon: LayoutDashboard },
  { path: '/admin/clients', label: 'Clients', icon: Building2 },
  { path: '/admin/templates', label: 'Templates', icon: FileText },
  { path: '/admin/logs', label: 'Logs', icon: Activity },
  { path: '/admin/manual', label: 'Manual', icon: BookOpen },
];

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, firm, logout, isSuperAdmin } = useAuth();
  const { agentName } = useFirm();

  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('sidebar-collapsed') === 'true'; } catch { return false; }
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  const userMenuRef = useRef(null);
  const notifRef = useRef(null);
  const searchRef = useRef(null);

  const isAdminSection = location.pathname.startsWith('/admin');
  const isAdminRole = user?.role === 'admin' || user?.role === 'super_admin';
  const navItems = (isSuperAdmin && isAdminSection ? adminNav : clientNav)
    .filter(item => !item.adminOnly || isAdminRole);
  const brandName = isSuperAdmin && isAdminSection ? 'VoibixAI' : (firm?.name || 'VoibixAI');

  // Persist collapsed state
  useEffect(() => {
    try { localStorage.setItem('sidebar-collapsed', collapsed); } catch {}
  }, [collapsed]);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
    setNotifOpen(false);
    setUserMenuOpen(false);
  }, [location.pathname]);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) setUserMenuOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Cmd+K to focus search
  useEffect(() => {
    function handleKeyDown(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Fetch today's leads as notifications
  useEffect(() => {
    async function loadNotifications() {
      try {
        const leads = await fetchLeads();
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        setNotifications(leads.filter(l => new Date(l.created_at) >= today));
      } catch {}
    }
    if (user) loadNotifications();
  }, [user]);

  // Realtime notifications
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('sidebar-notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'leads' }, (payload) => {
        setNotifications(prev => {
          if (prev.some(n => n.id === payload.new.id)) return prev;
          return [payload.new, ...prev];
        });
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [user]);

  const unreadCount = notifications.length;

  const groupedNotifications = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
    const yesterdayStart = new Date(todayStart); yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    const groups = { today: [], yesterday: [], older: [] };
    notifications.slice(0, 15).forEach(n => {
      const d = new Date(n.created_at);
      if (d >= todayStart) groups.today.push(n);
      else if (d >= yesterdayStart) groups.yesterday.push(n);
      else groups.older.push(n);
    });
    return groups;
  }, [notifications]);

  function formatNotifTime(dateStr) {
    if (!dateStr) return '';
    const diffMin = Math.floor((new Date() - new Date(dateStr)) / 60000);
    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    return `${Math.floor(diffHr / 24)}d ago`;
  }

  function isActive(path) {
    if (path === '/' || path === '/admin') return location.pathname === path;
    return location.pathname.startsWith(path);
  }

  function handleSearch(e) {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/leads?search=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery('');
      searchRef.current?.blur();
    }
  }

  const initials = ((user?.name || 'U').split(' ').map(n => n?.[0] || '').join('').slice(0, 2).toUpperCase()) || '?';

  function renderNotifGroup(label, items) {
    if (items.length === 0) return null;
    return (
      <div key={label}>
        <div className="px-4 py-2 bg-slate-50/80">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{label}</p>
        </div>
        {items.map((lead) => {
          const li = ((lead.caller_name || 'U').split(' ').map(n => n?.[0] || '').join('').slice(0, 2).toUpperCase()) || '?';
          return (
            <Link
              key={lead.id}
              to={`/leads/${lead.id}`}
              onClick={() => setNotifOpen(false)}
              className="group flex items-start gap-3 px-4 py-3 hover:bg-slate-50 transition-colors duration-150"
            >
              <div className="relative flex-shrink-0">
                <div className="w-8 h-8 bg-violet-100 rounded-full flex items-center justify-center text-[11px] font-semibold text-violet-700">
                  {li}
                </div>
                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-blue-500 rounded-full border-2 border-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-slate-800 truncate">{lead.caller_name || 'Unknown Caller'}</p>
                  <span className="text-[10px] text-slate-300 flex-shrink-0 tabular-nums">{formatNotifTime(lead.created_at)}</span>
                </div>
                <p className="text-xs text-slate-400 truncate mt-0.5">
                  <span className="capitalize">{lead.case_type || 'New lead'}</span>
                  {lead.score_label === 'hot' && <span className="ml-1.5 text-red-500 font-semibold">Hot</span>}
                  {lead.score_label === 'warm' && <span className="ml-1.5 text-amber-500 font-semibold">Warm</span>}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    );
  }

  // Sidebar content shared between desktop and mobile
  const sidebarContent = (
    <>
      {/* Logo section */}
      <div className={`flex items-center h-14 border-b border-slate-200 px-4 flex-shrink-0 ${collapsed ? 'justify-center' : 'gap-3'}`}>
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: isAdminSection ? '#09090b' : (firm?.brand_color || '#09090b') }}
        >
          <span className="text-white text-sm font-bold">{brandName.charAt(0)}</span>
        </div>
        {!collapsed && (
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-900 truncate">{brandName}</p>
            {!isAdminSection && firm?.retell_agent_id && (
              <p className="text-[10px] text-emerald-600 font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                {agentName}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Search */}
      {collapsed ? (
        <div className="px-3 pt-3 pb-1 flex justify-center">
          <button
            onClick={() => setCollapsed(false)}
            title="Search (Ctrl+K)"
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-colors"
          >
            <Search size={16} />
          </button>
        </div>
      ) : (
        <div className="px-3 pt-3 pb-1">
          <form onSubmit={handleSearch} className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" />
            <input
              ref={searchRef}
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-200 focus:border-slate-200 placeholder:text-slate-300"
            />
          </form>
        </div>
      )}

      {/* Nav items */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
        {navItems.map((item) => {
          const active = isActive(item.path);
          const Icon = item.icon;
          return (
            <Link
              key={item.path}
              to={item.path}
              title={collapsed ? item.label : undefined}
              className={`flex items-center gap-3 py-2 rounded-lg text-[13px] font-medium transition-colors duration-150 ${
                active
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
              } ${collapsed ? 'justify-center px-2' : 'px-3'}`}
            >
              <Icon size={18} className={`flex-shrink-0 ${active ? 'text-white' : 'text-slate-400'}`} />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}

        {/* Admin/Client switch */}
        {isSuperAdmin && (
          <Link
            to={isAdminSection ? '/' : '/admin'}
            title={collapsed ? (isAdminSection ? 'Client View' : 'Admin') : undefined}
            className={`flex items-center gap-3 py-2 rounded-lg text-[13px] font-medium text-violet-600 hover:bg-violet-50 transition-colors duration-150 mt-2 ${collapsed ? 'justify-center px-2' : 'px-3'}`}
          >
            <Shield size={18} />
            {!collapsed && <span>{isAdminSection ? 'Client View' : 'Admin'}</span>}
          </Link>
        )}
      </nav>

      {/* Bottom section */}
      <div className="flex-shrink-0 border-t border-slate-200">
        {/* Notifications */}
        <div className="relative px-3 py-1" ref={notifRef}>
          <button
            onClick={() => setNotifOpen(!notifOpen)}
            title={collapsed ? 'Notifications' : undefined}
            className={`w-full flex items-center gap-3 py-2 rounded-lg text-[13px] font-medium transition-colors duration-150 ${
              notifOpen ? 'bg-slate-100 text-slate-700' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
            } ${collapsed ? 'justify-center px-2' : 'px-3'}`}
          >
            <div className="relative">
              <Bell size={18} className="text-slate-400" />
              {unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </div>
            {!collapsed && <span>Notifications</span>}
          </button>

          {/* Notification popover */}
          {notifOpen && (
            <div className="absolute bottom-0 left-full ml-2 w-[340px] bg-white rounded-lg shadow-xl border border-slate-200 z-50 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Notifications</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">{unreadCount} new lead{unreadCount !== 1 ? 's' : ''} today</p>
                </div>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-[10px] font-semibold rounded-full border border-blue-100">
                    {unreadCount} new
                  </span>
                )}
              </div>
              <div className="max-h-[350px] overflow-y-auto divide-y divide-slate-50">
                {notifications.length === 0 ? (
                  <div className="py-10 text-center">
                    <Bell size={20} className="text-slate-300 mx-auto mb-2" />
                    <p className="text-sm text-slate-400">No new leads today</p>
                  </div>
                ) : (
                  <>
                    {renderNotifGroup('Today', groupedNotifications.today)}
                    {renderNotifGroup('Yesterday', groupedNotifications.yesterday)}
                    {renderNotifGroup('Earlier', groupedNotifications.older)}
                  </>
                )}
              </div>
              {notifications.length > 0 && (
                <Link
                  to="/leads"
                  onClick={() => setNotifOpen(false)}
                  className="flex items-center justify-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-50 py-2.5 border-t border-slate-100 transition-colors"
                >
                  View all leads &rarr;
                </Link>
              )}
            </div>
          )}
        </div>

        {/* User section */}
        <div className="relative px-3 py-2" ref={userMenuRef}>
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className={`w-full flex items-center gap-3 py-2 rounded-lg transition-colors duration-150 ${
              userMenuOpen ? 'bg-slate-100' : 'hover:bg-slate-50'
            } ${collapsed ? 'justify-center px-2' : 'px-3'}`}
          >
            <div className="w-7 h-7 bg-slate-800 rounded-full flex items-center justify-center text-[11px] font-semibold text-white flex-shrink-0">
              {initials}
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0 text-left">
                <p className="text-[13px] font-medium text-slate-700 truncate">{user?.name}</p>
                <p className="text-[10px] text-slate-400 capitalize">{user?.role?.replace('_', ' ')}</p>
              </div>
            )}
          </button>

          {/* User dropdown */}
          {userMenuOpen && (
            <div className={`absolute ${collapsed ? 'left-full ml-2 bottom-0' : 'bottom-full left-3 right-3 mb-1'} bg-white rounded-lg shadow-xl border border-slate-200 z-50 overflow-hidden`}>
              <div className="py-1">
                <Link
                  to="/settings"
                  onClick={() => setUserMenuOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  <Settings size={15} className="text-slate-400" />
                  Settings
                </Link>
              </div>
              <div className="border-t border-slate-100 py-1">
                <button
                  onClick={() => { setUserMenuOpen(false); logout(); }}
                  className="flex items-center gap-2.5 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  <LogOut size={15} />
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Collapse toggle — desktop only */}
        <div className="hidden md:block px-3 pb-3">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors"
          >
            {collapsed ? <PanelLeft size={16} /> : <PanelLeftClose size={16} />}
            {!collapsed && <span>Collapse</span>}
          </button>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className={`hidden md:flex flex-col h-screen bg-white border-r border-slate-200 flex-shrink-0 sticky top-0 transition-all duration-200 ${collapsed ? 'w-16' : 'w-60'}`}>
        {sidebarContent}
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-white border-b border-slate-200 h-14 flex items-center px-4 gap-3">
        <button onClick={() => setMobileOpen(true)} className="p-1.5 rounded-lg hover:bg-slate-50">
          <Menu size={20} className="text-slate-600" />
        </button>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: isAdminSection ? '#09090b' : (firm?.brand_color || '#09090b') }}
          >
            <span className="text-white text-xs font-bold">{brandName.charAt(0)}</span>
          </div>
          <span className="text-sm font-semibold text-slate-900 truncate">{brandName}</span>
        </div>
        {/* Mobile notification bell */}
        <div className="relative" ref={notifRef}>
          <button onClick={() => setNotifOpen(!notifOpen)} className="p-1.5 rounded-lg hover:bg-slate-50 relative">
            <Bell size={18} className="text-slate-400" />
            {unreadCount > 0 && (
              <span className="absolute top-0.5 right-0.5 w-3.5 h-3.5 bg-red-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-64 bg-white flex flex-col shadow-xl">
            <div className="flex items-center justify-end px-3 pt-3">
              <button onClick={() => setMobileOpen(false)} className="p-1.5 rounded-lg hover:bg-slate-50">
                <X size={18} className="text-slate-400" />
              </button>
            </div>
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
}
