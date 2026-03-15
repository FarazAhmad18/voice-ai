import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useFirm } from '../context/FirmContext';
import { fetchLeads, fetchAppointments } from '../services/api';
import { supabase } from '../services/supabase';
import ScoreBadge from '../components/ScoreBadge';
import StatusBadge from '../components/StatusBadge';
import {
  Users, UserCheck, Flame, CalendarCheck, ArrowRight, Clock,
  ChevronRight, AlertCircle, Phone, PhoneIncoming, PhoneMissed,
  TrendingUp, ArrowUpRight, BarChart3, Zap,
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

export default function Dashboard() {
  const { user, firm } = useAuth();
  const { agentName } = useFirm();
  const [leads, setLeads] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [leadsData, aptsData] = await Promise.all([
          fetchLeads(),
          fetchAppointments(),
        ]);
        setLeads(leadsData);
        setAppointments(aptsData);
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Supabase Realtime: listen for new leads and appointments
  useEffect(() => {
    const channel = supabase
      .channel('dashboard-changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'leads' },
        (payload) => {
          setLeads((prev) => [payload.new, ...prev]);
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'appointments' },
        (payload) => {
          setAppointments((prev) => [payload.new, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-8 h-8 border-[3px] border-slate-200 border-t-slate-900 rounded-full animate-spin" />
      </div>
    );
  }

  const today = new Date().toISOString().split('T')[0];
  const newLeads = leads.filter(l => l.status === 'new');
  const followUps = leads.filter(l => l.status === 'contacted');
  const hotLeads = leads.filter(l => l.score_label === 'hot');
  const todayLeads = leads.filter(l => l.created_at?.startsWith(today));
  const conversionRate = getConversionRate(leads);

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

  // Score distribution for mini chart
  const hotCount = leads.filter(l => l.score_label === 'hot').length;
  const warmCount = leads.filter(l => l.score_label === 'warm').length;
  const coldCount = leads.filter(l => l.score_label === 'cold').length;
  const totalScored = hotCount + warmCount + coldCount || 1;

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl p-6 sm:p-8">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMSIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjAzKSIvPjwvc3ZnPg==')] opacity-50" />
        <div className="relative z-10">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-white tracking-tight">
                {getGreeting()}{firstName ? `, ${firstName}` : ''}
              </h2>
              <p className="text-sm text-slate-400 mt-1.5 max-w-md">
                {needsAttention.length > 0
                  ? `You have ${needsAttention.length} lead${needsAttention.length > 1 ? 's' : ''} that need${needsAttention.length === 1 ? 's' : ''} attention today.`
                  : `All caught up. ${agentName} is standing by for new calls.`}
              </p>
            </div>
            {todayLeads.length > 0 && (
              <div className="flex items-center gap-3 bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3">
                <div className="w-10 h-10 bg-emerald-500/20 rounded-lg flex items-center justify-center">
                  <PhoneIncoming size={18} className="text-emerald-400" />
                </div>
                <div>
                  <p className="text-lg font-bold text-white">{todayLeads.length}</p>
                  <p className="text-[11px] text-slate-400 uppercase tracking-wider">Today's Calls</p>
                </div>
              </div>
            )}
          </div>

          {/* Quick stats row inside hero */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
            <QuickStat label="Total Leads" value={leads.length} icon={Users} />
            <QuickStat label="Follow Ups" value={followUps.length} icon={UserCheck} accent />
            <QuickStat label="Hot Leads" value={hotLeads.length} icon={Flame} />
            <QuickStat label="Conversion" value={`${conversionRate}%`} icon={TrendingUp} />
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Needs Attention */}
        <div className="lg:col-span-8 space-y-6">
          {/* Needs Attention */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm shadow-slate-100/50">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center">
                  <Zap size={15} className="text-amber-500" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Needs Attention</h3>
                  <p className="text-[11px] text-slate-400">Leads requiring immediate action</p>
                </div>
              </div>
              <Link to="/leads" className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-slate-600 transition-colors">
                View all <ArrowRight size={12} />
              </Link>
            </div>
            {needsAttention.length === 0 ? (
              <div className="py-16 text-center">
                <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <CalendarCheck size={22} className="text-emerald-500" />
                </div>
                <p className="text-sm font-medium text-slate-700">All caught up</p>
                <p className="text-xs text-slate-400 mt-1">No leads need immediate attention right now</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {needsAttention.slice(0, 6).map((lead, idx) => {
                  const initials = lead.caller_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
                  const reasonColors = {
                    'Hot lead': 'bg-red-500',
                    'Overdue follow-up': 'bg-amber-500',
                    'Needs follow-up': 'bg-amber-400',
                    'New lead': 'bg-blue-500',
                  };
                  return (
                    <Link key={lead.id} to={`/leads/${lead.id}`} className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50/70 transition-all group">
                      <div className="relative">
                        <div className="w-11 h-11 bg-slate-100 rounded-full flex items-center justify-center text-xs font-semibold text-slate-600 group-hover:bg-slate-200 transition-colors">
                          {initials}
                        </div>
                        <div className={`absolute -top-0.5 -right-0.5 w-3 h-3 ${reasonColors[lead.reason] || 'bg-slate-400'} rounded-full border-2 border-white`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-slate-900 group-hover:text-blue-600 transition-colors truncate">{lead.caller_name}</p>
                          <ScoreBadge score={lead.score} label={lead.score_label} />
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          <span className="capitalize">{lead.case_type}</span>
                          <span className="mx-1.5 text-slate-200">|</span>
                          {lead.caller_phone}
                          <span className="mx-1.5 text-slate-200">|</span>
                          {formatRelativeTime(lead.created_at)}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className={`text-[11px] font-medium px-2.5 py-1 rounded-full ${
                          lead.reason === 'Hot lead' ? 'bg-red-50 text-red-600' :
                          lead.reason.includes('overdue') || lead.reason.includes('Overdue') ? 'bg-amber-50 text-amber-600' :
                          lead.reason === 'Needs follow-up' ? 'bg-orange-50 text-orange-600' :
                          'bg-blue-50 text-blue-600'
                        }`}>
                          {lead.reason}
                        </span>
                        <ChevronRight size={16} className="text-slate-200 group-hover:text-slate-400 transition-colors" />
                      </div>
                    </Link>
                  );
                })}
                {needsAttention.length > 6 && (
                  <Link to="/leads" className="flex items-center justify-center gap-1.5 px-6 py-3 text-xs font-medium text-blue-600 hover:bg-blue-50/50 transition-colors">
                    View {needsAttention.length - 6} more <ArrowUpRight size={12} />
                  </Link>
                )}
              </div>
            )}
          </div>

          {/* Today's Appointments */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm shadow-slate-100/50">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-violet-50 rounded-lg flex items-center justify-center">
                  <CalendarCheck size={15} className="text-violet-500" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Today's Schedule</h3>
                  <p className="text-[11px] text-slate-400">{todayApts.length} appointment{todayApts.length !== 1 ? 's' : ''} today</p>
                </div>
              </div>
              <Link to="/appointments" className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-slate-600 transition-colors">
                All appointments <ArrowRight size={12} />
              </Link>
            </div>
            {todayApts.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-sm text-slate-400">No appointments scheduled for today</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {todayApts.map((apt) => {
                  const initials = apt.caller_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
                  return (
                    <div key={apt.id} className="flex items-center gap-4 px-6 py-4">
                      <div className="flex items-center gap-2 w-20 flex-shrink-0">
                        <Clock size={13} className="text-violet-400" />
                        <span className="text-sm font-semibold text-slate-900">{apt.appointment_time}</span>
                      </div>
                      <div className="w-px h-8 bg-slate-100" />
                      <div className="w-9 h-9 bg-violet-50 rounded-full flex items-center justify-center text-xs font-semibold text-violet-600 flex-shrink-0">
                        {initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800">{apt.caller_name}</p>
                        <p className="text-xs text-slate-400 capitalize">{apt.case_type}</p>
                      </div>
                      <StatusBadge status={apt.status} />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="lg:col-span-4 space-y-6">
          {/* Lead Score Distribution */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm shadow-slate-100/50 p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center">
                <BarChart3 size={15} className="text-slate-500" />
              </div>
              <h3 className="text-sm font-semibold text-slate-900">Lead Quality</h3>
            </div>

            {/* Visual bar */}
            <div className="flex h-3 rounded-full overflow-hidden bg-slate-100 mb-4">
              {hotCount > 0 && <div className="bg-red-400 transition-all" style={{ width: `${(hotCount / totalScored) * 100}%` }} />}
              {warmCount > 0 && <div className="bg-amber-400 transition-all" style={{ width: `${(warmCount / totalScored) * 100}%` }} />}
              {coldCount > 0 && <div className="bg-slate-300 transition-all" style={{ width: `${(coldCount / totalScored) * 100}%` }} />}
            </div>

            <div className="space-y-3">
              <ScoreRow label="Hot" count={hotCount} total={leads.length} color="bg-red-500" textColor="text-red-600" />
              <ScoreRow label="Warm" count={warmCount} total={leads.length} color="bg-amber-500" textColor="text-amber-600" />
              <ScoreRow label="Cold" count={coldCount} total={leads.length} color="bg-slate-400" textColor="text-slate-500" />
            </div>
          </div>

          {/* Recent Activity Timeline */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm shadow-slate-100/50 p-6">
            <h3 className="text-sm font-semibold text-slate-900 mb-5">Recent Activity</h3>
            <div className="space-y-0">
              {leads.length === 0 && appointments.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-4">No activity yet</p>
              ) : (
                <div className="relative">
                  {/* Timeline line */}
                  <div className="absolute left-[15px] top-2 bottom-2 w-px bg-slate-100" />

                  {[...leads.slice(0, 5).map(l => ({
                    id: `lead-${l.id}`,
                    type: l.score_label === 'hot' ? 'hot' : 'lead',
                    icon: l.score_label === 'hot' ? Flame : PhoneIncoming,
                    title: l.caller_name,
                    sub: l.case_type,
                    time: formatRelativeTime(l.created_at),
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
                    link: a.lead_id ? `/leads/${a.lead_id}` : null,
                    _date: a.created_at,
                  }))]
                  .sort((a, b) => new Date(b._date) - new Date(a._date))
                  .slice(0, 6)
                  .map((item) => {
                    const Icon = item.icon;
                    const iconStyles = {
                      hot: 'bg-red-50 text-red-500',
                      lead: 'bg-blue-50 text-blue-500',
                      appointment: 'bg-violet-50 text-violet-500',
                    };
                    const Wrapper = item.link ? Link : 'div';
                    return (
                      <Wrapper key={item.id} {...(item.link ? { to: item.link } : {})} className="flex items-start gap-3 py-3 relative z-10 group">
                        <div className={`w-[30px] h-[30px] rounded-lg flex items-center justify-center flex-shrink-0 ${iconStyles[item.type]} group-hover:scale-110 transition-transform`}>
                          <Icon size={13} />
                        </div>
                        <div className="flex-1 min-w-0 pt-0.5">
                          <p className="text-sm text-slate-700 font-medium truncate group-hover:text-blue-600 transition-colors">{item.title}</p>
                          <p className="text-[11px] text-slate-400 capitalize">{item.sub}</p>
                        </div>
                        <span className="text-[10px] text-slate-300 pt-1 flex-shrink-0">{item.time}</span>
                      </Wrapper>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Pipeline Summary */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm shadow-slate-100/50 p-6">
            <h3 className="text-sm font-semibold text-slate-900 mb-4">Pipeline Overview</h3>
            <div className="space-y-3">
              {[
                { label: 'New', count: newLeads.length, color: 'bg-emerald-500', link: '/leads?status=new' },
                { label: 'Following Up', count: followUps.length, color: 'bg-amber-500', link: '/follow-ups' },
                { label: 'Booked', count: leads.filter(l => l.status === 'booked').length, color: 'bg-violet-500', link: '/leads?status=booked' },
                { label: 'Converted', count: leads.filter(l => l.status === 'converted').length, color: 'bg-teal-500', link: '/leads?status=converted' },
                { label: 'Closed', count: leads.filter(l => l.status === 'closed').length, color: 'bg-slate-400', link: '/leads?status=closed' },
              ].map(stage => (
                <Link key={stage.label} to={stage.link} className="flex items-center gap-3 group">
                  <div className={`w-2 h-2 rounded-full ${stage.color} flex-shrink-0`} />
                  <span className="text-sm text-slate-600 group-hover:text-slate-900 transition-colors flex-1">{stage.label}</span>
                  <span className="text-sm font-semibold text-slate-900">{stage.count}</span>
                  <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full ${stage.color} rounded-full transition-all`} style={{ width: `${leads.length ? (stage.count / leads.length) * 100 : 0}%` }} />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function QuickStat({ label, value, icon: Icon, accent }) {
  return (
    <div className={`rounded-xl px-4 py-3 ${accent ? 'bg-white/15 ring-1 ring-white/20' : 'bg-white/10'}`}>
      <div className="flex items-center gap-2 mb-1">
        <Icon size={13} className="text-slate-400" />
        <span className="text-[11px] text-slate-400 uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-xl font-bold text-white">{value}</p>
    </div>
  );
}

function ScoreRow({ label, count, total, color, textColor }) {
  const pct = total ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <div className={`w-2.5 h-2.5 rounded-full ${color} flex-shrink-0`} />
      <span className="text-sm text-slate-600 flex-1">{label}</span>
      <span className={`text-sm font-semibold ${textColor}`}>{count}</span>
      <span className="text-xs text-slate-300 w-10 text-right">{pct}%</span>
    </div>
  );
}
