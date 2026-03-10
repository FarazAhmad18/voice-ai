import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { fetchLead, updateLead } from '../services/api';
import ScoreBadge from '../components/ScoreBadge';
import StatusBadge from '../components/StatusBadge';
import { ArrowLeft, Phone, Mail, Briefcase, AlertTriangle, CalendarCheck, Clock, Play, FileText, Bot, User } from 'lucide-react';

const STATUS_OPTIONS = ['new', 'contacted', 'booked', 'converted', 'closed'];

export default function LeadDetail() {
  const { id } = useParams();
  const [lead, setLead] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadLead() {
      try {
        const data = await fetchLead(id);
        setLead(data);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-sm text-slate-400">Loading lead details...</p>
        </div>
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="text-center p-12">
        <p className="text-base font-semibold text-slate-700">Lead not found</p>
        <Link to="/leads" className="text-sm text-blue-600 hover:text-blue-700 mt-2 inline-block">Back to Leads</Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Back Button */}
      <Link to="/leads" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors mb-5">
        <ArrowLeft size={15} />
        Back to Leads
      </Link>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center text-lg font-bold text-white shadow-lg shadow-blue-500/20">
            {lead.caller_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{lead.caller_name}</h1>
            <p className="text-sm text-slate-400 capitalize">{lead.case_type} case</p>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <ScoreBadge score={lead.score} label={lead.score_label} />
          <StatusBadge status={lead.status} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="space-y-5">
          {/* Contact Info */}
          <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-5">
            <h3 className="text-[13px] font-bold uppercase tracking-wider text-slate-400 mb-4">Contact Information</h3>
            <div className="space-y-3.5">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
                  <Phone size={14} className="text-blue-600" />
                </div>
                <div>
                  <p className="text-[11px] text-slate-400">Phone</p>
                  <p className="text-sm font-semibold text-slate-900">{lead.caller_phone || 'N/A'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-violet-50 rounded-lg flex items-center justify-center">
                  <Mail size={14} className="text-violet-600" />
                </div>
                <div>
                  <p className="text-[11px] text-slate-400">Email</p>
                  <p className="text-sm font-semibold text-slate-900">{lead.caller_email || 'N/A'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center">
                  <Briefcase size={14} className="text-amber-600" />
                </div>
                <div>
                  <p className="text-[11px] text-slate-400">Case Type</p>
                  <p className="text-sm font-semibold text-slate-900 capitalize">{lead.case_type}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-rose-50 rounded-lg flex items-center justify-center">
                  <AlertTriangle size={14} className="text-rose-600" />
                </div>
                <div>
                  <p className="text-[11px] text-slate-400">Urgency</p>
                  <p className="text-sm font-semibold text-slate-900 capitalize">{lead.urgency}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center">
                  <CalendarCheck size={14} className="text-emerald-600" />
                </div>
                <div>
                  <p className="text-[11px] text-slate-400">Consultation Booked</p>
                  <p className="text-sm font-semibold text-slate-900">{lead.appointment_booked ? 'Yes' : 'No'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center">
                  <Clock size={14} className="text-slate-500" />
                </div>
                <div>
                  <p className="text-[11px] text-slate-400">First Contact</p>
                  <p className="text-sm font-semibold text-slate-900">{new Date(lead.created_at).toLocaleString()}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Status Update */}
          <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-5">
            <h3 className="text-[13px] font-bold uppercase tracking-wider text-slate-400 mb-4">Update Status</h3>
            <div className="flex flex-wrap gap-2">
              {STATUS_OPTIONS.map((status) => (
                <button
                  key={status}
                  onClick={() => handleStatusChange(status)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all duration-200 ${
                    lead.status === status
                      ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/25'
                      : 'bg-slate-50 text-slate-500 border border-slate-200 hover:border-blue-300 hover:text-blue-600'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>

          {/* AI Notes */}
          {lead.notes && (
            <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-3">
                <Bot size={14} className="text-blue-600" />
                <h3 className="text-[13px] font-bold uppercase tracking-wider text-slate-400">AI Notes</h3>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">{lead.notes}</p>
            </div>
          )}
        </div>

        {/* Right Column: Call History */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm">
            <div className="px-5 py-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-900 text-[15px]">Call History</h3>
              <p className="text-xs text-slate-400 mt-0.5">All recorded conversations with this client</p>
            </div>
            {!lead.calls || lead.calls.length === 0 ? (
              <div className="p-8 text-center">
                <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                  <Phone size={20} className="text-slate-400" />
                </div>
                <p className="text-sm font-medium text-slate-500">No call records found</p>
                <p className="text-xs text-slate-400 mt-1">Call transcripts and recordings will appear here.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {lead.calls.map((call) => (
                  <div key={call.id} className="p-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center">
                          <Phone size={15} className="text-blue-600" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            {new Date(call.created_at).toLocaleString()}
                          </p>
                          <p className="text-xs text-slate-400">
                            Duration: {Math.round((call.duration || 0) / 60)} min · {call.ended_reason}
                          </p>
                        </div>
                      </div>
                      {call.recording_url && (
                        <div className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2">
                          <Play size={12} className="text-blue-600" />
                          <audio controls className="h-7 w-48" src={call.recording_url}>
                            Your browser does not support audio.
                          </audio>
                        </div>
                      )}
                    </div>

                    {call.summary && (
                      <div className="mb-4 p-3.5 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <Bot size={12} className="text-blue-600" />
                          <p className="text-[11px] font-bold uppercase tracking-wider text-blue-600">AI Summary</p>
                        </div>
                        <p className="text-sm text-blue-900 leading-relaxed">{call.summary}</p>
                      </div>
                    )}

                    {call.transcript && (
                      <div className="p-3.5 bg-slate-50 rounded-xl max-h-80 overflow-y-auto border border-slate-100">
                        <div className="flex items-center gap-1.5 mb-2">
                          <FileText size={12} className="text-slate-500" />
                          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Transcript</p>
                        </div>
                        <pre className="text-sm text-slate-700 whitespace-pre-wrap font-sans leading-relaxed">{call.transcript}</pre>
                      </div>
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
