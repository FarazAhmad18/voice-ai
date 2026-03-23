import { useState, useEffect } from 'react';
import { useParams, Link, useLocation, useSearchParams } from 'react-router-dom';
import { fetchLead, updateLead, addCallNote, fetchStaff, fetchMessages } from '../services/api';
import { useFirm } from '../context/FirmContext';
import { toast } from 'sonner';
import ScoreBadge from '../components/ScoreBadge';
import StatusBadge from '../components/StatusBadge';
import MessageTimeline from '../components/MessageTimeline';
import MessageComposer from '../components/MessageComposer';
import {
  ArrowLeft, Phone, Mail, Briefcase, AlertTriangle, CalendarCheck,
  Clock, FileText, Send, UserCheck, Bell, User, PhoneIncoming,
  MessageSquare, Mic, ChevronDown, ChevronUp, ExternalLink, Copy,
  Activity, Check, Sparkles, Hash, Globe,
} from 'lucide-react';

const STATUS_FLOW = [
  { key: 'new', label: 'New', color: 'emerald' },
  { key: 'contacted', label: 'Following Up', color: 'amber' },
  { key: 'booked', label: 'Booked', color: 'violet' },
  { key: 'converted', label: 'Converted', color: 'teal' },
  { key: 'closed', label: 'Closed', color: 'slate' },
];

