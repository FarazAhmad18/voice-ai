import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useFirm } from '../context/FirmContext';
import { fetchLeads, fetchAppointments } from '../services/api';
import { supabase } from '../services/supabase';
import ScoreBadge from '../components/ScoreBadge';
import StatusBadge from '../components/StatusBadge';
import AppointmentCalendar from '../components/AppointmentCalendar';
import {
  Users, UserCheck, Flame, CalendarCheck, ArrowRight, Clock,
  ChevronRight, AlertCircle, Phone, PhoneIncoming, PhoneMissed,
  TrendingUp, ArrowUpRight, BarChart3, Zap, Activity,
} from 'lucide-react';

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function formatRelativeTime(dateStr) {
  if (!dateStr) return '';
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now - date;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay === 1) return 'Yesterday';
  return `${diffDay}d ago`;
}

function getConversionRate(leads) {
  if (leads.length === 0) return 0;
  const converted = leads.filter(l => l.status === 'booked' || l.status === 'converted').length;
  return Math.round((converted / leads.length) * 100);
}

/* ─── Skeleton Loading ─── */
function SkeletonBlock({ className }) {
  return <div className={`skeleton-shimmer rounded-lg ${className}`} />;
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      {/* Hero skeleton */}
      <SkeletonBlock className="h-52 rounded-lg" />
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-white dark:bg-zinc-900 rounded-lg border border-slate-100 dark:border-zinc-800 p-6 space-y-4">
            <SkeletonBlock className="h-5 w-40" />
            <SkeletonBlock className="h-16 w-full" />
            <SkeletonBlock className="h-16 w-full" />
            <SkeletonBlock className="h-16 w-full" />
          </div>
          <div className="bg-white dark:bg-zinc-900 rounded-lg border border-slate-100 dark:border-zinc-800 p-6 space-y-4">
            <SkeletonBlock className="h-5 w-36" />
            <SkeletonBlock className="h-14 w-full" />
            <SkeletonBlock className="h-14 w-full" />
          </div>
        </div>
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white dark:bg-zinc-900 rounded-lg border border-slate-100 dark:border-zinc-800 p-6 space-y-3">
            <SkeletonBlock className="h-5 w-28" />
            <SkeletonBlock className="h-4 w-full" />
            <SkeletonBlock className="h-20 w-full" />
          </div>
          <div className="bg-white dark:bg-zinc-900 rounded-lg border border-slate-100 dark:border-zinc-800 p-6 space-y-3">
            <SkeletonBlock className="h-5 w-32" />
            <SkeletonBlock className="h-12 w-full" />
            <SkeletonBlock className="h-12 w-full" />
            <SkeletonBlock className="h-12 w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Dashboard ─── */
export default function Dashboard() {
  const { user, firm } = useAuth();
  const { agentName, brandColor } = useFirm();
  const [leads, setLeads] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function loadData() {
    setError(null);
    try {
      const [leadsData, aptsData] = await Promise.all([
        fetchLeads(),
        fetchAppointments(),
      ]);
      setLeads(leadsData);
      setAppointments(aptsData);
    } catch (err) {
      setError(err.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  // Supabase Realtime: listen for new leads and appointments
  useEffect(() => {
    const firmId = firm?.id;
    const leadsFilter = firmId ? `firm_id=eq.${firmId}` : undefined;
    const channel = supabase
      .channel('dashboard-changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'leads', filter: leadsFilter },
        (payload) => {
          setLeads((prev) => {
            // Deduplicate — skip if already present
            if (prev.some(l => l.id === payload.new.id)) return prev;
            return [payload.new, ...prev];
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'appointments', filter: leadsFilter },
        (payload) => {
          setAppointments((prev) => {
            if (prev.some(a => a.id === payload.new.id)) return prev;
            return [payload.new, ...prev];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (loading) {
    return <DashboardSkeleton />;
  }

  const today = new Date().toISOString().split('T')[0];
  const newLeads = leads.filter(l => l.status === 'new');
  const followUps = leads.filter(l => l.status === 'contacted');
  const hotLeads = leads.filter(l => l.score_label === 'hot');
  const todayLeads = leads.filter(l => l.created_at?.startsWith(today));
  const conversionRate = getConversionRate(leads);

  // Trend calculations — this week vs last week
  const now = new Date();
  const startOfWeek = new Date(now); startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  const startOfLastWeek = new Date(startOfWeek); startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);
  const thisWeekLeads = leads.filter(l => new Date(l.created_at) >= startOfWeek);
  const lastWeekLeads = leads.filter(l => { const d = new Date(l.created_at); return d >= startOfLastWeek && d < startOfWeek; });
  const leadsTrend = lastWeekLeads.length > 0
    ? Math.round(((thisWeekLeads.length - lastWeekLeads.length) / lastWeekLeads.length) * 100)
    : thisWeekLeads.length > 0 ? 100 : 0;
  const leadsTrendText = leadsTrend > 0 ? `+${leadsTrend}% vs last week` : leadsTrend < 0 ? `${leadsTrend}% vs last week` : 'Same as last week';

  const overdueFollowUps = followUps.filter(l => l.follow_up_date && l.follow_up_date < today).length;
  const followUpTrend = overdueFollowUps > 0 ? `${overdueFollowUps} overdue` : 'All on track';

  const lastWeekConversion = getConversionRate(lastWeekLeads);
  const convDiff = conversionRate - lastWeekConversion;
  const convTrend = convDiff > 0 ? `+${convDiff}% vs last week` : convDiff < 0 ? `${convDiff}% vs last week` : 'Steady';

  // Needs attention: hot new + overdue follow-ups + today's new
  const needsAttention = [];
  newLeads.filter(l => l.score_label === 'hot').forEach(l => {
    needsAttention.push({ ...l, reason: 'Hot lead', priority: 1 });
  });
  followUps.filter(l => {
    if (!l.follow_up_date) return true;
    return new Date(l.follow_up_date) <= new Date();
  }).forEach(l => {
    if (!needsAttention.find(n => n.id === l.id)) {
      needsAttention.push({ ...l, reason: l.follow_up_date ? 'Overdue follow-up' : 'Needs follow-up', priority: 2 });
    }
  });
  newLeads.filter(l => l.score_label !== 'hot').forEach(l => {
    if (!needsAttention.find(n => n.id === l.id)) {
      needsAttention.push({ ...l, reason: 'New lead', priority: 3 });
    }
  });
  needsAttention.sort((a, b) => a.priority - b.priority);

  const todayApts = appointments.filter(a => a.appointment_date === today && a.status === 'confirmed');
  const firstName = user?.name?.split(' ')[0] || '';

  // Score distribution
  const hotCount = leads.filter(l => l.score_label === 'hot').length;
  const warmCount = leads.filter(l => l.score_label === 'warm').length;
  const coldCount = leads.filter(l => l.score_label === 'cold').length;
  const totalScored = hotCount + warmCount + coldCount || 1;

  // Pipeline stages
  const pipelineStages = [
    { label: 'New', count: newLeads.length, color: '#10b981', link: '/leads?status=new' },
    { label: 'Following Up', count: followUps.length, color: '#f59e0b', link: '/follow-ups' },
    { label: 'Booked', count: leads.filter(l => l.status === 'booked').length, color: '#8b5cf6', link: '/leads?status=booked' },
    { label: 'Converted', count: leads.filter(l => l.status === 'converted').length, color: '#14b8a6', link: '/leads?status=converted' },
    { label: 'Closed', count: leads.filter(l => l.status === 'closed').length, color: '#94a3b8', link: '/leads?status=closed' },
  ];
  const pipelineTotal = pipelineStages.reduce((s, p) => s + p.count, 0) || 1;

  const bc = brandColor || '#6d28d9';

  return (
    <div className="space-y-8">
      {error && (
        <div className="bg-red-50/80 dark:bg-red-900/30 backdrop-blur-sm border border-red-100 dark:border-red-800 rounded-lg px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-red-100 dark:bg-red-900/40 rounded-lg flex items-center justify-center flex-shrink-0">
              <AlertCircle size={15} className="text-red-500" />
            </div>
            <p className="text-sm text-red-700 dark:text-red-400 font-medium">{error}</p>
          </div>
          <button onClick={loadData} className="text-xs font-semibold text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-400 bg-red-100 dark:bg-red-900/40 hover:bg-red-200 px-3 py-1.5 rounded-lg transition-colors">
            Retry
          </button>
        </div>
      )}

      {/* ══════════════════════════════════════════════
          HERO SECTION
          ══════════════════════════════════════════════ */}
      <div
        className="relative overflow-hidden rounded-lg p-7 sm:p-9"
        style={{ backgroundColor: '#0f172a' }}
      >

        <div className="relative z-10">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-5">
            <div>
              <h2 className="text-3xl sm:text-[2rem] font-bold text-white tracking-tight leading-tight">
                {getGreeting()}{firstName ? `, ${firstName}` : ''}
              </h2>
              <p className="text-[15px] text-white/50 mt-2 max-w-lg font-light leading-relaxed">
                {needsAttention.length > 0
                  ? `You have ${needsAttention.length} lead${needsAttention.length > 1 ? 's' : ''} that need${needsAttention.length === 1 ? 's' : ''} attention today.`
                  : `All caught up. ${agentName} is standing by for new calls.`}
              </p>
            </div>

            {/* Agent status + today's calls */}
            <div className="flex items-center gap-4">
              {/* Agent active indicator */}
              <div className="flex items-center gap-2.5 bg-white/10 border border-white/[0.08] rounded-lg px-4 py-2.5">
                <div className="w-2.5 h-2.5 bg-emerald-400 rounded-full" />
                <span className="text-xs font-medium text-white/70">{agentName} Active</span>
              </div>

              {todayLeads.length > 0 && (
                <div className="flex items-center gap-3.5 bg-white/10 border border-white/[0.08] rounded-lg px-5 py-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${bc}33` }}>
                    <PhoneIncoming size={18} className="text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-xl font-bold text-white">{todayLeads.length}</p>
                    <p className="text-[10px] text-white/40 uppercase tracking-widest font-medium">Today's Calls</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Quick stats — glass morphism cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-7">
            <QuickStat label="Total Leads" value={leads.length} icon={Users} trend={leadsTrendText} brandColor={bc} />
            <QuickStat label="Follow Ups" value={followUps.length} icon={UserCheck} trend={followUpTrend} brandColor={bc} accent />
            <QuickStat label="Hot Leads" value={hotLeads.length} icon={Flame} trend={`${thisWeekLeads.filter(l => l.score_label === 'hot').length} this week`} brandColor={bc} />
            <QuickStat label="Conversion" value={`${conversionRate}%`} icon={TrendingUp} trend={convTrend} brandColor={bc} />
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════
          MAIN CONTENT GRID
          ══════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-8 space-y-6">

          {/* ── Needs Attention ── */}
          <div className="bg-white dark:bg-zinc-900 rounded-lg border border-slate-100/80 dark:border-zinc-800 shadow-sm">
            <div className="px-6 py-5 border-b border-slate-100/80 dark:border-zinc-800 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-amber-50 dark:bg-amber-900/30 rounded-lg flex items-center justify-center">
                  <Zap size={16} className="text-amber-500" />
                </div>
                <div>
                  <h3 className="text-[15px] font-semibold text-slate-900 dark:text-zinc-100">Needs Attention</h3>
                  <p className="text-xs text-slate-400 dark:text-zinc-500 mt-0.5">Leads requiring immediate action</p>
                </div>
              </div>
              <Link to="/leads" className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-400 transition-colors group">
                View all <ArrowRight size={12} />
              </Link>
            </div>
            {needsAttention.length === 0 ? (
              <div className="py-20 text-center">
                <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-900/30 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <CalendarCheck size={24} className="text-emerald-500" />
                </div>
                <p className="text-sm font-semibold text-slate-700 dark:text-zinc-300">All caught up</p>
                <p className="text-xs text-slate-400 dark:text-zinc-500 mt-1.5 max-w-xs mx-auto">No leads need immediate attention right now. New leads will appear here automatically.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50 dark:divide-zinc-800/40">
                {needsAttention.slice(0, 6).map((lead, idx) => {
                  const initials = ((lead.caller_name || 'U').split(' ').map(n => n?.[0] || '').join('').slice(0, 2).toUpperCase()) || '?';
                  const borderColors = {
                    'Hot lead': 'border-l-red-500',
                    'Overdue follow-up': 'border-l-amber-500',
                    'Needs follow-up': 'border-l-orange-400',
                    'New lead': 'border-l-blue-500',
                  };
                  const reasonBgColors = {
                    'Hot lead': 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 ring-1 ring-red-100',
                    'Overdue follow-up': 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 ring-1 ring-amber-100',
                    'Needs follow-up': 'bg-orange-50 dark:bg-orange-900/30 text-orange-600 ring-1 ring-orange-100',
                    'New lead': 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 ring-1 ring-blue-100',
                  };
                  const avatarBg = {
                    'Hot lead': 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400',
                    'Overdue follow-up': 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
                    'Needs follow-up': 'bg-orange-50 dark:bg-orange-900/30 text-orange-600',
                    'New lead': 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
                  };
                  return (
                    <Link
                      key={lead.id}
                      to={`/leads/${lead.id}`}
                      className={`flex items-center gap-4 px-6 py-4 border-l-[3px] ${borderColors[lead.reason] || 'border-l-slate-300'} hover:bg-slate-50 dark:hover:bg-zinc-800/30 transition-all group`}
                    >
                      <div className="relative">
                        <div className={`w-11 h-11 rounded-full flex items-center justify-center text-xs font-bold ${avatarBg[lead.reason] || 'bg-slate-100 dark:bg-zinc-800/50 text-slate-600 dark:text-zinc-500'} group-hover:scale-105 transition-transform`}>
                          {initials}
                        </div>
                        {lead.reason === 'Hot lead' && (
                          <div className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-red-500 rounded-full border-2 border-white dark:border-zinc-900 flex items-center justify-center">
                            <Flame size={7} className="text-white" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2.5">
                          <p className="text-sm font-semibold text-slate-900 dark:text-zinc-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate">{lead.caller_name}</p>
                          <ScoreBadge score={lead.score} label={lead.score_label} />
                        </div>
                        <p className="text-xs text-slate-400 dark:text-zinc-500 mt-0.5">
                          <span className="capitalize">{lead.case_type}</span>
                          <span className="mx-1.5 text-slate-200 dark:text-zinc-700">&#183;</span>
                          {lead.caller_phone}
                          <span className="mx-1.5 text-slate-200 dark:text-zinc-700">&#183;</span>
                          {formatRelativeTime(lead.created_at)}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${reasonBgColors[lead.reason] || 'bg-slate-50 dark:bg-zinc-900 text-slate-600 dark:text-zinc-500'}`}>
                          {lead.reason}
                        </span>
                        <ChevronRight size={16} className="text-slate-200 dark:text-zinc-700 group-hover:text-slate-400 dark:group-hover:text-zinc-500" />
                      </div>
                    </Link>
                  );
                })}
                {needsAttention.length > 6 && (
                  <Link to="/leads" className="flex items-center justify-center gap-1.5 px-6 py-3.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-900/20 transition-colors">
                    View {needsAttention.length - 6} more <ArrowUpRight size={12} />
                  </Link>
                )}
              </div>
            )}
          </div>

          {/* ── Appointment Calendar ── */}
          <AppointmentCalendar appointments={appointments} />

          {/* ── Today's Schedule ── */}
          {todayApts.length > 0 && (
            <div className="bg-white dark:bg-zinc-900 rounded-lg border border-slate-100/80 dark:border-zinc-800 shadow-sm">
              <div className="px-6 py-5 border-b border-slate-100/80 dark:border-zinc-800 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-violet-50 dark:bg-violet-900/30 rounded-lg flex items-center justify-center">
                    <CalendarCheck size={16} className="text-violet-500" />
                  </div>
                  <div>
                    <h3 className="text-[15px] font-semibold text-slate-900 dark:text-zinc-100">Today's Schedule</h3>
                    <p className="text-xs text-slate-400 dark:text-zinc-500 mt-0.5">{todayApts.length} appointment{todayApts.length !== 1 ? 's' : ''} today</p>
                  </div>
                </div>
                <Link to="/appointments" className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-400 transition-colors group">
                  All appointments <ArrowRight size={12} />
                </Link>
              </div>
              <div className="p-4 space-y-2">
                {todayApts.map((apt, idx) => {
                  const initials = ((apt.caller_name || 'U').split(' ').map(n => n?.[0] || '').join('').slice(0, 2).toUpperCase()) || '?';
                  const timeColors = ['border-l-violet-400', 'border-l-blue-400', 'border-l-emerald-400', 'border-l-amber-400', 'border-l-rose-400'];
                  const timeBgColors = ['bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400', 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400', 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400', 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400', 'bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400'];
                  return (
                    <div
                      key={apt.id}
                      className={`flex items-center gap-4 px-5 py-4 rounded-lg border-l-[3px] ${timeColors[idx % 5]} bg-slate-50/50 dark:bg-zinc-900/50 hover:bg-slate-50 dark:hover:bg-zinc-900 transition-all`}
                    >
                      <div className={`px-3 py-1.5 rounded-lg text-xs font-bold ${timeBgColors[idx % 5]} min-w-[72px] text-center`}>
                        {apt.appointment_time}
                      </div>
                      <div className="w-px h-8 bg-slate-200 dark:bg-zinc-700/60" />
                      <div className="w-9 h-9 bg-white dark:bg-zinc-900 rounded-full flex items-center justify-center text-xs font-bold text-violet-600 dark:text-violet-400 border border-slate-100 dark:border-zinc-800 flex-shrink-0 shadow-sm">
                        {initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800 dark:text-zinc-200">{apt.caller_name}</p>
                        <p className="text-xs text-slate-400 dark:text-zinc-500 capitalize mt-0.5">{apt.case_type}</p>
                      </div>
                      <StatusBadge status={apt.status} />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ══════════════════════════════════════════════
            RIGHT SIDEBAR
            ══════════════════════════════════════════════ */}
        <div className="lg:col-span-4 space-y-6">

          {/* ── Pipeline Overview (Horizontal stacked bar) ── */}
          <div className="bg-white dark:bg-zinc-900 rounded-lg border border-slate-100/80 dark:border-zinc-800 shadow-sm p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 bg-slate-50 dark:bg-zinc-900 rounded-lg flex items-center justify-center">
                <BarChart3 size={16} className="text-slate-600 dark:text-zinc-500" />
              </div>
              <div>
                <h3 className="text-[15px] font-semibold text-slate-900 dark:text-zinc-100">Pipeline</h3>
                <p className="text-xs text-slate-400 dark:text-zinc-500">{leads.length} total leads</p>
              </div>
            </div>

            {/* Stacked horizontal bar */}
            <div className="flex h-8 rounded-lg overflow-hidden bg-slate-100 dark:bg-zinc-800/50 mb-5 shadow-inner">
              {pipelineStages.map((stage) => {
                const pct = (stage.count / pipelineTotal) * 100;
                if (pct === 0) return null;
                return (
                  <Link
                    key={stage.label}
                    to={stage.link}
                    className="group flex items-center justify-center relative"
                    style={{ width: `${pct}%`, backgroundColor: stage.color }}
                  >
                    {pct > 10 && (
                      <span className="text-[10px] font-bold text-white/90">{stage.count}</span>
                    )}
                    <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] font-medium px-2.5 py-1.5 rounded-lg whitespace-nowrap shadow-lg z-20 opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity">
                      {stage.label}: {stage.count} ({Math.round(pct)}%)
                      <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[5px] border-r-[5px] border-t-[5px] border-transparent border-t-slate-900" />
                    </div>
                  </Link>
                );
              })}
            </div>

            {/* Legend */}
            <div className="space-y-2.5">
              {pipelineStages.map(stage => (
                <Link key={stage.label} to={stage.link} className="flex items-center gap-3 group py-0.5">
                  <div className="w-3 h-3 rounded-[4px] flex-shrink-0" style={{ backgroundColor: stage.color }} />
                  <span className="text-[13px] text-slate-600 dark:text-zinc-500 group-hover:text-slate-900 dark:hover:text-zinc-100 transition-colors flex-1">{stage.label}</span>
                  <span className="text-[13px] font-bold text-slate-900 dark:text-zinc-100 tabular-nums">{stage.count}</span>
                  <span className="text-[11px] text-slate-300 dark:text-zinc-600 w-10 text-right tabular-nums">{leads.length ? Math.round((stage.count / leads.length) * 100) : 0}%</span>
                </Link>
              ))}
            </div>
          </div>

          {/* ── Lead Quality ── */}
          <div className="bg-white dark:bg-zinc-900 rounded-lg border border-slate-100/80 dark:border-zinc-800 shadow-sm p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 bg-rose-50 dark:bg-rose-900/30 rounded-lg flex items-center justify-center">
                <Flame size={16} className="text-rose-500" />
              </div>
              <h3 className="text-[15px] font-semibold text-slate-900 dark:text-zinc-100">Lead Quality</h3>
            </div>

            {/* Segmented arc-style bar */}
            <div className="flex h-3 rounded-full overflow-hidden bg-slate-100 dark:bg-zinc-800/50 mb-5">
              {hotCount > 0 && (
                <div className="bg-red-500 transition-all duration-500" style={{ width: `${(hotCount / totalScored) * 100}%` }} />
              )}
              {warmCount > 0 && (
                <div className="bg-amber-500 transition-all duration-500" style={{ width: `${(warmCount / totalScored) * 100}%` }} />
              )}
              {coldCount > 0 && (
                <div className="bg-slate-400 transition-all duration-500" style={{ width: `${(coldCount / totalScored) * 100}%` }} />
              )}
            </div>

            <div className="space-y-3.5">
              <ScoreRow label="Hot" count={hotCount} total={leads.length} colorFrom="#ef4444" colorTo="#dc2626" textColor="text-red-600 dark:text-red-400" />
              <ScoreRow label="Warm" count={warmCount} total={leads.length} colorFrom="#f59e0b" colorTo="#d97706" textColor="text-amber-600 dark:text-amber-400" />
              <ScoreRow label="Cold" count={coldCount} total={leads.length} colorFrom="#94a3b8" colorTo="#64748b" textColor="text-slate-500 dark:text-zinc-500" />
            </div>
          </div>

          {/* ── Recent Activity ── */}
          <div className="bg-white dark:bg-zinc-900 rounded-lg border border-slate-100/80 dark:border-zinc-800 shadow-sm p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 bg-blue-50 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                <Activity size={16} className="text-blue-500" />
              </div>
              <h3 className="text-[15px] font-semibold text-slate-900 dark:text-zinc-100">Recent Activity</h3>
            </div>
            <div>
              {leads.length === 0 && appointments.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-3xl mb-2 opacity-30">&#9201;</div>
                  <p className="text-sm text-slate-400 dark:text-zinc-500">No activity yet</p>
                </div>
              ) : (
                <div className="relative">
                  {/* Connecting timeline line */}
                  <div className="absolute left-[17px] top-5 bottom-5 w-[1.5px] bg-slate-200 dark:bg-zinc-700" />

                  {[...leads.slice(0, 5).map(l => ({
                    id: `lead-${l.id}`,
                    type: l.score_label === 'hot' ? 'hot' : 'lead',
                    icon: l.score_label === 'hot' ? Flame : PhoneIncoming,
                    title: l.caller_name,
                    sub: l.case_type,
                    time: formatRelativeTime(l.created_at),
                    fullTime: l.created_at ? new Date(l.created_at).toLocaleString() : '',
                    link: `/leads/${l.id}`,
                    _date: l.created_at,
                  })),
                  ...appointments.slice(0, 3).map(a => ({
                    id: `apt-${a.id}`,
                    type: 'appointment',
                    icon: CalendarCheck,
                    title: a.caller_name,
                    sub: `${a.appointment_date} at ${a.appointment_time}`,
                    time: formatRelativeTime(a.created_at),
                    fullTime: a.created_at ? new Date(a.created_at).toLocaleString() : '',
                    link: a.lead_id ? `/leads/${a.lead_id}` : null,
                    _date: a.created_at,
                  }))]
                  .sort((a, b) => new Date(b._date) - new Date(a._date))
                  .slice(0, 6)
                  .map((item, idx) => {
                    const Icon = item.icon;
                    const iconStyles = {
                      hot: 'bg-red-50 dark:bg-red-900/30 text-red-500',
                      lead: 'bg-blue-50 dark:bg-blue-900/30 text-blue-500',
                      appointment: 'bg-violet-50 dark:bg-violet-900/30 text-violet-500',
                    };
                    const Wrapper = item.link ? Link : 'div';
                    return (
                      <Wrapper
                        key={item.id}
                        {...(item.link ? { to: item.link } : {})}
                        className="flex items-start gap-3.5 py-3.5 relative z-10 group"
                      >
                        <div className={`w-[34px] h-[34px] rounded-lg flex items-center justify-center flex-shrink-0 ${iconStyles[item.type]}`}>
                          <Icon size={14} />
                        </div>
                        <div className="flex-1 min-w-0 pt-0.5">
                          <p className="text-[13px] text-slate-800 dark:text-zinc-200 font-semibold truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{item.title}</p>
                          <p className="text-[11px] text-slate-400 dark:text-zinc-500 capitalize mt-0.5">{item.sub}</p>
                        </div>
                        <div className="flex flex-col items-end pt-0.5 flex-shrink-0">
                          <span className="text-[10px] font-medium text-slate-300 dark:text-zinc-600">{item.time}</span>
                          <span className="text-[9px] text-slate-200 dark:text-zinc-700 opacity-0 group-hover:opacity-100 transition-opacity mt-0.5 whitespace-nowrap">{item.fullTime}</span>
                        </div>
                      </Wrapper>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Quick Stat Card (glass morphism) ─── */
function QuickStat({ label, value, icon: Icon, accent, trend, brandColor }) {
  return (
    <div className={`relative overflow-hidden rounded-lg px-4 py-3.5 border transition-all duration-200 ${
      accent
        ? 'bg-white/[0.15] border-white/[0.15]'
        : 'bg-white/10 border-white/[0.06]'
    }`}>
      <div className="relative">
        <div className="flex items-center gap-2 mb-1.5">
          <Icon size={13} className="text-white/40" />
          <span className="text-[10px] text-white/40 uppercase tracking-widest font-medium">{label}</span>
        </div>
        <p className="text-2xl font-bold text-white">{value}</p>
        {trend && (
          <p className="text-[10px] text-white/30 mt-1 font-medium">{trend}</p>
        )}
      </div>
    </div>
  );
}

/* ─── Appointment Calendar ─── inserted into the grid */

/* ─── Score Row ─── */
function ScoreRow({ label, count, total, colorFrom, textColor }) {
  const pct = total ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="w-3 h-3 rounded-[4px] flex-shrink-0" style={{ backgroundColor: colorFrom }} />
      <span className="text-[13px] text-slate-600 dark:text-zinc-500 flex-1">{label}</span>
      <span className={`text-[13px] font-bold ${textColor} tabular-nums`}>{count}</span>
      <span className="text-[11px] text-slate-300 dark:text-zinc-600 w-10 text-right tabular-nums">{pct}%</span>
    </div>
  );
}
