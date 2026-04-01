import { Phone, MessageSquare, Mail, StickyNote, Mic, ChevronDown, ChevronUp, PhoneIncoming, PhoneOutgoing } from 'lucide-react';
import { useState } from 'react';

function formatFullDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
}

function formatTime(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function formatDuration(seconds) {
  if (!seconds) return '0s';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m === 0 ? `${s}s` : `${m}m ${s}s`;
}

// ── Entry type configs ──
const TYPE_CONFIG = {
  call_inbound:  { label: 'Inbound Call',         color: 'text-red-600',    bg: 'bg-red-50',    border: 'border-l-red-400',    icon: PhoneIncoming },
  call_outbound: { label: 'Outbound Call',        color: 'text-blue-600',   bg: 'bg-blue-50',   border: 'border-l-blue-400',   icon: PhoneOutgoing },
  sms_inbound:   { label: 'Inbound Text Message', color: 'text-red-600',    bg: 'bg-red-50',    border: 'border-l-red-400',    icon: MessageSquare },
  sms_outbound:  { label: 'Outbound Text Message', color: 'text-blue-600',  bg: 'bg-blue-50',   border: 'border-l-blue-400',   icon: MessageSquare },
  email_inbound: { label: 'Inbound Email',        color: 'text-red-600',    bg: 'bg-red-50',    border: 'border-l-red-400',    icon: Mail },
  email_outbound:{ label: 'Email Reply',          color: 'text-blue-600',   bg: 'bg-blue-50',   border: 'border-l-blue-400',   icon: Mail },
  note:          { label: 'Note',                  color: 'text-amber-600',  bg: 'bg-amber-50',  border: 'border-l-amber-400',  icon: StickyNote },
  legacy_note:   { label: 'Note',                  color: 'text-amber-600',  bg: 'bg-amber-50',  border: 'border-l-amber-400',  icon: StickyNote },
};

function getEntryConfig(item) {
  if (item.type === 'call') {
    const dir = item.data.direction === 'outbound' ? 'outbound' : 'inbound';
    return TYPE_CONFIG[`call_${dir}`];
  }
  const ch = item.data.channel || 'sms';
  if (ch === 'note' || ch === 'legacy_note') return TYPE_CONFIG.note;
  const dir = item.data.direction === 'inbound' ? 'inbound' : 'outbound';
  return TYPE_CONFIG[`${ch}_${dir}`] || TYPE_CONFIG.sms_outbound;
}

function CallEntry({ call }) {
  const [showTranscript, setShowTranscript] = useState(false);

  return (
    <div className="space-y-2">
      {/* Call meta */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">{formatDuration(call.duration)}</span>
        {call.sentiment && (
          <span className={`text-xs font-medium px-2 py-0.5 rounded capitalize ${
            call.sentiment === 'positive' ? 'bg-emerald-50 text-emerald-600' :
            call.sentiment === 'negative' || call.sentiment === 'distressed' ? 'bg-red-50 text-red-600' :
            'bg-slate-50 text-slate-500'
          }`}>{call.sentiment}</span>
        )}
        <span className="text-xs text-slate-400 capitalize">{call.ended_reason?.replace(/_/g, ' ')}</span>
      </div>

      {/* Summary */}
      {call.summary && <p className="text-sm text-slate-700 leading-relaxed">{call.summary}</p>}

      {/* Audio — always visible */}
      {call.recording_url && (
        <audio controls className="w-full" src={call.recording_url} style={{ height: 36, borderRadius: 8 }} />
      )}

      {/* Transcript toggle */}
      {call.transcript && (
        <>
          <button
            onClick={() => setShowTranscript(!showTranscript)}
            className="text-[11px] font-medium text-slate-400 hover:text-slate-600 transition-colors flex items-center gap-1"
          >
            {showTranscript ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            {showTranscript ? 'Hide' : 'Show'} Transcript
          </button>
          {showTranscript && (
            <div className="bg-slate-50 rounded-lg p-3 max-h-64 overflow-y-auto">
              <pre className="text-sm text-slate-600 whitespace-pre-wrap font-sans leading-relaxed">{call.transcript}</pre>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function MessageTimeline({ messages = [], calls = [], legacyNotes = [] }) {
  // Build unified timeline
  const items = [];
  messages.forEach(msg => items.push({ type: 'message', data: msg, created_at: msg.created_at }));
  calls.forEach(call => items.push({ type: 'call', data: call, created_at: call.created_at }));
  legacyNotes.forEach(note => items.push({
    type: 'message',
    data: { id: `legacy_${note.created_at}`, direction: 'outbound', channel: 'legacy_note', sender: note.author || 'Staff', body: note.text, created_at: note.created_at },
    created_at: note.created_at,
  }));

  // Sort by time — newest first
  items.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  if (items.length === 0) {
    return (
      <div className="text-center py-10">
        <MessageSquare size={20} className="text-slate-300 mx-auto mb-2" />
        <p className="text-sm text-slate-400">No activity yet</p>
        <p className="text-[11px] text-slate-300 mt-1">Calls, messages, and notes will appear here</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-slate-100">
      {items.map(item => {
        const config = getEntryConfig(item);
        const Icon = config.icon;
        const dateStr = item.created_at;

        return (
          <div key={`${item.type}_${item.data.id}`} className={`flex gap-4 py-3 border-l-4 ${config.border} pl-4`}>
            {/* Timestamp — left column */}
            <div className="flex-shrink-0 w-[70px] pt-0.5">
              <p className="text-[11px] font-medium text-slate-500">{formatFullDate(dateStr)}</p>
              <p className="text-[11px] text-slate-400">{formatTime(dateStr)}</p>
            </div>

            {/* Icon */}
            <div className="flex-shrink-0 pt-0.5">
              <Icon size={16} className={config.color} />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              {/* Entry header */}
              <p className={`text-sm font-semibold ${config.color}`}>
                {config.label}
                {item.type === 'call' && <span className="text-slate-400 font-normal"> ({formatDuration(item.data.duration)})</span>}
              </p>

              {/* Sender/receiver info */}
              {item.data.sender && (
                <p className="text-xs text-slate-400 mt-0.5">
                  {item.data.direction === 'inbound' ? 'From' : 'By'}: {item.data.sender}
                  {item.data.channel === 'sms' && item.data.direction === 'outbound' && item.data.caller_phone && (
                    <span> · Sent to: {item.data.caller_phone}</span>
                  )}
                </p>
              )}

              {/* Subject for emails */}
              {item.data.subject && (
                <p className="text-xs font-semibold text-slate-700 mt-1">Subject: {item.data.subject}</p>
              )}

              {/* Body / Content */}
              {item.type === 'call' ? (
                <div className="mt-2">
                  <CallEntry call={item.data} />
                </div>
              ) : (
                <p className="text-sm text-slate-700 leading-relaxed mt-1">{item.data.body}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
