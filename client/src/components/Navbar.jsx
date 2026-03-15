import { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useFirm } from '../context/FirmContext';
import { fetchLeads } from '../services/api';
import { supabase } from '../services/supabase';
import {
  LayoutDashboard, Users, UserCheck, Calendar, Settings, Phone,
  Building2, FileText, Activity, LogOut, Shield, Search, Bell,
  Menu, X, ChevronDown,
} from 'lucide-react';

const clientNav = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/leads', label: 'Leads', icon: Users },
  { path: '/follow-ups', label: 'Follow Ups', icon: UserCheck },
  { path: '/staff', label: 'Staff', icon: Users, adminOnly: true },
  { path: '/appointments', label: 'Appointments', icon: Calendar },
  { path: '/settings', label: 'Settings', icon: Settings },
];

const adminNav = [
  { path: '/admin', label: 'Overview', icon: LayoutDashboard },
  { path: '/admin/clients', label: 'Clients', icon: Building2 },
  { path: '/admin/templates', label: 'Templates', icon: FileText },
  { path: '/admin/logs', label: 'Logs', icon: Activity },
];

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, firm, logout, isSuperAdmin } = useAuth();
  const { agentName } = useFirm();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const userMenuRef = useRef(null);
  const notifRef = useRef(null);

  const isAdminSection = location.pathname.startsWith('/admin');
  const isAdminRole = user?.role === 'admin' || user?.role === 'super_admin';
  const navItems = (isSuperAdmin && isAdminSection ? adminNav : clientNav)
    .filter(item => !item.adminOnly || isAdminRole);
  const brandName = isSuperAdmin && isAdminSection ? 'LeapingAI' : (firm?.name || 'LeapingAI');

  // Close user menu on outside click
  useEffect(() => {
    function handleClick(e) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
    setNotifOpen(false);
  }, [location.pathname]);

  // Close notification dropdown on outside click
  useEffect(() => {
    function handleClick(e) {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Fetch today's leads as notifications on mount
  useEffect(() => {
    async function loadNotifications() {
      try {
        const leads = await fetchLeads();
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayLeads = leads.filter((l) => {
          const created = new Date(l.created_at);
          return created >= today;
        });
        setNotifications(todayLeads);
      } catch (err) {
        console.error('Failed to load notifications:', err);
      }
    }
    if (user) loadNotifications();
  }, [user]);

  // Realtime: add new leads to notifications
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('navbar-notifications')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'leads' },
        (payload) => {
          setNotifications((prev) => [payload.new, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  function formatNotifTime(dateStr) {
    if (!dateStr) return '';
    const now = new Date();
    const date = new Date(dateStr);
    const diffMin = Math.floor((now - date) / 60000);
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
    }
  }

  const initials = user?.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?';

  return (
    <nav className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-slate-200/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Left: Brand + Nav */}
          <div className="flex items-center gap-8">
            {/* Brand */}
            <Link to={isAdminSection ? '/admin' : '/'} className="flex items-center gap-2.5 flex-shrink-0">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: isAdminSection ? '#0f172a' : (firm?.brand_color || '#0f172a') }}
              >
                <span className="text-white text-sm font-bold">{brandName.charAt(0)}</span>
              </div>
              <span className="text-[15px] font-semibold text-slate-900 tracking-tight hidden sm:block">{brandName}</span>
              {/* Agent status pill */}
              {!isAdminSection && firm?.retell_agent_id && (
                <span className="hidden md:inline-flex items-center gap-1.5 px-2 py-0.5 bg-emerald-50 rounded-full text-[11px] font-medium text-emerald-700">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                  {agentName}
                </span>
              )}
            </Link>

            {/* Desktop Nav */}
            <div className="hidden md:flex items-center gap-1">
              {navItems.map((item) => {
                const active = isActive(item.path);
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      active
                        ? 'text-slate-900 bg-slate-100'
                        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
              {/* Admin/Client switch */}
              {isSuperAdmin && (
                <Link
                  to={isAdminSection ? '/' : '/admin'}
                  className="ml-1 px-3 py-2 rounded-lg text-sm font-medium text-violet-600 hover:bg-violet-50 transition-all"
                >
                  {isAdminSection ? 'Client View' : 'Admin'}
                </Link>
              )}
            </div>
          </div>

          {/* Right: Search + User */}
          <div className="flex items-center gap-2">
            {/* Search */}
            <form onSubmit={handleSearch} className="hidden sm:block relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
              <input
                type="text"
                placeholder="Search leads..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-48 lg:w-56 pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-200 focus:border-slate-200 placeholder:text-slate-300 transition-all"
              />
            </form>

            {/* Notifications */}
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => setNotifOpen(!notifOpen)}
                className="relative p-2 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <Bell size={18} className="text-slate-400" />
                {notifications.length > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                    {notifications.length > 9 ? '9+' : notifications.length}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 top-12 w-80 bg-white rounded-xl shadow-lg shadow-slate-200/50 border border-slate-100 z-50 overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-900">Notifications</p>
                    <span className="text-xs text-slate-400">{notifications.length} today</span>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="py-8 text-center">
                        <Bell size={20} className="text-slate-200 mx-auto mb-2" />
                        <p className="text-sm text-slate-400">No new leads today</p>
                      </div>
                    ) : (
                      notifications.slice(0, 10).map((lead) => {
                        const initials = lead.caller_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '??';
                        return (
                          <Link
                            key={lead.id}
                            to={`/leads/${lead.id}`}
                            onClick={() => setNotifOpen(false)}
                            className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0"
                          >
                            <div className="w-8 h-8 bg-blue-50 rounded-full flex items-center justify-center text-[10px] font-semibold text-blue-600 flex-shrink-0">
                              {initials}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-800 truncate">{lead.caller_name || 'Unknown Caller'}</p>
                              <p className="text-xs text-slate-400 truncate">
                                <span className="capitalize">{lead.case_type || 'New lead'}</span>
                                {lead.score_label === 'hot' && <span className="ml-1.5 text-red-500 font-medium">Hot</span>}
                              </p>
                            </div>
                            <span className="text-[10px] text-slate-300 flex-shrink-0">{formatNotifTime(lead.created_at)}</span>
                          </Link>
                        );
                      })
                    )}
                  </div>
                  {notifications.length > 0 && (
                    <Link
                      to="/leads"
                      onClick={() => setNotifOpen(false)}
                      className="block text-center text-xs font-medium text-blue-600 hover:bg-blue-50 py-2.5 border-t border-slate-100 transition-colors"
                    >
                      View all leads
                    </Link>
                  )}
                </div>
              )}
            </div>

            {/* User Menu */}
            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 pl-2 pr-1.5 py-1.5 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <div className="w-7 h-7 bg-slate-900 rounded-full flex items-center justify-center text-[11px] font-semibold text-white">
                  {initials}
                </div>
                <ChevronDown size={14} className={`text-slate-400 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 top-12 w-56 bg-white rounded-xl shadow-lg shadow-slate-200/50 border border-slate-100 py-1 z-50">
                  <div className="px-4 py-3 border-b border-slate-50">
                    <p className="text-sm font-medium text-slate-900">{user?.name}</p>
                    <p className="text-xs text-slate-400 capitalize">{user?.role?.replace('_', ' ')}</p>
                  </div>
                  <Link
                    to="/settings"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    <Settings size={15} />
                    Settings
                  </Link>
                  <button
                    onClick={() => { setUserMenuOpen(false); logout(); }}
                    className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <LogOut size={15} />
                    Sign out
                  </button>
                </div>
              )}
            </div>

            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden p-2 rounded-lg hover:bg-slate-50 transition-colors"
            >
              {mobileOpen ? <X size={20} className="text-slate-600" /> : <Menu size={20} className="text-slate-600" />}
            </button>
          </div>
        </div>

        {/* Mobile Nav */}
        {mobileOpen && (
          <div className="md:hidden border-t border-slate-100 py-3 space-y-1">
            {/* Mobile search */}
            <form onSubmit={handleSearch} className="relative mb-3 sm:hidden">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
              <input
                type="text"
                placeholder="Search leads..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-200 placeholder:text-slate-300"
              />
            </form>

            {navItems.map((item) => {
              const active = isActive(item.path);
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    active
                      ? 'text-slate-900 bg-slate-100'
                      : 'text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  <Icon size={16} />
                  {item.label}
                </Link>
              );
            })}
            {isSuperAdmin && (
              <Link
                to={isAdminSection ? '/' : '/admin'}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-violet-600 hover:bg-violet-50 transition-all"
              >
                <Shield size={16} />
                {isAdminSection ? 'Client View' : 'Admin Panel'}
              </Link>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}
