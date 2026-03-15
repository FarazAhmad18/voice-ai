import { useState, useEffect } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
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
  Activity,
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

export default function LeadDetail() {
  const { id } = useParams();
  const location = useLocation();
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

  const cameFromFollowUps = location.state?.from === 'follow-ups';

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
        console.error('Failed to fetch lead:', err);
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
      console.error('Failed to refresh messages:', err);
    }
  }

  function copyToClipboard(text, label) {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(''), 2000);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-8 h-8 border-[3px] border-slate-200 border-t-slate-900 rounded-full animate-spin" />
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="text-center py-16">
        <p className="text-sm font-medium text-slate-500">Lead not found</p>
        <Link to="/leads" className="text-sm text-blue-600 mt-2 inline-block">Back to Leads</Link>
      </div>
    );
  }

  const initials = lead.caller_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  const activeStaff = staff.filter(s => s.is_active);
  const assignedStaffMember = staff.find(s => s.id === lead.assigned_staff_id);
  const currentStatusIdx = STATUS_FLOW.findIndex(s => s.key === lead.status);
  const days = daysSince(lead.created_at);

  return (
    <div className="space-y-6">
      {/* Back */}
      <Link
        to={cameFromFollowUps ? '/follow-ups' : '/leads'}
        className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-600 transition-colors"
      >
        <ArrowLeft size={15} />
        {cameFromFollowUps ? 'Follow Ups' : 'Leads'}
      </Link>

      {/* Header Card */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm shadow-slate-100/50 overflow-hidden">
        <div className="p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-gradient-to-br from-slate-700 to-slate-900 rounded-2xl flex items-center justify-center text-lg font-bold text-white shadow-lg shadow-slate-900/20">
                {initials}
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">{lead.caller_name}</h1>
                <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                  {lead.caller_phone && (
                    <button
                      onClick={() => copyToClipboard(lead.caller_phone, 'phone')}
                      className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-blue-600 transition-colors"
                    >
                      <Phone size={13} />
                      {lead.caller_phone}
                      {copied === 'phone' && <span className="text-[10px] text-emerald-500">Copied!</span>}
                    </button>
                  )}
                  {lead.caller_email && lead.caller_email !== 'Not provided' && (
                    <button
                      onClick={() => copyToClipboard(lead.caller_email, 'email')}
                      className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-blue-600 transition-colors"
                    >
                      <Mail size={13} />
                      {lead.caller_email}
                      {copied === 'email' && <span className="text-[10px] text-emerald-500">Copied!</span>}
                    </button>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ScoreBadge score={lead.score} label={lead.score_label} />
              <StatusBadge status={lead.status} />
            </div>
          </div>
        </div>

        {/* Status Pipeline Progress */}
        <div className="px-6 py-4 bg-slate-50/50 border-t border-slate-100">
          <div className="flex items-center gap-1">
            {STATUS_FLOW.map((stage, idx) => {
              const isActive = lead.status === stage.key;
              const isPast = idx < currentStatusIdx;
              const colorMap = {
                emerald: { active: 'bg-emerald-500', past: 'bg-emerald-200', dot: 'ring-emerald-500' },
                amber: { active: 'bg-amber-500', past: 'bg-amber-200', dot: 'ring-amber-500' },
                violet: { active: 'bg-violet-500', past: 'bg-violet-200', dot: 'ring-violet-500' },
                teal: { active: 'bg-teal-500', past: 'bg-teal-200', dot: 'ring-teal-500' },
                slate: { active: 'bg-slate-500', past: 'bg-slate-200', dot: 'ring-slate-500' },
              };
              const colors = colorMap[stage.color];
              return (
                <button
                  key={stage.key}
                  onClick={() => handleStatusChange(stage.key)}
                  className="flex-1 group"
                >
                  <div className={`h-2 rounded-full transition-all ${
                    isActive ? colors.active :
                    isPast ? colors.past :
                    'bg-slate-100 group-hover:bg-slate-200'
                  }`} />
                  <p className={`text-[11px] mt-2 text-center font-medium transition-colors ${
                    isActive ? 'text-slate-900' : 'text-slate-400 group-hover:text-slate-600'
                  }`}>
                    {stage.label}
                  </p>
                </button>
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
            <div className="px-5 py-4 border-b border-slate-100">
              <h3 className="text-sm font-semibold text-slate-900">Lead Details</h3>
            </div>
            <div className="p-5 space-y-4">
              <InfoRow icon={Briefcase} label={labels.case} value={lead.case_type} iconColor="text-amber-500 bg-amber-50" />
              <InfoRow icon={AlertTriangle} label="Urgency" value={lead.urgency} iconColor="text-red-500 bg-red-50"
                valueClass={lead.urgency === 'high' ? 'text-red-600 font-semibold' : ''} />
              <InfoRow icon={CalendarCheck} label="Appointment" value={lead.appointment_booked ? 'Booked' : 'Not booked'} iconColor="text-violet-500 bg-violet-50"
                valueClass={lead.appointment_booked ? 'text-emerald-600' : 'text-slate-400'} />
              <InfoRow icon={PhoneIncoming} label="Source" value={lead.source || 'Phone'} iconColor="text-blue-500 bg-blue-50" />
              <InfoRow icon={Clock} label="First Contact" value={`${new Date(lead.created_at).toLocaleDateString()}${days !== null ? ` (${days}d ago)` : ''}`} iconColor="text-slate-400 bg-slate-50" />
              {lead.sentiment && (
                <InfoRow icon={MessageSquare} label="Sentiment" value={lead.sentiment} iconColor="text-indigo-500 bg-indigo-50" />
              )}
            </div>
          </div>

          {/* Assign Staff */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm shadow-slate-100/50 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">Assigned {labels.staff}</h3>
              {assignedStaffMember && (
                <span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">Assigned</span>
              )}
            </div>
            <div className="p-3">
              {activeStaff.length > 0 ? (
                <div className="space-y-1">
                  {activeStaff.map(s => {
                    const isAssigned = lead.assigned_staff_id === s.id;
                    return (
                      <button
                        key={s.id}
                        onClick={() => handleAssignStaff(isAssigned ? null : s.id)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all text-left ${
                          isAssigned
                            ? 'bg-slate-900 text-white shadow-md shadow-slate-900/20'
                            : 'hover:bg-slate-50 text-slate-600'
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold ${
                          isAssigned ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                        }`}>
                          {s.name?.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{s.name}</p>
                          {s.specialization && (
                            <p className={`text-[11px] ${isAssigned ? 'text-white/60' : 'text-slate-400'}`}>{s.specialization}</p>
                          )}
                        </div>
                        {isAssigned && <UserCheck size={15} />}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="px-3 py-4 text-center">
                  <p className="text-sm text-slate-400">No {labels.staff.toLowerCase()} available</p>
                </div>
              )}
            </div>
          </div>

          {/* Follow-up Date */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm shadow-slate-100/50 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h3 className="text-sm font-semibold text-slate-900">Follow-up Reminder</h3>
            </div>
            <div className="p-5">
              <div className="flex gap-2">
                <input
                  type="date"
                  value={followUpDate}
                  onChange={(e) => setFollowUpDate(e.target.value)}
                  className="flex-1 px-3 py-2.5 text-sm bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-200 transition-all"
                />
                <button
                  onClick={handleSetFollowUp}
                  disabled={!followUpDate}
                  className="px-4 py-2.5 bg-slate-900 text-white text-xs font-medium rounded-xl hover:bg-slate-800 transition-colors disabled:opacity-30"
                >
                  <Bell size={14} />
                </button>
              </div>
              {lead.follow_up_date && (
                <div className="mt-3 flex items-center gap-2 px-3 py-2 bg-emerald-50 rounded-lg">
                  <CalendarCheck size={13} className="text-emerald-500" />
                  <p className="text-xs font-medium text-emerald-700">Reminder set for {lead.follow_up_date}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-8 space-y-5">
          {/* AI Summary */}
          {lead.notes && (
            <div className="relative overflow-hidden bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border border-blue-100/50 p-5">
              <div className="absolute top-3 right-3 w-20 h-20 bg-blue-100/30 rounded-full blur-2xl" />
              <div className="relative">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 bg-blue-500 rounded-md flex items-center justify-center">
                    <MessageSquare size={12} className="text-white" />
                  </div>
                  <h3 className="text-xs font-bold text-blue-700 uppercase tracking-wider">AI Call Summary</h3>
                </div>
                <p className="text-sm text-blue-900 leading-relaxed">{lead.notes}</p>
              </div>
            </div>
          )}

          {/* Unified Activity Section */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm shadow-slate-100/50 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity size={15} className="text-slate-400" />
                <h3 className="text-sm font-semibold text-slate-900">Activity</h3>
                {(messages.length + (lead.calls?.length || 0) + (lead.call_notes?.length || 0)) > 0 && (
                  <span className="text-[11px] text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full">
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

          {/* Intake Answers */}
          {lead.intake_answers && lead.intake_answers.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm shadow-slate-100/50 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                <FileText size={15} className="text-slate-400" />
                <h3 className="text-sm font-semibold text-slate-900">Intake Answers</h3>
                <span className="text-[11px] text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full">{lead.intake_answers.length}</span>
              </div>
              <div className="divide-y divide-slate-50">
                {lead.intake_answers.map((qa, i) => (
                  <div key={i} className="px-5 py-4">
                    <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">{qa.question}</p>
                    <p className="text-sm text-slate-800 mt-1 font-medium">{qa.answer}</p>
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
    <div className="flex items-center gap-3">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${iconColor}`}>
        <Icon size={15} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] text-slate-400 uppercase tracking-wider">{label}</p>
        <p className={`text-sm font-medium text-slate-800 capitalize ${valueClass}`}>{value}</p>
      </div>
    </div>
  );
}