function formatDuration(seconds) {
  if (!seconds) return '0s';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${s}s`;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function daysSince(dateStr) {
  if (!dateStr) return null;
  const diff = new Date() - new Date(dateStr);
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function getScoreGradient(scoreLabel) {
  if (scoreLabel === 'hot') return 'from-red-500 to-orange-500';
  if (scoreLabel === 'warm') return 'from-amber-400 to-orange-400';
  return 'from-slate-400 to-slate-500';
}

function getScoreRingColor(scoreLabel) {
  if (scoreLabel === 'hot') return '#ef4444';
  if (scoreLabel === 'warm') return '#f59e0b';
  return '#94a3b8';
}

function getScoreTrackColor(scoreLabel) {
  if (scoreLabel === 'hot') return '#fef2f2';
  if (scoreLabel === 'warm') return '#fffbeb';
  return '#f8fafc';
}

function ScoreArc({ score, label }) {
  const size = 72;
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const offset = circumference - progress;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={getScoreTrackColor(label)}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={getScoreRingColor(label)}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-extrabold text-slate-900 leading-none">{score}</span>
        <span className={`text-[9px] font-bold uppercase tracking-wider mt-0.5 ${
          label === 'hot' ? 'text-red-500' : label === 'warm' ? 'text-amber-500' : 'text-slate-400'
        }`}>{label}</span>
      </div>
    </div>
  );
}

export default function LeadDetail() {
  const { id } = useParams();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { labels } = useFirm();
  const [lead, setLead] = useState(null);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState([]);
  const [noteText, setNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [followUpDate, setFollowUpDate] = useState('');
  const [expandedCalls, setExpandedCalls] = useState({});
  const [copied, setCopied] = useState('');

  const cameFromFollowUps = location.state?.from === 'follow-ups' || searchParams.get('from') === 'follow-ups';

  useEffect(() => {
    async function loadData() {
      try {
        const [leadData, staffData, messagesData] = await Promise.all([
          fetchLead(id),
          fetchStaff().catch(() => []),
          fetchMessages(id).catch(() => []),
        ]);
        setLead(leadData);
        setStaff(staffData);
        setMessages(Array.isArray(messagesData) ? messagesData : []);
        setFollowUpDate(leadData.follow_up_date || '');
      } catch (err) {
        // error handled by UI state
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [id]);

  async function handleStatusChange(newStatus) {
    try {
      const updated = await updateLead(id, { status: newStatus });
      setLead((prev) => ({ ...prev, ...updated }));
      toast.success(`Status updated to ${newStatus}`);
    } catch (err) {
      toast.error('Failed to update status');
    }
  }

  async function handleAssignStaff(staffId) {
    try {
      await updateLead(id, { assigned_staff_id: staffId || null });
      setLead((prev) => ({ ...prev, assigned_staff_id: staffId || null }));
      const staffMember = staff.find(s => s.id === staffId);
      toast.success(staffId ? `Assigned to ${staffMember?.name || 'staff'}` : 'Staff unassigned');
    } catch (err) {
      toast.error('Failed to assign staff');
    }
  }

  async function handleSetFollowUp() {
    if (!followUpDate) return;
    try {
      await updateLead(id, { follow_up_date: followUpDate });
      setLead((prev) => ({ ...prev, follow_up_date: followUpDate }));
      toast.success(`Follow-up set for ${followUpDate}`);
    } catch (err) {
      toast.error('Failed to set follow-up');
    }
  }

  async function handleAddNote() {
    if (!noteText.trim()) return;
    setSavingNote(true);
    try {
      await addCallNote(id, noteText);
      setLead((prev) => ({
        ...prev,
        call_notes: [...(prev.call_notes || []), { text: noteText, created_at: new Date().toISOString() }],
      }));
      setNoteText('');
      toast.success('Note added');
    } catch (err) {
      toast.error('Failed to add note');
    } finally {
      setSavingNote(false);
    }
  }

  async function refreshMessages() {
    try {
      const messagesData = await fetchMessages(id);
      setMessages(Array.isArray(messagesData) ? messagesData : []);
    } catch (err) {
      // silently fail on message refresh — user can retry
    }
  }

  function copyToClipboard(text, label) {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(''), 2000);
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-5 w-20 bg-slate-100 rounded animate-pulse" />
        {/* Header skeleton */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 bg-slate-100 rounded-2xl animate-pulse" />
            <div className="flex-1">
              <div className="h-6 w-48 bg-slate-100 rounded animate-pulse" />
              <div className="flex gap-3 mt-3">
                <div className="h-8 w-36 bg-slate-50 rounded-lg animate-pulse" />
                <div className="h-8 w-40 bg-slate-50 rounded-lg animate-pulse" />
              </div>
            </div>
            <div className="h-[72px] w-[72px] bg-slate-50 rounded-full animate-pulse" />
          </div>
        </div>
        {/* Pipeline skeleton */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          <div className="flex gap-2">
            {[1,2,3,4,5].map(i => (
              <div key={i} className="flex-1 h-3 bg-slate-100 rounded-full animate-pulse" />
            ))}
          </div>
        </div>
        {/* Content skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4 space-y-5">
            {[1,2,3].map(i => (
              <div key={i} className="bg-white rounded-2xl border border-slate-100 p-5">
                <div className="h-4 w-24 bg-slate-100 rounded animate-pulse mb-4" />
                {[1,2,3].map(j => (
                  <div key={j} className="flex gap-3 mb-3">
                    <div className="w-9 h-9 bg-slate-50 rounded-lg animate-pulse" />
                    <div className="flex-1">
                      <div className="h-3 w-16 bg-slate-50 rounded animate-pulse" />
                      <div className="h-4 w-24 bg-slate-100 rounded animate-pulse mt-1" />
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div className="lg:col-span-8 space-y-5">
            <div className="bg-slate-50 rounded-2xl p-5 h-24 animate-pulse" />
            <div className="bg-white rounded-2xl border border-slate-100 p-5 h-64 animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="text-center py-20">
        <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <User size={24} className="text-slate-300" />
        </div>
        <p className="text-base font-semibold text-slate-600">Lead not found</p>
        <p className="text-sm text-slate-400 mt-1">This lead may have been removed</p>
        <Link to="/leads" className="inline-flex items-center gap-1.5 text-sm font-medium text-violet-600 hover:text-violet-700 mt-4">
          <ArrowLeft size={14} />
          Back to Leads
        </Link>
      </div>
    );
  }

  const initials = ((lead.caller_name || 'U').split(' ').map(n => n?.[0] || '').join('').slice(0, 2).toUpperCase()) || '?';
  const activeStaff = staff.filter(s => s.is_active);
  const assignedStaffMember = staff.find(s => s.id === lead.assigned_staff_id);
  const currentStatusIdx = STATUS_FLOW.findIndex(s => s.key === lead.status);
  const days = daysSince(lead.created_at);
  const gradient = getScoreGradient(lead.score_label);
  const latestAppointment = lead.appointments?.[0] || null;

  return (
    <div className="space-y-6">
      {/* Back */}
      <Link
        to={cameFromFollowUps ? '/follow-ups' : '/leads'}
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-slate-600 transition-colors group"
      >
        <ArrowLeft size={15} className="group-hover:-translate-x-0.5 transition-transform" />
        {cameFromFollowUps ? 'Follow Ups' : 'Leads'}
      </Link>

      {/* Header Card */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm shadow-slate-100/50 overflow-hidden">
        <div className="p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-5">
              {/* Avatar with gradient ring */}
              <div className="relative">
                <div className={`w-16 h-16 bg-gradient-to-br ${gradient} rounded-2xl flex items-center justify-center text-xl font-extrabold text-white shadow-lg`}
                  style={{ boxShadow: `0 8px 24px -4px ${lead.score_label === 'hot' ? 'rgba(239,68,68,0.3)' : lead.score_label === 'warm' ? 'rgba(245,158,11,0.3)' : 'rgba(100,116,139,0.2)'}` }}
                >
                  {initials}
                </div>
                {lead.urgency === 'high' && (
                  <div className="absolute -top-1 -right-1">
                    <span className="relative flex h-3.5 w-3.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-red-500 border-2 border-white" />
                    </span>
                  </div>
                )}
              </div>
              <div>
                <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">{lead.caller_name}</h1>
                <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                  {/* Contact chips */}
                  {lead.caller_phone && (
                    <button
                      onClick={() => copyToClipboard(lead.caller_phone, 'phone')}
                      className="inline-flex items-center gap-2 px-3.5 py-1.5 text-sm font-medium text-slate-600 bg-slate-50 border border-slate-100 rounded-lg hover:bg-violet-50 hover:text-violet-600 hover:border-violet-200 transition-all group/chip"
                    >
                      <Phone size={13} className="text-slate-400 group-hover/chip:text-violet-500" />
                      <span className="font-mono text-[13px]">{lead.caller_phone}</span>
                      {copied === 'phone' ? (
                        <Check size={12} className="text-emerald-500" />
                      ) : (
                        <Copy size={11} className="text-slate-300 opacity-0 group-hover/chip:opacity-100 transition-opacity" />
                      )}
                    </button>
                  )}
                  {lead.caller_email && lead.caller_email !== 'Not provided' && (
                    <button
                      onClick={() => copyToClipboard(lead.caller_email, 'email')}
                      className="inline-flex items-center gap-2 px-3.5 py-1.5 text-sm font-medium text-slate-600 bg-slate-50 border border-slate-100 rounded-lg hover:bg-violet-50 hover:text-violet-600 hover:border-violet-200 transition-all group/chip"
                    >
                      <Mail size={13} className="text-slate-400 group-hover/chip:text-violet-500" />
                      {lead.caller_email}
                      {copied === 'email' ? (
                        <Check size={12} className="text-emerald-500" />
                      ) : (
                        <Copy size={11} className="text-slate-300 opacity-0 group-hover/chip:opacity-100 transition-opacity" />
                      )}
                    </button>
                  )}
                  <StatusBadge status={lead.status} />
                </div>
              </div>
            </div>
            {/* Score Arc */}
            <div className="flex-shrink-0">
              <ScoreArc score={lead.score} label={lead.score_label} />
            </div>
          </div>
        </div>

        {/* Pipeline Stepper */}
        <div className="px-6 py-5 bg-slate-50/50 border-t border-slate-100 overflow-x-auto">
          <div className="flex items-center">
            {STATUS_FLOW.map((stage, idx) => {
              const isActive = lead.status === stage.key;
              const isPast = idx < currentStatusIdx;
              const isLast = idx === STATUS_FLOW.length - 1;
              const colorMap = {
                emerald: { active: 'bg-emerald-500 border-emerald-500', past: 'bg-emerald-500 border-emerald-500', line: 'bg-emerald-300', ring: 'ring-emerald-500/20' },
                amber: { active: 'bg-amber-500 border-amber-500', past: 'bg-amber-500 border-amber-500', line: 'bg-amber-300', ring: 'ring-amber-500/20' },
                violet: { active: 'bg-violet-500 border-violet-500', past: 'bg-violet-500 border-violet-500', line: 'bg-violet-300', ring: 'ring-violet-500/20' },
                teal: { active: 'bg-teal-500 border-teal-500', past: 'bg-teal-500 border-teal-500', line: 'bg-teal-300', ring: 'ring-teal-500/20' },
                slate: { active: 'bg-slate-500 border-slate-500', past: 'bg-slate-500 border-slate-500', line: 'bg-slate-300', ring: 'ring-slate-500/20' },
              };
              const colors = colorMap[stage.color];
              return (
                <div key={stage.key} className={`flex items-center ${isLast ? '' : 'flex-1'}`}>
                  <button
                    onClick={() => handleStatusChange(stage.key)}
                    className="flex flex-col items-center group relative"
                  >
                    {/* Step dot */}
                    <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
                      isActive
                        ? `${colors.active} ring-4 ${colors.ring} shadow-sm`
                        : isPast
                        ? `${colors.past}`
                        : 'bg-white border-slate-200 group-hover:border-slate-300'
                    }`}>
                      {isPast ? (
                        <Check size={14} className="text-white" />
                      ) : isActive ? (
                        <div className="w-2.5 h-2.5 rounded-full bg-white" />
                      ) : (
                        <div className="w-2 h-2 rounded-full bg-slate-200 group-hover:bg-slate-300 transition-colors" />
                      )}
                    </div>
                    <p className={`text-[11px] mt-2 text-center font-semibold whitespace-nowrap transition-colors ${
                      isActive ? 'text-slate-900' : isPast ? 'text-slate-500' : 'text-slate-400 group-hover:text-slate-600'
                    }`}>
                      {stage.label}
                    </p>
                  </button>
                  {/* Connector line */}
                  {!isLast && (
                    <div className="flex-1 h-0.5 mx-2 mt-[-18px] rounded-full overflow-hidden bg-slate-100">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          isPast ? colors.line : idx === currentStatusIdx ? `${colors.line} opacity-40` : ''
                        }`}
                        style={{ width: isPast ? '100%' : idx === currentStatusIdx ? '50%' : '0%' }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Sidebar */}
        <div className="lg:col-span-4 space-y-5">
          {/* Lead Info Card */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm shadow-slate-100/50 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
              <h3 className="text-sm font-bold text-slate-900">Lead Details</h3>
            </div>
            <div className="p-5 space-y-5">
              <InfoRow icon={Briefcase} label={labels.case} value={lead.case_type} iconColor="text-amber-500 bg-amber-50" />
              <InfoRow icon={AlertTriangle} label="Urgency" value={lead.urgency} iconColor="text-red-500 bg-red-50"
                valueClass={lead.urgency === 'high' ? 'text-red-600 font-semibold' : ''} />
              {latestAppointment ? (
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-violet-500 bg-violet-50">
                    <CalendarCheck size={15} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-400 mb-1">Appointment</p>
                    <p className="text-sm font-semibold text-emerald-600">
                      {latestAppointment.appointment_date} at {latestAppointment.appointment_time}
                    </p>
                    {latestAppointment.staff?.name && (
                      <p className="text-xs text-slate-500 mt-0.5">
                        with {latestAppointment.staff.name}
                        {latestAppointment.staff.specialization ? ` · ${latestAppointment.staff.specialization}` : ''}
                      </p>
                    )}
                    <span className={`inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                      latestAppointment.status === 'confirmed' ? 'bg-emerald-50 text-emerald-600' :
                      latestAppointment.status === 'completed' ? 'bg-blue-50 text-blue-600' :
                      latestAppointment.status === 'cancelled' ? 'bg-red-50 text-red-500' :
                      'bg-slate-50 text-slate-500'
                    }`}>{latestAppointment.status}</span>
                  </div>
                </div>
              ) : (
                <InfoRow icon={CalendarCheck} label="Appointment" value="Not booked" iconColor="text-violet-500 bg-violet-50" valueClass="text-slate-400" />
              )}
              <InfoRow icon={PhoneIncoming} label="Source" value={lead.source || 'Phone'} iconColor="text-blue-500 bg-blue-50" />
              <InfoRow icon={Clock} label="First Contact" value={`${new Date(lead.created_at).toLocaleDateString()}${days !== null ? ` (${days}d ago)` : ''}`} iconColor="text-slate-400 bg-slate-50" />
              {lead.sentiment && (
                <InfoRow icon={MessageSquare} label="Sentiment" value={lead.sentiment} iconColor="text-indigo-500 bg-indigo-50" />
              )}
            </div>
          </div>

          {/* Assign Staff */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm shadow-slate-100/50 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">Assigned {labels.staff}</h3>
              {assignedStaffMember && (
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full uppercase tracking-wider">Assigned</span>
              )}
            </div>
            <div className="p-3">
              {activeStaff.length > 0 ? (
                <div className="space-y-1.5">
                  {activeStaff.map(s => {
                    const isAssigned = lead.assigned_staff_id === s.id;
                    const staffInitial = s.name?.charAt(0) || '?';
                    return (
                      <button
                        key={s.id}
                        onClick={() => handleAssignStaff(isAssigned ? null : s.id)}
                        className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm transition-all duration-200 text-left ${
                          isAssigned
                            ? 'bg-gradient-to-r from-slate-800 to-slate-900 text-white shadow-lg shadow-slate-900/20 ring-2 ring-violet-500/30'
                            : 'hover:bg-slate-50 text-slate-600 border border-transparent hover:border-slate-100'
                        }`}
                      >
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold transition-all ${
                          isAssigned ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                        }`}>
                          {staffInitial}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold truncate">{s.name}</p>
                          {s.specialization && (
                            <p className={`text-[11px] mt-0.5 ${isAssigned ? 'text-white/50' : 'text-slate-400'}`}>{s.specialization}</p>
                          )}
                        </div>
                        {isAssigned && (
                          <div className="w-6 h-6 bg-violet-500 rounded-lg flex items-center justify-center">
                            <UserCheck size={13} className="text-white" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="px-3 py-6 text-center">
                  <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center mx-auto mb-2">
                    <User size={16} className="text-slate-300" />
                  </div>
                  <p className="text-sm text-slate-400">No {labels.staff.toLowerCase()} available</p>
                </div>
              )}
            </div>
          </div>

          {/* Follow-up Date */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm shadow-slate-100/50 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
              <h3 className="text-sm font-bold text-slate-900">Follow-up Reminder</h3>
            </div>
            <div className="p-5">
              <div className="flex gap-2">
                <input
                  type="date"
                  value={followUpDate}
                  onChange={(e) => setFollowUpDate(e.target.value)}
                  className="flex-1 px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-300 transition-all"
                />
                <button
                  onClick={handleSetFollowUp}
                  disabled={!followUpDate}
                  className="px-4 py-2.5 bg-slate-900 text-white text-xs font-semibold rounded-xl hover:bg-slate-800 transition-all disabled:opacity-30 shadow-sm hover:shadow-md disabled:shadow-none"
                >
                  <Bell size={14} />
                </button>
              </div>
              {lead.follow_up_date && (
                <div className="mt-3 flex items-center gap-2.5 px-3.5 py-2.5 bg-emerald-50 border border-emerald-100 rounded-xl">
                  <CalendarCheck size={14} className="text-emerald-500" />
                  <p className="text-xs font-semibold text-emerald-700">Reminder set for {lead.follow_up_date}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-8 space-y-5">
          {/* AI Summary — gradient sparkle card */}
          {lead.notes && (
            <div className="relative overflow-hidden bg-gradient-to-br from-violet-50 via-blue-50 to-indigo-50 rounded-2xl border border-violet-100/50 p-6">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-violet-200/20 to-blue-200/20 rounded-full blur-3xl" />
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-indigo-200/20 to-violet-200/20 rounded-full blur-2xl" />
              <div className="relative">
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="w-7 h-7 bg-gradient-to-br from-violet-500 to-blue-500 rounded-lg flex items-center justify-center shadow-sm shadow-violet-500/20">
                    <Sparkles size={13} className="text-white" />
                  </div>
                  <h3 className="text-xs font-extrabold text-violet-700 uppercase tracking-widest">AI Call Summary</h3>
                </div>
                <p className="text-sm text-slate-800 leading-relaxed font-medium">{lead.notes}</p>
              </div>
            </div>
          )}

          {/* Unified Activity Section */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm shadow-slate-100/50 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50 to-white">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 bg-slate-100 rounded-lg flex items-center justify-center">
                  <Activity size={14} className="text-slate-500" />
                </div>
                <h3 className="text-sm font-bold text-slate-900">Activity</h3>
                {(messages.length + (lead.calls?.length || 0) + (lead.call_notes?.length || 0)) > 0 && (
                  <span className="text-[11px] font-semibold text-slate-400 bg-slate-100 px-2.5 py-0.5 rounded-full tabular-nums">
                    {messages.length + (lead.calls?.length || 0) + (lead.call_notes?.length || 0)}
                  </span>
                )}
              </div>
            </div>
            <div className="p-5">
              <MessageTimeline
                messages={messages}
                calls={lead.calls || []}
                legacyNotes={lead.call_notes || []}
              />
            </div>
          </div>

          {/* Message Composer */}
          <MessageComposer leadId={id} onMessageSent={refreshMessages} />

          {/* Intake Answers — pill-style Q&A */}
          {lead.intake_answers && lead.intake_answers.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm shadow-slate-100/50 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2.5 bg-gradient-to-r from-slate-50 to-white">
                <div className="w-7 h-7 bg-slate-100 rounded-lg flex items-center justify-center">
                  <FileText size={14} className="text-slate-500" />
                </div>
                <h3 className="text-sm font-bold text-slate-900">Intake Answers</h3>
                <span className="text-[11px] font-semibold text-slate-400 bg-slate-100 px-2.5 py-0.5 rounded-full tabular-nums">{lead.intake_answers.length}</span>
              </div>
              <div className="p-5 space-y-3">
                {lead.intake_answers.map((qa, i) => (
                  <div key={i} className="flex items-start gap-3 group">
                    <div className="w-6 h-6 bg-violet-50 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-[10px] font-bold text-violet-400">{i + 1}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{qa.question}</p>
                      <p className="text-sm text-slate-800 mt-1 font-semibold bg-slate-50 px-3 py-2 rounded-lg border border-slate-100">
                        {qa.answer}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value, iconColor, valueClass = '' }) {
  return (
    <div className="flex items-center gap-3.5 group">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105 ${iconColor}`}>
        <Icon size={16} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">{label}</p>
        <p className={`text-sm font-semibold text-slate-800 capitalize mt-0.5 ${valueClass}`}>{value}</p>
      </div>
    </div>
  );
}
