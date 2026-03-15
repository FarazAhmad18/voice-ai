import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { fetchLead, updateLead, addCallNote } from '../services/api';
import ScoreBadge from '../components/ScoreBadge';
import StatusBadge from '../components/StatusBadge';
import { ArrowLeft, Phone, Mail, Briefcase, AlertTriangle, CalendarCheck, Clock, Play, FileText, Send, UserCheck, StickyNote, Bell } from 'lucide-react';

const STATUS_OPTIONS = ['new', 'contacted', 'booked', 'converted', 'closed'];

export default function LeadDetail() {
  const { id } = useParams();
  const [lead, setLead] = useState(null);
  const [loading, setLoading] = useState(true);
  const [noteText, setNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [assignedAttorney, setAssignedAttorney] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');

  useEffect(() => {
    async function loadLead() {
      try {
        const data = await fetchLead(id);
        setLead(data);
        setAssignedAttorney(data.assigned_attorney || '');
        setFollowUpDate(data.follow_up_date || '');
      } catch (err) {
        console.error('Failed to fetch lead:', err);
      } finally {
        setLoading(false);
      }
    }
    loadLead();
  }, [id]);

  async function handleStatusChange(newStatus) {
    try {
      const updated = await updateLead(id, { status: newStatus });
      setLead((prev) => ({ ...prev, ...updated }));
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  }

  async function handleAssignAttorney() {
    if (!assignedAttorney.trim()) return;
    try {
      await updateLead(id, { assigned_attorney: assignedAttorney });
      setLead((prev) => ({ ...prev, assigned_attorney: assignedAttorney }));
    } catch (err) {
      console.error('Failed to assign attorney:', err);
    }
  }

  async function handleSetFollowUp() {
    if (!followUpDate) return;
    try {
      await updateLead(id, { follow_up_date: followUpDate });
      setLead((prev) => ({ ...prev, follow_up_date: followUpDate }));
    } catch (err) {
      console.error('Failed to set follow-up:', err);
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
    } catch (err) {
      console.error('Failed to add note:', err);
    } finally {
      setSavingNote(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-6 h-6 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
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

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      {/* Back */}
      <Link to="/leads" className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-600 transition-colors">
        <ArrowLeft size={15} />
        Leads
      </Link>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-base font-semibold text-white">
            {initials}
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-900 tracking-tight">{lead.caller_name}</h1>
            <p className="text-sm text-slate-400 capitalize">{lead.case_type}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ScoreBadge score={lead.score} label={lead.score_label} />
          <StatusBadge status={lead.status} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left sidebar */}
        <div className="space-y-4">
          {/* Contact */}
          <div className="bg-white rounded-2xl border border-slate-100 p-5 space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Contact</h3>
            <div className="space-y-3">
              {[
                { icon: Phone, label: 'Phone', value: lead.caller_phone, color: 'text-blue-600 bg-blue-50' },
                { icon: Mail, label: 'Email', value: lead.caller_email || 'Not provided', color: 'text-violet-600 bg-violet-50' },
                { icon: Briefcase, label: 'Case Type', value: lead.case_type, color: 'text-amber-600 bg-amber-50' },
                { icon: AlertTriangle, label: 'Urgency', value: lead.urgency, color: 'text-red-600 bg-red-50' },
                { icon: CalendarCheck, label: 'Booked', value: lead.appointment_booked ? 'Yes' : 'No', color: 'text-emerald-600 bg-emerald-50' },
                { icon: Clock, label: 'First Contact', value: new Date(lead.created_at).toLocaleDateString(), color: 'text-slate-500 bg-slate-50' },
              ].map(({ icon: Icon, label, value, color }) => (
                <div key={label} className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color}`}>
                    <Icon size={14} />
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-400">{label}</p>
                    <p className="text-sm font-medium text-slate-800 capitalize">{value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pipeline status */}
          <div className="bg-white rounded-2xl border border-slate-100 p-5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Pipeline</h3>
            <div className="flex flex-wrap gap-1.5">
              {STATUS_OPTIONS.map((status) => (
                <button
                  key={status}
                  onClick={() => handleStatusChange(status)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${
                    lead.status === status
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>

          {/* Assign Attorney */}
          <div className="bg-white rounded-2xl border border-slate-100 p-5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
              <UserCheck size={12} className="inline mr-1" />
              Assign Attorney
            </h3>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Attorney name..."
                value={assignedAttorney}
                onChange={(e) => setAssignedAttorney(e.target.value)}
                className="flex-1 px-3 py-2 text-sm bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-100 placeholder:text-slate-300"
              />
              <button
                onClick={handleAssignAttorney}
                className="px-3 py-2 bg-slate-900 text-white text-xs font-medium rounded-xl hover:bg-slate-800 transition-colors"
              >
                Assign
              </button>
            </div>
          </div>

          {/* Follow-up */}
          <div className="bg-white rounded-2xl border border-slate-100 p-5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
              <Bell size={12} className="inline mr-1" />
              Follow-up Reminder
            </h3>
            <div className="flex gap-2">
              <input
                type="date"
                value={followUpDate}
                onChange={(e) => setFollowUpDate(e.target.value)}
                className="flex-1 px-3 py-2 text-sm bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
              <button
                onClick={handleSetFollowUp}
                className="px-3 py-2 bg-slate-900 text-white text-xs font-medium rounded-xl hover:bg-slate-800 transition-colors"
              >
                Set
              </button>
            </div>
            {lead.follow_up_date && (
              <p className="text-xs text-emerald-600 mt-2">Follow-up set for {lead.follow_up_date}</p>
            )}
          </div>
        </div>

        {/* Right: Calls + Notes */}
        <div className="lg:col-span-2 space-y-4">
          {/* Call Notes */}
          <div className="bg-white rounded-2xl border border-slate-100">
            <div className="px-5 py-4 border-b border-slate-50 flex items-center gap-2">
              <StickyNote size={15} className="text-slate-400" />
              <h3 className="text-sm font-semibold text-slate-800">Call Notes</h3>
            </div>
            <div className="p-5">
              {/* Add note */}
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  placeholder="Add a note about this lead..."
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddNote()}
                  className="flex-1 px-4 py-2.5 text-sm bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-100 placeholder:text-slate-300"
                />
                <button
                  onClick={handleAddNote}
                  disabled={savingNote || !noteText.trim()}
                  className="px-4 py-2.5 bg-slate-900 text-white text-sm font-medium rounded-xl hover:bg-slate-800 transition-colors disabled:opacity-40"
                >
                  <Send size={15} />
                </button>
              </div>

              {/* Notes list */}
              {lead.call_notes && lead.call_notes.length > 0 ? (
                <div className="space-y-2">
                  {lead.call_notes.map((note, i) => (
                    <div key={i} className="px-4 py-3 bg-slate-50 rounded-xl">
                      <p className="text-sm text-slate-700">{note.text}</p>
                      <p className="text-xs text-slate-400 mt-1">{new Date(note.created_at).toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-400">No notes yet</p>
              )}

              {/* AI Notes */}
              {lead.notes && (
                <div className="mt-4 px-4 py-3 bg-blue-50 rounded-xl">
                  <p className="text-xs font-semibold text-blue-600 mb-1">AI Summary</p>
                  <p className="text-sm text-blue-800">{lead.notes}</p>
                </div>
              )}
            </div>
          </div>

          {/* Call History */}
          <div className="bg-white rounded-2xl border border-slate-100">
            <div className="px-5 py-4 border-b border-slate-50">
              <h3 className="text-sm font-semibold text-slate-800">Call History</h3>
            </div>
            {!lead.calls || lead.calls.length === 0 ? (
              <div className="py-10 text-center">
                <Phone size={20} className="text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-400">No call records</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {lead.calls.map((call) => (
                  <div key={call.id} className="p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-800">
                          {new Date(call.created_at).toLocaleString()}
                        </p>
                        <p className="text-xs text-slate-400">
                          {Math.round((call.duration || 0) / 60)} min · {call.ended_reason}
                        </p>
                      </div>
                      {call.recording_url && (
                        <audio controls className="h-8 w-48" src={call.recording_url} />
                      )}
                    </div>

                    {call.summary && (
                      <div className="px-4 py-3 bg-blue-50 rounded-xl">
                        <p className="text-xs font-semibold text-blue-600 mb-1">AI Summary</p>
                        <p className="text-sm text-blue-800 leading-relaxed">{call.summary}</p>
                      </div>
                    )}

                    {call.transcript && (
                      <details className="group">
                        <summary className="flex items-center gap-1.5 cursor-pointer text-xs font-medium text-slate-400 hover:text-slate-600">
                          <FileText size={12} />
                          View Transcript
                        </summary>
                        <div className="mt-2 p-4 bg-slate-50 rounded-xl max-h-64 overflow-y-auto">
                          <pre className="text-sm text-slate-700 whitespace-pre-wrap font-sans leading-relaxed">{call.transcript}</pre>
                        </div>
                      </details>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
