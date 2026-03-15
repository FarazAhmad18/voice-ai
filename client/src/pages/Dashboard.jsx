import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { fetchLeads, fetchAppointments } from '../services/api';
import StatsCard from '../components/StatsCard';
import ScoreBadge from '../components/ScoreBadge';
import ActivityFeed from '../components/ActivityFeed';
import { Users, PhoneIncoming, Flame, CalendarCheck, ArrowRight, Clock, ChevronRight, TrendingUp, BarChart3 } from 'lucide-react';

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function getConversionRate(leads) {
  if (leads.length === 0) return 0;
  const converted = leads.filter((l) => l.status === 'booked' || l.status === 'converted').length;
  return Math.round((converted / leads.length) * 100);
}

function buildActivityFeed(leads, appointments) {
  const items = [];
  leads.slice(0, 5).forEach((lead) => {
    items.push({
      type: lead.score_label === 'hot' ? 'alert' : 'lead',
      text: `${lead.caller_name} — ${lead.case_type}${lead.score_label === 'hot' ? ' (Hot lead!)' : ''}`,
      time: formatRelativeTime(lead.created_at),
    });
  });
  appointments.slice(0, 3).forEach((apt) => {
    items.push({
      type: 'appointment',
      text: `Appointment booked: ${apt.caller_name} — ${apt.appointment_date} at ${apt.appointment_time}`,
      time: formatRelativeTime(apt.created_at),
    });
  });
  return items.sort((a, b) => 0).slice(0, 8);
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
  return `${diffDay}d ago`;
}

export default function Dashboard() {
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-6 h-6 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const today = new Date().toISOString().split('T')[0];
  const todayLeads = leads.filter((l) => l.created_at?.startsWith(today));
  const hotLeads = leads.filter((l) => l.score_label === 'hot');
  const conversionRate = getConversionRate(leads);
  const upcomingApts = appointments.filter((a) => a.status === 'confirmed');
  const activityItems = buildActivityFeed(leads, appointments);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Greeting */}
      <div>
        <h2 className="text-xl font-semibold text-slate-900 tracking-tight">
          {getGreeting()}, Mitchell Law
        </h2>
        <p className="text-sm text-slate-400 mt-1">
          {todayLeads.length > 0
            ? `${todayLeads.length} new inquiry${todayLeads.length > 1 ? 's' : ''} today. Sarah is handling calls.`
            : 'No new calls yet today. Sarah is standing by.'}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title="Total Leads" value={leads.length} icon={Users} color="blue" />
        <StatsCard title="Today's Calls" value={todayLeads.length} icon={PhoneIncoming} color="green" />
        <StatsCard title="Hot Leads" value={hotLeads.length} icon={Flame} color="red" />
        <StatsCard title="Conversion" value={`${conversionRate}%`} icon={TrendingUp} color="purple" />
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Leads — 2 cols */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100">
          <div className="px-5 py-4 border-b border-slate-50 flex justify-between items-center">
            <h3 className="text-sm font-semibold text-slate-800">Recent Leads</h3>
            <Link to="/leads" className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700">
              View all <ArrowRight size={12} />
            </Link>
          </div>
          <div className="divide-y divide-slate-50">
            {leads.length === 0 ? (
              <div className="py-12 text-center">
                <PhoneIncoming size={24} className="text-slate-300 mx-auto mb-3" />
                <p className="text-sm text-slate-400">No leads yet</p>
                <p className="text-xs text-slate-300 mt-1">Leads appear here when Sarah takes calls</p>
              </div>
            ) : (
              leads.slice(0, 6).map((lead) => (
                <Link key={lead.id} to={`/leads/${lead.id}`} className="flex items-center justify-between px-5 py-3 hover:bg-slate-50/50 transition-colors group">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-slate-100 rounded-full flex items-center justify-center text-xs font-semibold text-slate-600">
                      {lead.caller_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-800">{lead.caller_name}</p>
                      <p className="text-xs text-slate-400 capitalize">{lead.case_type} · {lead.caller_phone}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <ScoreBadge score={lead.score} label={lead.score_label} />
                    <ChevronRight size={14} className="text-slate-300 group-hover:text-slate-500 transition-colors" />
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Activity Feed — 1 col */}
        <div className="bg-white rounded-2xl border border-slate-100">
          <div className="px-5 py-4 border-b border-slate-50">
            <h3 className="text-sm font-semibold text-slate-800">Activity</h3>
          </div>
          <ActivityFeed activities={activityItems} />
        </div>
      </div>

      {/* Upcoming Appointments */}
      <div className="bg-white rounded-2xl border border-slate-100">
        <div className="px-5 py-4 border-b border-slate-50 flex justify-between items-center">
          <h3 className="text-sm font-semibold text-slate-800">Upcoming Consultations</h3>
          <Link to="/appointments" className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700">
            View all <ArrowRight size={12} />
          </Link>
        </div>
        {upcomingApts.length === 0 ? (
          <div className="py-10 text-center">
            <CalendarCheck size={24} className="text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-400">No upcoming consultations</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {upcomingApts.slice(0, 5).map((apt) => (
              <div key={apt.id} className="flex items-center justify-between px-5 py-3.5">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-violet-50 rounded-full flex items-center justify-center text-xs font-semibold text-violet-600">
                    {apt.caller_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-800">{apt.caller_name}</p>
                    <p className="text-xs text-slate-400 capitalize">{apt.case_type}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-slate-800">{apt.appointment_date}</p>
                  <p className="text-xs text-slate-400 flex items-center gap-1 justify-end">
                    <Clock size={11} />
                    {apt.appointment_time}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
