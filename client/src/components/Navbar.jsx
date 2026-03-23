import { useState, useRef, useEffect, useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useFirm } from '../context/FirmContext';
import { fetchLeads } from '../services/api';
import { supabase } from '../services/supabase';
import {
  LayoutDashboard, Users, UserCheck, Calendar, Settings, Phone,
  Building2, FileText, Activity, LogOut, Shield, Search, Bell,
  Menu, X, ChevronDown, Command, Keyboard, Brain, BookOpen,
} from 'lucide-react';

const clientNav = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/leads', label: 'Leads', icon: Users },
  { path: '/follow-ups', label: 'Follow Ups', icon: UserCheck },
  { path: '/staff', label: 'Staff', icon: Users, adminOnly: true },
  { path: '/knowledge', label: 'AI Knowledge', icon: Brain, adminOnly: true },
  { path: '/appointments', label: 'Appointments', icon: Calendar },
  { path: '/settings', label: 'Settings', icon: Settings },
];

const adminNav = [
  { path: '/admin', label: 'Overview', icon: LayoutDashboard },
  { path: '/admin/clients', label: 'Clients', icon: Building2 },
  { path: '/admin/templates', label: 'Templates', icon: FileText },
  { path: '/admin/logs', label: 'Logs', icon: Activity },
  { path: '/admin/manual', label: 'Manual', icon: BookOpen },
];

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, firm, logout, isSuperAdmin } = useAuth();
  const { agentName } = useFirm();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const userMenuRef = useRef(null);
  const notifRef = useRef(null);
  const searchRef = useRef(null);

  const isAdminSection = location.pathname.startsWith('/admin');
  const isAdminRole = user?.role === 'admin' || user?.role === 'super_admin';
  const navItems = (isSuperAdmin && isAdminSection ? adminNav : clientNav)
    .filter(item => !item.adminOnly || isAdminRole);
  const brandName = isSuperAdmin && isAdminSection ? 'VoibixAI' : (firm?.name || 'VoibixAI');

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
        // silently fail on notification load
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
          setNotifications((prev) => {
            if (prev.some(n => n.id === payload.new.id)) return prev;
            return [payload.new, ...prev];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Group notifications by time
  const groupedNotifications = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);

    const groups = { today: [], yesterday: [], older: [] };
    notifications.slice(0, 15).forEach(n => {
      const d = new Date(n.created_at);
      if (d >= todayStart) groups.today.push(n);
      else if (d >= yesterdayStart) groups.yesterday.push(n);
      else groups.older.push(n);
    });
    return groups;
  }, [notifications]);

  const unreadCount = notifications.length;

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
      searchRef.current?.blur();
    }
  }

  const initials = ((user?.name || 'U').split(' ').map(n => n?.[0] || '').join('').slice(0, 2).toUpperCase()) || '?';

  function renderNotifGroup(label, items) {
    if (items.length === 0) return null;
    return (
      <div key={label}>
        <div className="px-4 py-2 bg-zinc-50/80">
          <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">{label}</p>
        </div>
        {items.map((lead) => {
          const li = ((lead.caller_name || 'U').split(' ').map(n => n?.[0] || '').join('').slice(0, 2).toUpperCase()) || '?';
          return (
            <Link
              key={lead.id}
              to={`/leads/${lead.id}`}
              onClick={() => setNotifOpen(false)}
              className="group flex items-start gap-3 px-4 py-3 hover:bg-zinc-50 transition-colors duration-150"
            >
              <div className="relative flex-shrink-0">
                <div className="w-9 h-9 bg-gradient-to-br from-violet-100 to-blue-100 rounded-full flex items-center justify-center text-[11px] font-semibold text-violet-700">
                  {li}
                </div>
                {/* Unread dot */}
                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-blue-500 rounded-full border-2 border-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-zinc-800 truncate group-hover:text-zinc-900">{lead.caller_name || 'Unknown Caller'}</p>
                  <span className="text-[10px] text-zinc-300 flex-shrink-0 tabular-nums">{formatNotifTime(lead.created_at)}</span>
                </div>
                <p className="text-xs text-zinc-400 truncate mt-0.5">
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

  return (
    <nav className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-zinc-200/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-[60px]">
          {/* Left: Brand + Nav */}
          <div className="flex items-center gap-8">
            {/* Brand */}
            <Link to={isAdminSection ? '/admin' : '/'} className="flex items-center gap-2.5 flex-shrink-0 group">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center transition-transform duration-200 group-hover:scale-105"
                style={{ backgroundColor: isAdminSection ? '#09090b' : (firm?.brand_color || '#09090b') }}
              >
                <span className="text-white text-sm font-bold">{brandName.charAt(0)}</span>
              </div>
              <span className="text-[15px] font-semibold text-zinc-900 tracking-tight hidden sm:block">{brandName}</span>
              {/* Agent status pill */}
              {!isAdminSection && firm?.retell_agent_id && (
                <span className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 rounded-full text-[11px] font-medium text-emerald-700 border border-emerald-100">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                  {agentName}
                </span>
              )}
            </Link>

            {/* Desktop Nav — pill active style with bottom indicator */}
            <div className="hidden md:flex items-center gap-0.5">
              {navItems.map((item) => {
                const active = isActive(item.path);
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`relative px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-200 ${
                      active
                        ? 'text-zinc-900'
                        : 'text-zinc-400 hover:text-zinc-600 hover:bg-zinc-50'
                    }`}
                  >
                    {item.label}
                    {/* Active indicator bar */}
                    {active && (
                      <span className="absolute bottom-[-19px] left-3 right-3 h-[2px] bg-zinc-900 rounded-full" />
                    )}
                  </Link>
                );
              })}
              {/* Admin/Client switch */}
              {isSuperAdmin && (
                <Link
                  to={isAdminSection ? '/' : '/admin'}
                  className="ml-2 px-3 py-1.5 rounded-lg text-[13px] font-medium text-violet-600 bg-violet-50 hover:bg-violet-100 border border-violet-100 transition-all duration-200"
                >
                  {isAdminSection ? 'Client View' : 'Admin'}
                </Link>
              )}
            </div>
          </div>

          {/* Right: Search + Notifications + User */}
          <div className="flex items-center gap-1.5">
            {/* Search with Cmd+K hint */}
            <form onSubmit={handleSearch} className="hidden sm:block relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-300 pointer-events-none" />
              <input
                ref={searchRef}
                type="text"
                placeholder="Search leads..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                className={`w-48 lg:w-56 pl-9 pr-14 py-2 text-sm bg-zinc-50 border rounded-lg focus:outline-none placeholder:text-zinc-300 transition-all duration-200 ${
                  searchFocused
                    ? 'border-zinc-300 bg-white ring-2 ring-zinc-900/5 w-64 lg:w-72'
                    : 'border-zinc-100 hover:border-zinc-200'
                }`}
              />
              {/* Cmd+K badge */}
              {!searchFocused && !searchQuery && (
                <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5 pointer-events-none">
                  <kbd className="inline-flex items-center justify-center w-5 h-5 bg-zinc-100 border border-zinc-200 rounded text-[10px] font-medium text-zinc-400">
                    <Command size={10} />
                  </kbd>
                  <kbd className="inline-flex items-center justify-center w-5 h-5 bg-zinc-100 border border-zinc-200 rounded text-[10px] font-medium text-zinc-400">
                    K
                  </kbd>
                </div>
              )}
            </form>

            {/* Notifications */}
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => setNotifOpen(!notifOpen)}
                className={`relative p-2.5 rounded-lg transition-all duration-200 ${
                  notifOpen ? 'bg-zinc-100' : 'hover:bg-zinc-50'
                }`}
              >
                <Bell size={18} className={`transition-colors ${notifOpen ? 'text-zinc-700' : 'text-zinc-400'}`} />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center ring-2 ring-white">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {/* Notification dropdown with animation */}
              <div className={`absolute right-0 top-[calc(100%+8px)] w-[calc(100vw-2rem)] sm:w-[360px] max-w-[360px] bg-white rounded-xl shadow-xl shadow-zinc-200/50 border border-zinc-200/80 z-50 overflow-hidden transition-all duration-200 origin-top-right ${
                notifOpen ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 -translate-y-2 pointer-events-none'
              }`}>
                <div className="px-4 py-3.5 border-b border-zinc-100 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-zinc-900">Notifications</p>
                    <p className="text-[11px] text-zinc-400 mt-0.5">{unreadCount} new lead{unreadCount !== 1 ? 's' : ''} today</p>
                  </div>
                  {unreadCount > 0 && (
                    <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-[10px] font-semibold rounded-full border border-blue-100">
                      {unreadCount} new
                    </span>
                  )}
                </div>
                <div className="max-h-[400px] overflow-y-auto divide-y divide-zinc-50">
                  {notifications.length === 0 ? (
                    <div className="py-12 text-center">
                      <div className="w-12 h-12 bg-zinc-50 rounded-full flex items-center justify-center mx-auto mb-3">
                        <Bell size={20} className="text-zinc-300" />
                      </div>
                      <p className="text-sm font-medium text-zinc-400">No new leads today</p>
                      <p className="text-xs text-zinc-300 mt-1">New leads will appear here in real-time</p>
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
                    className="flex items-center justify-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-700 hover:bg-zinc-50 py-3 border-t border-zinc-100 transition-colors"
                  >
                    View all leads
                    <span className="text-zinc-300">&rarr;</span>
                  </Link>
                )}
              </div>
            </div>

            {/* Separator */}
            <div className="hidden sm:block w-px h-6 bg-zinc-200/80 mx-1" />

            {/* User Menu */}
            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className={`flex items-center gap-2 pl-2 pr-2 py-1.5 rounded-lg transition-all duration-200 ${
                  userMenuOpen ? 'bg-zinc-100' : 'hover:bg-zinc-50'
                }`}
              >
                <div className="w-7 h-7 bg-gradient-to-br from-zinc-700 to-zinc-900 rounded-full flex items-center justify-center text-[11px] font-semibold text-white ring-2 ring-white">
                  {initials}
                </div>
                <div className="hidden sm:block text-left mr-0.5">
                  <p className="text-[13px] font-medium text-zinc-700 leading-tight">{user?.name?.split(' ')[0]}</p>
                </div>
                <ChevronDown size={14} className={`text-zinc-400 transition-transform duration-200 ${userMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* User dropdown with animation */}
              <div className={`absolute right-0 top-[calc(100%+8px)] w-[calc(100vw-2rem)] sm:w-64 max-w-[264px] bg-white rounded-xl shadow-xl shadow-zinc-200/50 border border-zinc-200/80 z-50 overflow-hidden transition-all duration-200 origin-top-right ${
                userMenuOpen ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 -translate-y-2 pointer-events-none'
              }`}>
                <div className="px-4 py-3.5 border-b border-zinc-100">
                  <p className="text-sm font-semibold text-zinc-900">{user?.name}</p>
                  <p className="text-xs text-zinc-400 mt-0.5 capitalize">{user?.role?.replace('_', ' ')}</p>
                  {firm?.name && (
                    <p className="text-[11px] text-zinc-300 mt-1 truncate">{firm.name}</p>
                  )}
                </div>
                <div className="py-1">
                  <Link
                    to="/settings"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center justify-between px-4 py-2.5 text-sm text-zinc-600 hover:bg-zinc-50 transition-colors duration-150"
                  >
                    <span className="flex items-center gap-2.5">
                      <Settings size={15} className="text-zinc-400" />
                      Settings
                    </span>
                    <kbd className="text-[10px] text-zinc-300 font-mono">,</kbd>
                  </Link>
                  <Link
                    to={isSuperAdmin ? '/admin' : '/'}
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center justify-between px-4 py-2.5 text-sm text-zinc-600 hover:bg-zinc-50 transition-colors duration-150"
                  >
                    <span className="flex items-center gap-2.5">
                      <Keyboard size={15} className="text-zinc-400" />
                      Keyboard shortcuts
                    </span>
                    <kbd className="text-[10px] text-zinc-300 font-mono">?</kbd>
                  </Link>
                </div>
                <div className="border-t border-zinc-100 py-1">
                  <button
                    onClick={() => { setUserMenuOpen(false); logout(); }}
                    className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors duration-150"
                  >
                    <LogOut size={15} />
                    Sign out
                  </button>
                </div>
              </div>
            </div>

            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden p-2 rounded-lg hover:bg-zinc-50 transition-colors"
            >
              {mobileOpen ? <X size={20} className="text-zinc-600" /> : <Menu size={20} className="text-zinc-600" />}
            </button>
          </div>
        </div>

        {/* Mobile Nav with slide animation */}
        <div className={`md:hidden border-t border-zinc-100 overflow-hidden transition-all duration-300 ${
          mobileOpen ? 'max-h-[500px] opacity-100 py-3' : 'max-h-0 opacity-0 py-0'
        }`}>
          <div className="space-y-1">
            {/* Mobile search */}
            <form onSubmit={handleSearch} className="relative mb-3 sm:hidden">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-300" />
              <input
                type="text"
                placeholder="Search leads..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 text-sm bg-zinc-50 border border-zinc-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-200 placeholder:text-zinc-300"
              />
            </form>

            {navItems.map((item) => {
              const active = isActive(item.path);
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                    active
                      ? 'text-zinc-900 bg-zinc-100'
                      : 'text-zinc-500 hover:bg-zinc-50 hover:text-zinc-700'
                  }`}
                >
                  <Icon size={16} className={active ? 'text-zinc-700' : 'text-zinc-400'} />
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
        </div>
      </div>
    </nav>
  );
}
