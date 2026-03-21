import { useState, useRef, useEffect } from 'react';
import { Send, MessageSquare, Mail, StickyNote, Loader2 } from 'lucide-react';
import { sendMessage } from '../services/api';
import { toast } from 'sonner';
import MessageTemplateSelector from './MessageTemplateSelector';

const CHANNELS = [
  { key: 'sms', label: 'SMS', icon: MessageSquare },
  { key: 'email', label: 'Email', icon: Mail },
  { key: 'note', label: 'Note', icon: StickyNote },
];

export default function MessageComposer({ leadId, onMessageSent }) {
  const [channel, setChannel] = useState('sms');
  const [body, setBody] = useState('');
  const [subject, setSubject] = useState('');
  const [sending, setSending] = useState(false);
  const textareaRef = useRef(null);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 160) + 'px';
  }, [body]);

  async function handleSend() {
    if (!body.trim()) return;
    if (channel === 'email' && !subject.trim()) {
      toast.error('Subject is required for email');
      return;
    }

    setSending(true);
    try {
      const payload = {
        lead_id: leadId,
        channel,
        body: body.trim(),
      };
      if (channel === 'email') {
        payload.subject = subject.trim();
      }

      await sendMessage(payload);
      setBody('');
      setSubject('');
      toast.success(
        channel === 'note' ? 'Note added' :
        channel === 'sms' ? 'SMS sent' :
        'Email sent'
      );
      if (onMessageSent) onMessageSent();
    } catch (err) {
      toast.error(err.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSend();
    }
  }

  const placeholders = {
    sms: 'Type an SMS message...',
    email: 'Type your email body...',
    note: 'Add an internal note...',
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm shadow-slate-100/50 overflow-hidden">
      {/* Channel Tabs */}
      <div className="flex border-b border-slate-100">
        {CHANNELS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setChannel(key)}
            disabled={sending}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-all disabled:opacity-50 ${
              channel === key
                ? 'text-slate-900 border-b-2 border-slate-900 bg-slate-50/50'
                : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50/30'
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      <div className="p-4 space-y-3">
        {/* Subject line for email */}
        {channel === 'email' && (
          <input
            type="text"
            placeholder="Subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={sending}
            className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-200 placeholder:text-slate-300 transition-all disabled:opacity-50"
          />
        )}

        {/* Message body */}
        <div className="flex gap-2 items-end">
          <MessageTemplateSelector onSelect={(text) => setBody(text)} />
          <textarea
            ref={textareaRef}
            rows={1}
            placeholder={placeholders[channel]}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={sending}
            className="flex-1 px-4 py-3 text-sm bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-200 placeholder:text-slate-300 transition-all resize-none min-h-[44px] disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={sending || !body.trim()}
            className="px-4 py-3 bg-slate-900 text-white text-sm font-medium rounded-xl hover:bg-slate-800 transition-all disabled:opacity-30 shadow-sm shadow-slate-900/20 flex items-center gap-2 flex-shrink-0"
          >
            {sending ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Send size={15} />
            )}
          </button>
        </div>

        {/* Hint */}
        <p className="text-[11px] text-slate-400 px-1">
          Press <kbd className="px-1 py-0.5 bg-slate-100 rounded text-[10px] font-mono">Ctrl+Enter</kbd> to send
        </p>
      </div>
    </div>
  );
}
