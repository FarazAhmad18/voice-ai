import { Phone, MessageSquare, Mail, StickyNote, Mic, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatDuration(seconds) {
  if (!seconds) return '0s';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${s}s`;
}

function relativeTime(dateStr) {
  if (!dateStr) return '';
  const now = new Date();
  const d = new Date(dateStr);
  const diffMs = now - d;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return formatDate(dateStr);
}

const CHANNEL_CONFIG = {
  sms: {
    icon: MessageSquare,
    label: 'SMS',
    badgeBg: 'bg-blue-50',
    badgeText: 'text-blue-600',
    iconBg: 'bg-blue-50',
    iconColor: 'text-blue-500',
  },
  email: {
    icon: Mail,
    label: 'Email',
    badgeBg: 'bg-violet-50',
    badgeText: 'text-violet-600',
    iconBg: 'bg-violet-50',
    iconColor: 'text-violet-500',
  },
  note: {
    icon: StickyNote,
    label: 'Note',
    badgeBg: 'bg-amber-50',
    badgeText: 'text-amber-600',
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-500',
  },
  call: {
    icon: Phone,
    label: 'Call',
    badgeBg: 'bg-emerald-50',
    badgeText: 'text-emerald-600',
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-500',
  },
  legacy_note: {
    icon: StickyNote,
    label: 'Note',
    badgeBg: 'bg-amber-50',
    badgeText: 'text-amber-600',
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-500',
  },
};

function CallCard({ call }) {
  const [expanded, setExpanded] = useState(false);
  const config = CHANNEL_CONFIG.call;

  return (
    <div className="w-full">
      <div
        className="flex items-center gap-3 p-4 bg-white rounded-xl border border-slate-100 shadow-sm cursor-pointer hover:bg-slate-50/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${config.iconBg}`}>
          <Mic size={16} className={config.iconColor} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-slate-900">Phone Call</p>
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md ${config.badgeBg} ${config.badgeText}`}>
              {formatDuration(call.duration)}
            </span>
            {call.sentiment && (
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md capitalize ${
                call.sentiment === 'positive' ? 'bg-emerald-50 text-emerald-600' :
                call.sentiment === 'negative' || call.sentiment === 'distressed' ? 'bg-red-50 text-red-600' :
                'bg-slate-50 text-slate-500'
              }`}>
                {call.sentiment}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-slate-400 capitalize">{call.ended_reason?.replace(/_/g, ' ')}</span>
            <span className="text-xs text-slate-300">·</span>
            <span className="text-xs text-slate-400">{relativeTime(call.created_at)}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {call.recording_url && (
            <span className="text-[10px] font-medium text-blue-500 bg-blue-50 px-2 py-1 rounded-md">Recording</span>
          )}
          {expanded ? <ChevronUp size={16} className="text-slate-300" /> : <ChevronDown size={16} className="text-slate-300" />}
        </div>
      </div>

      {expanded && (
        <div className="mt-2 space-y-3 pl-2">
          {call.summary && (
            <div className="bg-blue-50 rounded-xl px-4 py-3">
              <p className="text-[11px] font-bold text-blue-600 uppercase tracking-wider mb-1">AI Summary</p>
              <p className="text-sm text-blue-900 leading-relaxed">{call.summary}</p>
            </div>
          )}

          {call.recording_url && (
            <div className="bg-slate-50 rounded-xl px-4 py-3">
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Recording</p>
              <audio controls className="w-full h-10" src={call.recording_url} />
            </div>
          )}

          {call.transcript && (
            <div className="bg-slate-50 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100">
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Transcript</p>
              </div>
              <div className="px-4 py-3 max-h-72 overflow-y-auto">
                <pre className="text-sm text-slate-700 whitespace-pre-wrap font-sans leading-relaxed">{call.transcript}</pre>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MessageBubble({ message }) {
  const isOutbound = message.direction === 'outbound';
  const isNote = message.channel === 'note' || message.channel === 'legacy_note';
  const config = CHANNEL_CONFIG[message.channel] || CHANNEL_CONFIG.sms;
  const Icon = config.icon;

  if (isNote) {
    return (
      <div className="w-full">
        <div className="bg-amber-50/70 border border-amber-100/50 rounded-xl px-4 py-3">
          <div className="flex items-center gap-2 mb-1.5">
            <StickyNote size={12} className="text-amber-500" />
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md ${config.badgeBg} ${config.badgeText}`}>
              {config.label}
            </span>
            {message.sender && (
              <span className="text-[11px] font-medium text-amber-600">{message.sender}</span>
            )}
            <span className="text-[11px] text-amber-400 ml-auto">{relativeTime(message.created_at)}</span>
          </div>
          <p className="text-sm text-amber-900 leading-relaxed">{message.body}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[80%] ${isOutbound ? 'order-1' : 'order-1'}`}>
        <div className={`rounded-xl px-4 py-3 ${
          isOutbound
            ? 'bg-slate-800 text-white'
            : 'bg-white border border-slate-100 shadow-sm'
        }`}>
          <div className="flex items-center gap-2 mb-1">
            <Icon size={11} className={isOutbound ? 'text-slate-400' : config.iconColor} />
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md ${
              isOutbound ? 'bg-slate-700 text-slate-300' : `${config.badgeBg} ${config.badgeText}`
            }`}>
              {config.label}
            </span>
            {message.sender && (
              <span className={`text-[11px] font-medium ${isOutbound ? 'text-slate-400' : 'text-slate-500'}`}>
                {message.sender}
              </span>
            )}
          </div>
          {message.subject && (
            <p className={`text-xs font-semibold mb-1 ${isOutbound ? 'text-slate-300' : 'text-slate-700'}`}>
              {message.subject}
            </p>
          )}
          <p className={`text-sm leading-relaxed ${isOutbound ? 'text-slate-100' : 'text-slate-700'}`}>
            {message.body}
          </p>
        </div>
        <div className={`flex items-center gap-2 mt-1 px-1 ${isOutbound ? 'justify-end' : 'justify-start'}`}>
          <span className="text-[11px] text-slate-400">{relativeTime(message.created_at)}</span>
          {message.status && message.status !== 'sent' && message.status !== 'received' && (
            <>
              <span className="text-[11px] text-slate-300">·</span>
              <span className={`text-[11px] capitalize ${
                message.status === 'delivered' ? 'text-emerald-500' :
                message.status === 'failed' ? 'text-red-500' :
                'text-slate-400'
              }`}>
                {message.status}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function MessageTimeline({ messages = [], calls = [], legacyNotes = [] }) {
  // Merge all items into a single timeline
  const items = [];

  messages.forEach((msg) => {
    items.push({
      type: 'message',
      data: msg,
      created_at: msg.created_at,
    });
  });

  calls.forEach((call) => {
    items.push({
      type: 'call',
      data: call,
      created_at: call.created_at,
    });
  });

  legacyNotes.forEach((note) => {
    items.push({
      type: 'message',
      data: {
        id: `legacy_${note.created_at}`,
        direction: 'outbound',
        channel: 'legacy_note',
        sender: note.author || 'Staff',
        body: note.text,
        created_at: note.created_at,
      },
      created_at: note.created_at,
    });
  });

  // Sort newest first
  items.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  if (items.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
          <MessageSquare size={20} className="text-slate-300" />
        </div>
        <p className="text-sm font-medium text-slate-500">No activity yet</p>
        <p className="text-xs text-slate-400 mt-1">Messages, calls, and notes will appear here</p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Timeline line */}
      <div className="absolute left-[19px] top-4 bottom-4 w-px bg-slate-100" />

      <div className="space-y-4">
        {items.map((item) => (
          <div key={`${item.type}_${item.data.id}`} className="flex gap-3 relative">
            {/* Timeline dot */}
            <div className="flex-shrink-0 z-10 mt-1">
              <div className={`w-[38px] h-[38px] rounded-xl flex items-center justify-center ${
                item.type === 'call'
                  ? CHANNEL_CONFIG.call.iconBg
                  : (CHANNEL_CONFIG[item.data.channel] || CHANNEL_CONFIG.sms).iconBg
              }`}>
                {item.type === 'call' ? (
                  <Phone size={14} className={CHANNEL_CONFIG.call.iconColor} />
                ) : (
                  (() => {
                    const cfg = CHANNEL_CONFIG[item.data.channel] || CHANNEL_CONFIG.sms;
                    const Ic = cfg.icon;
                    return <Ic size={14} className={cfg.iconColor} />;
                  })()
                )}
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 pb-1">
              {item.type === 'call' ? (
                <CallCard call={item.data} />
              ) : (
                <MessageBubble message={item.data} />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
