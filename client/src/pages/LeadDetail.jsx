import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useLocation, useSearchParams } from 'react-router-dom';
import { fetchLead, updateLead, fetchStaff, fetchMessages, sendMessage } from '../services/api';
import { useFirm } from '../context/FirmContext';
import { toast } from 'sonner';
import ScoreBadge from '../components/ScoreBadge';
import StatusBadge from '../components/StatusBadge';
import MessageTimeline from '../components/MessageTimeline';
import ConfirmModal from '../components/ConfirmModal';
import {
  Phone, Mail, Briefcase, AlertTriangle, CalendarCheck,
  Clock, FileText, UserCheck, User, PhoneIncoming,
  MessageSquare, ChevronDown, Copy, Send,
  Activity, Check, Sparkles, ChevronRight,
} from 'lucide-react';

const PIPELINE_STAGES = [
  { key: 'new', label: 'New', barColor: 'bg-emerald-500' },
  { key: 'contacted', label: 'Following Up', barColor: 'bg-amber-500' },
  { key: 'booked', label: 'Booked', barColor: 'bg-violet-500' },
  { key: 'converted', label: 'Converted', barColor: 'bg-teal-500' },
  { key: 'closed', label: 'Closed', barColor: 'bg-slate-400' },
];

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

function daysSince(dateStr) {
  if (!dateStr) return null;
  const diff = new Date() - new Date(dateStr);
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function getScoreGradient(scoreLabel) {
  if (scoreLabel === 'hot') return 'bg-red-500';
  if (scoreLabel === 'warm') return 'bg-amber-500';
  return 'bg-slate-400';
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
  const [followUpDate, setFollowUpDate] = useState('');
  const [copied, setCopied] = useState('');
  const [intakeOpen, setIntakeOpen] = useState(false);
  const [directionFilter, setDirectionFilter] = useState('all');
  const [pageTab, setPageTab] = useState('details');
  const [staffDropdownOpen, setStaffDropdownOpen] = useState(false);
  const [pendingStaffId, setPendingStaffId] = useState(null);
  const [composerModal, setComposerModal] = useState(null); // null | 'sms' | 'email' | 'note'

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

  async function handleSetFollowUp(date) {
    const value = date || followUpDate;
    if (date === null) {
      // Clear follow-up
      try {
        await updateLead(id, { follow_up_date: null });
        setLead(prev => ({ ...prev, follow_up_date: null }));
        setFollowUpDate('');
        toast.success('Follow-up cleared');
      } catch { toast.error('Failed to clear follow-up'); }
      return;
    }
    if (!value) return;
    try {
      await updateLead(id, { follow_up_date: value });
      setLead(prev => ({ ...prev, follow_up_date: value }));
      setFollowUpDate('');
      toast.success('Follow-up set');
    } catch { toast.error('Failed to set follow-up'); }
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
      <div className="space-y-4">
        <div className="h-5 w-20 bg-slate-100 rounded animate-pulse" />
        {/* Header skeleton */}
        <div className="bg-white rounded-lg border border-slate-100 p-4">
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 bg-slate-100 rounded-lg animate-pulse" />
            <div className="flex-1">
              <div className="h-6 w-48 bg-slate-100 rounded animate-pulse" />
              <div className="flex gap-3 mt-3">
                <div className="h-8 w-36 bg-slate-50 rounded-lg animate-pulse" />
                <div className="h-8 w-40 bg-slate-50 rounded-lg animate-pulse" />
              </div>
            </div>
          </div>
        </div>
        {/* Pipeline skeleton */}
        <div className="bg-white rounded-lg border border-slate-100 p-4">
          <div className="flex gap-2">
            {[1,2,3,4,5].map(i => (
              <div key={i} className="flex-1 h-3 bg-slate-100 rounded-full animate-pulse" />
            ))}
          </div>
        </div>
        {/* Content skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-4 space-y-3">
            {[1,2,3].map(i => (
              <div key={i} className="bg-white rounded-lg border border-slate-100 p-4">
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
          <div className="lg:col-span-8 space-y-3">
            <div className="bg-slate-50 rounded-lg p-4 h-24 animate-pulse" />
            <div className="bg-white rounded-lg border border-slate-100 p-4 h-64 animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="text-center py-20">
        <div className="w-16 h-16 bg-slate-50 rounded-lg flex items-center justify-center mx-auto mb-4">
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
  const days = daysSince(lead.created_at);
  const gradient = getScoreGradient(lead.score_label);
  const latestAppointment = lead.appointments?.[0] || null;

  return (
    <div className="space-y-4">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm">
        <Link to="/" className="text-slate-400 hover:text-slate-600 transition-colors">Dashboard</Link>
        <ChevronRight size={14} className="text-slate-300" />
        <Link to={cameFromFollowUps ? '/follow-ups' : '/leads'} className="text-slate-400 hover:text-slate-600 transition-colors">
          {cameFromFollowUps ? 'Follow Ups' : 'Leads'}
        </Link>
        <ChevronRight size={14} className="text-slate-300" />
        <span className="text-slate-700 font-medium truncate max-w-[200px]">{lead?.caller_name || 'Lead'}</span>
      </nav>

      {/* Header Card */}
      <div className="bg-white rounded-lg border border-slate-100 shadow-sm shadow-slate-100/50 overflow-hidden">
        <div className="p-4">
          <div className="flex items-start justify-between gap-4">
            {/* Left: Name + contact info */}
            <div className="flex items-center gap-3 min-w-0">
              <div className={`w-10 h-10 ${gradient} rounded-lg flex items-center justify-center text-sm font-bold text-white flex-shrink-0`}>
                {initials}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2.5">
                  <h1 className="text-lg font-bold text-slate-900 truncate">{lead.caller_name}</h1>
                  <ScoreBadge score={lead.score} label={lead.score_label} />
                </div>
                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                  {lead.caller_phone && (
                    <button
                      onClick={() => copyToClipboard(lead.caller_phone, 'phone')}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-600 bg-slate-50 border border-slate-100 rounded-md hover:bg-violet-50 hover:text-violet-600 hover:border-violet-200 transition-all group/chip"
                    >
                      <Phone size={12} className="text-slate-400 group-hover/chip:text-violet-500" />
                      <span className="font-mono text-[12px]">{lead.caller_phone}</span>
                      {copied === 'phone' ? <Check size={11} className="text-emerald-500" /> : <Copy size={10} className="text-slate-300 opacity-0 group-hover/chip:opacity-100 transition-opacity" />}
                    </button>
                  )}
                  {lead.caller_email && lead.caller_email !== 'Not provided' && (
                    <button
                      onClick={() => copyToClipboard(lead.caller_email, 'email')}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-600 bg-slate-50 border border-slate-100 rounded-md hover:bg-violet-50 hover:text-violet-600 hover:border-violet-200 transition-all group/chip"
                    >
                      <Mail size={12} className="text-slate-400 group-hover/chip:text-violet-500" />
                      <span className="text-[12px]">{lead.caller_email}</span>
                      {copied === 'email' ? <Check size={11} className="text-emerald-500" /> : <Copy size={10} className="text-slate-300 opacity-0 group-hover/chip:opacity-100 transition-opacity" />}
                    </button>
                  )}
                  <StatusBadge status={lead.status} />
                  {lead.created_at && <span className="text-[11px] text-slate-400">· {formatRelativeTime(lead.created_at)}</span>}
                </div>
              </div>
            </div>

            {/* Right: Quick Actions — prominent */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {lead.caller_phone && (
                <a href={`tel:${lead.caller_phone}`} className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors border border-emerald-200">
                  <Phone size={15} /> Call
                </a>
              )}
              <button onClick={() => setComposerModal('sms')} className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors border border-blue-200">
                <MessageSquare size={15} /> SMS
              </button>
              {lead.caller_email && lead.caller_email !== 'Not provided' && (
                <a href={`mailto:${lead.caller_email}`} className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-violet-700 bg-violet-50 rounded-lg hover:bg-violet-100 transition-colors border border-violet-200">
                  <Mail size={15} /> Email
                </a>
              )}
            </div>
          </div>

          {/* Slim pipeline bar */}
          <div className="flex items-center gap-1 mt-2.5">
            {PIPELINE_STAGES.map((stage, idx) => {
              const stageIdx = PIPELINE_STAGES.findIndex(s => s.key === lead.status);
              const isPast = idx <= stageIdx;
              return (
                <button key={stage.key} onClick={() => handleStatusChange(stage.key)} className="flex-1 group" title={stage.label}>
                  <div className={`h-1.5 rounded-full transition-all ${isPast ? stage.barColor : 'bg-slate-100'} group-hover:opacity-80`} />
                  <p className={`text-[10px] mt-1 text-center ${idx === stageIdx ? 'text-slate-700 font-semibold' : 'text-slate-300'}`}>{stage.label}</p>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ═══ TOP-LEVEL TABS ═══ */}
      <div className="bg-white rounded-lg border border-slate-100 shadow-sm overflow-hidden">
        {/* Tab bar */}
        <div className="flex border-b border-slate-200">
          <button
            onClick={() => setPageTab('details')}
            className={`px-6 py-3 text-sm font-semibold transition-all border-b-2 ${
              pageTab === 'details' ? 'text-slate-900 border-slate-900' : 'text-slate-400 border-transparent hover:text-slate-600'
            }`}
          >
            Lead Details
          </button>
          <button
            onClick={() => setPageTab('communication')}
            className={`px-6 py-3 text-sm font-semibold transition-all border-b-2 flex items-center gap-2 ${
              pageTab === 'communication' ? 'text-slate-900 border-slate-900' : 'text-slate-400 border-transparent hover:text-slate-600'
            }`}
          >
            Communication & History
            <span className={`text-[11px] tabular-nums px-1.5 py-0.5 rounded-full ${
              pageTab === 'communication' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-400'
            }`}>{messages.length + (lead.calls?.length || 0) + (lead.call_notes?.length || 0)}</span>
          </button>
        </div>

        {/* ── TAB: Lead Details ── */}
        {pageTab === 'details' && (
          <div className="p-5">
            {/* Top row: key fields as a compact table */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-px bg-slate-100 rounded-lg overflow-hidden border border-slate-100 mb-5">
              {[
                { label: labels.case || 'Case', value: lead.case_type?.replace(/_/g, ' ') || '—' },
                { label: 'Urgency', value: lead.urgency || 'Low', valueClass: lead.urgency === 'high' ? 'text-red-600' : '' },
                { label: 'Source', value: lead.source || 'Phone' },
                { label: 'Created', value: `${new Date(lead.created_at).toLocaleDateString()}${days !== null ? ` (${days}d)` : ''}` },
                { label: 'Sentiment', value: lead.sentiment || '—' },
                { label: 'Status', value: lead.status || '—' },
              ].map(f => (
                <div key={f.label} className="bg-white px-4 py-3">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{f.label}</p>
                  <p className={`text-sm font-medium text-slate-800 capitalize mt-0.5 ${f.valueClass || ''}`}>{f.value}</p>
                </div>
              ))}
            </div>

            {/* Two-column layout for the rest */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Left: AI Summary + Appointment */}
              <div className="space-y-5">
                {/* AI Summary */}
                {lead.notes && (
                  <div>
                    <h4 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">AI Call Summary</h4>
                    <div className="bg-violet-50/50 rounded-lg p-4 border border-violet-100/50">
                      <p className="text-sm text-slate-700 leading-relaxed">{lead.notes}</p>
                    </div>
                  </div>
                )}

                {/* Appointment */}
                <div>
                  <h4 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Appointment</h4>
                  {latestAppointment ? (
                    <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-emerald-600">{latestAppointment.appointment_date} · {latestAppointment.appointment_time}</p>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                          latestAppointment.status === 'confirmed' ? 'bg-emerald-50 text-emerald-600' :
                          latestAppointment.status === 'completed' ? 'bg-blue-50 text-blue-600' :
                          latestAppointment.status === 'cancelled' ? 'bg-red-50 text-red-500' : 'bg-slate-50 text-slate-500'
                        }`}>{latestAppointment.status}</span>
                      </div>
                      {latestAppointment.staff?.name && (
                        <p className="text-xs text-slate-500 mt-1">with {latestAppointment.staff.name}{latestAppointment.staff.specialization ? ` · ${latestAppointment.staff.specialization}` : ''}</p>
                      )}
                    </div>
                  ) : (
                    <div className="bg-slate-50 rounded-lg p-4 border border-slate-100 border-dashed text-center">
                      <p className="text-sm text-slate-400">No appointment booked</p>
                    </div>
                  )}
                </div>

                {/* Intake Answers */}
                {lead.intake_answers?.length > 0 && (
                  <div>
                    <button onClick={() => setIntakeOpen(!intakeOpen)} className="flex items-center gap-2 mb-2">
                      <h4 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Intake Answers ({lead.intake_answers.length})</h4>
                      <ChevronDown size={12} className={`text-slate-400 transition-transform ${intakeOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {intakeOpen && (
                      <div className="space-y-2">
                        {lead.intake_answers.map((qa, idx) => (
                          <div key={idx} className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">{qa.question}</p>
                            <p className="text-sm text-slate-700">{qa.answer}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Right: Staff + Follow-up */}
              <div className="space-y-5">
                {/* Staff Assignment */}
                <div>
                  <h4 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3">{labels.staff || 'Assigned Staff'}</h4>

                  {/* Current assignment display */}
                  {lead.assigned_staff_id && activeStaff.find(s => s.id === lead.assigned_staff_id) ? (() => {
                    const assigned = activeStaff.find(s => s.id === lead.assigned_staff_id);
                    return (
                      <div className="bg-slate-50 rounded-lg border border-slate-100 p-3 flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-violet-500 rounded-lg flex items-center justify-center text-xs font-bold text-white">
                            {assigned.name.charAt(0)}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-800">{assigned.name}</p>
                            <p className="text-xs text-slate-400">{assigned.specialization || assigned.role || ''}</p>
                          </div>
                        </div>
                        <button onClick={() => setPendingStaffId('__remove__')} className="text-xs text-slate-400 hover:text-red-500 transition-colors">Remove</button>
                      </div>
                    );
                  })() : (
                    <div className="bg-slate-50 rounded-lg border border-slate-100 border-dashed p-3 text-center mb-2">
                      <p className="text-sm text-slate-400">No staff assigned</p>
                    </div>
                  )}

                  {/* Custom dropdown */}
                  <div className="relative">
                    <button
                      onClick={() => setStaffDropdownOpen(!staffDropdownOpen)}
                      className="w-full flex items-center justify-between px-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-white hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      <span className="text-slate-400">{lead.assigned_staff_id ? 'Reassign to...' : 'Assign to...'}</span>
                      <ChevronDown size={14} className={`text-slate-400 transition-transform ${staffDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {staffDropdownOpen && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg border border-slate-200 shadow-lg z-20 overflow-hidden">
                        {activeStaff.filter(s => s.id !== lead.assigned_staff_id).map(s => (
                          <button
                            key={s.id}
                            onClick={() => { setPendingStaffId(s.id); setStaffDropdownOpen(false); }}
                            className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-b-0"
                          >
                            <div className="w-7 h-7 bg-violet-100 rounded-lg flex items-center justify-center text-[10px] font-bold text-violet-600 flex-shrink-0">
                              {s.name.charAt(0)}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-slate-700 truncate">{s.name}</p>
                              {s.specialization && <p className="text-[11px] text-slate-400 truncate">{s.specialization}</p>}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Confirmation modal for staff change */}
                  <ConfirmModal
                    open={!!pendingStaffId}
                    onCancel={() => setPendingStaffId(null)}
                    onConfirm={() => {
                      if (pendingStaffId === '__remove__') handleAssignStaff(null);
                      else handleAssignStaff(pendingStaffId);
                      setPendingStaffId(null);
                    }}
                    title={pendingStaffId === '__remove__' ? 'Remove staff assignment?' : 'Reassign lead?'}
                    message={
                      pendingStaffId === '__remove__'
                        ? `Remove the current staff assignment for ${lead.caller_name}?`
                        : `Assign ${lead.caller_name} to ${activeStaff.find(s => s.id === pendingStaffId)?.name || 'this staff member'}?`
                    }
                    confirmLabel={pendingStaffId === '__remove__' ? 'Remove' : 'Assign'}
                    danger={pendingStaffId === '__remove__'}
                  />
                </div>

                {/* Follow-up Reminder */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Follow-up Reminder</h4>
                    {lead.follow_up_date && (
                      <button onClick={() => handleSetFollowUp(null)} className="text-[10px] text-red-400 hover:text-red-600 transition-colors">Clear</button>
                    )}
                  </div>
                  {lead.follow_up_date ? (
                    <div className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium ${
                      new Date(lead.follow_up_date) < new Date(new Date().toDateString()) ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                    }`}>
                      <Clock size={15} />
                      <div>
                        <p className="font-semibold">
                          {new Date(lead.follow_up_date) < new Date(new Date().toDateString()) ? 'Overdue' : 'Scheduled'}
                        </p>
                        <p className="text-xs opacity-80">
                          {new Date(lead.follow_up_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-xs text-slate-400">Set a reminder to follow up with this lead</p>
                      <div className="grid grid-cols-3 gap-2">
                        {[{ label: 'Tomorrow', days: 1 }, { label: 'In 3 days', days: 3 }, { label: 'Next week', days: 7 }].map(opt => {
                          const d = new Date(); d.setDate(d.getDate() + opt.days);
                          const dateLabel = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                          return (
                            <button key={opt.label} onClick={() => handleSetFollowUp(d.toISOString().split('T')[0])} className="flex flex-col items-center px-3 py-2.5 text-slate-600 bg-slate-50 hover:bg-violet-50 hover:text-violet-600 rounded-lg transition-colors border border-slate-200 hover:border-violet-200">
                              <span className="text-xs font-semibold">{opt.label}</span>
                              <span className="text-[10px] text-slate-400 mt-0.5">{dateLabel}</span>
                            </button>
                          );
                        })}
                      </div>
                      <div className="flex gap-2">
                        <input type="date" value={followUpDate} onChange={(e) => setFollowUpDate(e.target.value)} className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500/20" />
                        <button onClick={() => handleSetFollowUp(followUpDate)} disabled={!followUpDate} className="px-4 py-2 text-sm font-medium text-white bg-violet-600 hover:bg-violet-700 rounded-lg disabled:opacity-40 transition-colors">Set</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB: Communication & History ── */}
        {pageTab === 'communication' && (
          <div>
            {/* Action bar: Send SMS / Email / Note + Direction filter */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 bg-slate-50/50 gap-3 flex-wrap">
              {/* Action buttons */}
              <div className="flex items-center gap-2">
                <button onClick={() => setComposerModal('sms')} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors border border-blue-200">
                  <MessageSquare size={12} /> Send SMS
                </button>
                <button onClick={() => setComposerModal('email')} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-violet-600 bg-violet-50 rounded-lg hover:bg-violet-100 transition-colors border border-violet-200">
                  <Mail size={12} /> Send Email
                </button>
                <button onClick={() => setComposerModal('note')} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-600 bg-amber-50 rounded-lg hover:bg-amber-100 transition-colors border border-amber-200">
                  <FileText size={12} /> Add Note
                </button>
                <span className="text-[11px] text-slate-300 ml-1">{messages.length + (lead.calls?.length || 0) + (lead.call_notes?.length || 0)} entries</span>
              </div>

              {/* Direction filter */}
              <div className="flex items-center bg-white rounded-lg p-0.5 border border-slate-200">
                {[
                  { key: 'all', label: 'All' },
                  { key: 'inbound', label: 'Inbound' },
                  { key: 'outbound', label: 'Outbound' },
                ].map(f => (
                  <button
                    key={f.key}
                    onClick={() => setDirectionFilter(f.key)}
                    className={`px-3 py-1 rounded-md text-[11px] font-medium transition-all ${
                      directionFilter === f.key ? 'bg-slate-900 text-white' : 'text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Timeline */}
            <div className="p-4 overflow-y-auto" style={{ maxHeight: 520 }}>
              <MessageTimeline
                messages={
                  directionFilter === 'all' ? messages :
                  directionFilter === 'inbound' ? messages.filter(m => m.direction === 'inbound') :
                  messages.filter(m => m.direction === 'outbound')
                }
                calls={directionFilter === 'outbound' ? [] : (lead.calls || [])}
                legacyNotes={directionFilter === 'inbound' ? [] : (lead.call_notes || [])}
              />
            </div>
          </div>
        )}

        {/* Composer Modal */}
        {composerModal && (
          <ComposerModal
            channel={composerModal}
            leadId={id}
            leadName={lead.caller_name}
            leadPhone={lead.caller_phone}
            smsHistory={messages.filter(m => m.channel === 'sms')}
            onClose={() => setComposerModal(null)}
            onSent={() => { refreshMessages(); setComposerModal(null); }}
          />
        )}
      </div>
    </div>
  );
}

function SidebarRow({ label, value, valueClass = '' }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-slate-400">{label}</span>
      <span className={`text-xs font-medium text-slate-700 capitalize ${valueClass}`}>{value}</span>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value, iconColor, valueClass = '' }) {
  return (
    <div className="flex items-center gap-3">
      <div className={`w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 ${iconColor}`}>
        <Icon size={13} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">{label}</p>
        <p className={`text-sm font-medium text-slate-800 capitalize ${valueClass}`}>{value}</p>
      </div>
    </div>
  );
}

function ComposerModal({ channel, leadId, leadName, leadPhone, smsHistory = [], onClose, onSent }) {
  const [body, setBody] = useState('');
  const [subject, setSubject] = useState('');
  const [sending, setSending] = useState(false);
  const textareaRef = useRef(null);
  const chatEndRef = useRef(null);

  useEffect(() => {
    setTimeout(() => textareaRef.current?.focus(), 100);
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [smsHistory.length]);

  async function handleSend() {
    if (!body.trim()) return;
    if (channel === 'email' && !subject.trim()) { toast.error('Subject required'); return; }
    setSending(true);
    try {
      const payload = { lead_id: leadId, channel, body: body.trim() };
      if (channel === 'email') payload.subject = subject.trim();
      await sendMessage(payload);
      toast.success(channel === 'note' ? 'Note added' : channel === 'sms' ? 'SMS sent' : 'Email sent');
      onSent();
    } catch (err) {
      toast.error(err.message || 'Failed to send');
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey && channel === 'sms') { e.preventDefault(); handleSend(); }
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && channel !== 'sms') { e.preventDefault(); handleSend(); }
  }

  // ── SMS: Chat-style UI ──
  if (channel === 'sms') {
    const sortedSms = [...smsHistory].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    return (
      <>
        <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col" style={{ height: '70vh', maxHeight: 600 }}>
            {/* Chat header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 bg-slate-50 flex-shrink-0">
              <div className="w-9 h-9 bg-blue-500 rounded-full flex items-center justify-center text-xs font-bold text-white">
                {(leadName || 'U').charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate">{leadName || 'Unknown'}</p>
                {leadPhone && <p className="text-[11px] text-slate-400 font-mono">{leadPhone}</p>}
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                <span className="text-lg leading-none">&times;</span>
              </button>
            </div>

            {/* Chat messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/30">
              {sortedSms.length === 0 && (
                <div className="text-center py-10">
                  <p className="text-sm text-slate-400">No SMS history</p>
                  <p className="text-xs text-slate-300 mt-1">Send the first message below</p>
                </div>
              )}
              {sortedSms.map(msg => {
                const isOut = msg.direction === 'outbound';
                const time = new Date(msg.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
                return (
                  <div key={msg.id} className={`flex ${isOut ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] ${isOut ? 'order-1' : ''}`}>
                      <div className={`rounded-2xl px-3.5 py-2 ${
                        isOut ? 'bg-blue-500 text-white rounded-br-md' : 'bg-white border border-slate-200 text-slate-800 rounded-bl-md'
                      }`}>
                        <p className="text-sm leading-relaxed">{msg.body}</p>
                      </div>
                      <p className={`text-[10px] mt-0.5 px-1 ${isOut ? 'text-right text-slate-400' : 'text-slate-400'}`}>
                        {time}
                        {msg.sender && !isOut && <span> · {msg.sender}</span>}
                        {msg.status === 'delivered' && isOut && <span> · Delivered</span>}
                        {msg.status === 'failed' && isOut && <span className="text-red-400"> · Failed</span>}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={chatEndRef} />
            </div>

            {/* Chat input */}
            <div className="flex items-end gap-2 px-3 py-3 border-t border-slate-100 bg-white flex-shrink-0">
              <textarea
                ref={textareaRef}
                rows={1}
                placeholder="Type a message..."
                value={body}
                onChange={(e) => setBody(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={sending}
                className="flex-1 px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 placeholder:text-slate-300 resize-none min-h-[38px] max-h-[100px] disabled:opacity-50"
                style={{ height: 'auto', overflowY: body.split('\n').length > 3 ? 'auto' : 'hidden' }}
              />
              <button
                onClick={handleSend}
                disabled={sending || !body.trim()}
                className="w-9 h-9 flex items-center justify-center bg-blue-500 text-white rounded-full hover:bg-blue-600 transition-colors disabled:opacity-30 flex-shrink-0"
              >
                {sending ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Send size={15} />}
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  // ── Email / Note: Standard modal ──
  const cfg = {
    email: { title: 'Send Email', placeholder: 'Type your email body...', color: 'bg-violet-600' },
    note:  { title: 'Add Note',   placeholder: 'Type your internal note...', color: 'bg-amber-600' },
  }[channel];

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900">{cfg.title}</h3>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors text-lg leading-none">&times;</button>
          </div>
          <div className="p-5 space-y-3">
            {channel === 'email' && (
              <input type="text" placeholder="Subject" value={subject} onChange={(e) => setSubject(e.target.value)}
                className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500/20 placeholder:text-slate-300" />
            )}
            <textarea ref={textareaRef} rows={4} placeholder={cfg.placeholder} value={body} onChange={(e) => setBody(e.target.value)} onKeyDown={handleKeyDown}
              className="w-full px-4 py-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500/20 placeholder:text-slate-300 resize-none min-h-[120px]" />
          </div>
          <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-100 bg-slate-50/50">
            <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">Cancel</button>
            <button onClick={handleSend} disabled={sending || !body.trim()}
              className={`px-5 py-2 text-sm font-medium text-white rounded-lg transition-all disabled:opacity-40 ${cfg.color} hover:opacity-90`}>
              {sending ? 'Sending...' : channel === 'note' ? 'Add Note' : 'Send'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
