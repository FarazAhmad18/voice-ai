import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { fetchLeads, fetchAppointments } from '../services/api';
import StatsCard from '../components/StatsCard';
import ScoreBadge from '../components/ScoreBadge';
import StatusBadge from '../components/StatusBadge';
import { Users, UserPlus, Flame, CalendarCheck, ArrowRight, Phone, Clock, ChevronRight, PhoneIncoming } from 'lucide-react';

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
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-sm text-slate-400">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const today = new Date().toISOString().split('T')[0];
  const todayLeads = leads.filter((l) => l.created_at?.startsWith(today));
  const hotLeads = leads.filter((l) => l.score_label === 'hot');
  const bookedCount = leads.filter((l) => l.status === 'booked').length;
  const upcomingApts = appointments.filter((a) => a.status === 'confirmed');

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Dashboard</h1>
        <p className="text-sm text-slate-400 mt-1">Welcome back. Here's what's happening with your practice today.</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        <StatsCard
          title="Total Leads"
          value={leads.length}
          subtitle="all time"
          icon={Users}
          color="blue"
        />
        <StatsCard
          title="Today's Calls"
          value={todayLeads.length}
          subtitle="new inquiries"
          icon={UserPlus}
          color="green"
        />
        <StatsCard
          title="Hot Leads"
          value={hotLeads.length}
          subtitle="score 70+"
          icon={Flame}
          color="red"
        />
        <StatsCard
          title="Booked"
          value={bookedCount}
          subtitle="consultations"
          icon={CalendarCheck}
          color="purple"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Recent Leads */}
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm">
          <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center">
            <div>
              <h3 className="font-semibold text-slate-900 text-[15px]">Recent Leads</h3>
              <p className="text-xs text-slate-400 mt-0.5">Latest callers from Sarah</p>
            </div>
            <Link to="/leads" className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors">
              View all <ArrowRight size={12} />
            </Link>
          </div>
          <div className="divide-y divide-slate-100">
            {leads.length === 0 ? (
              <div className="p-8 text-center">
                <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                  <PhoneIncoming size={20} className="text-slate-400" />
                </div>
                <p className="text-sm font-medium text-slate-500">No leads yet</p>
                <p className="text-xs text-slate-400 mt-1">When someone calls Sarah, leads will appear here.</p>
              </div>
            ) : (
              leads.slice(0, 5).map((lead) => (
                <Link key={lead.id} to={`/leads/${lead.id}`} className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50/80 transition-colors group">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-gradient-to-br from-slate-100 to-slate-200 rounded-full flex items-center justify-center text-xs font-bold text-slate-600">
                      {lead.caller_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{lead.caller_name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-slate-400 capitalize">{lead.case_type}</span>
                        <span className="text-slate-300">·</span>
                        <span className="text-xs text-slate-400">{lead.caller_phone}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <ScoreBadge score={lead.score} label={lead.score_label} />
                    <ChevronRight size={14} className="text-slate-300 group-hover:text-slate-500 transition-colors" />
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Upcoming Appointments */}
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm">
          <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center">
            <div>
              <h3 className="font-semibold text-slate-900 text-[15px]">Upcoming Consultations</h3>
              <p className="text-xs text-slate-400 mt-0.5">Booked by Sarah</p>
            </div>
            <Link to="/appointments" className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors">
              View all <ArrowRight size={12} />
            </Link>
          </div>
          <div className="divide-y divide-slate-100">
            {upcomingApts.length === 0 ? (
              <div className="p-8 text-center">
                <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                  <CalendarCheck size={20} className="text-slate-400" />
                </div>
                <p className="text-sm font-medium text-slate-500">No upcoming appointments</p>
                <p className="text-xs text-slate-400 mt-1">When Sarah books a consultation, it will show here.</p>
              </div>
            ) : (
              upcomingApts.slice(0, 5).map((apt) => (
                <div key={apt.id} className="px-5 py-3.5 hover:bg-slate-50/80 transition-colors">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-gradient-to-br from-violet-100 to-violet-200 rounded-full flex items-center justify-center text-xs font-bold text-violet-600">
                        {apt.caller_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{apt.caller_name}</p>
                        <p className="text-xs text-slate-400 capitalize">{apt.case_type}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                        <CalendarCheck size={13} className="text-violet-500" />
                        {apt.appointment_date}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-slate-400 mt-0.5 justify-end">
                        <Clock size={11} />
                        {apt.appointment_time}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
