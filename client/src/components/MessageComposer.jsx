import { useState, useRef, useEffect } from 'react';
import { Send, MessageSquare, Mail, StickyNote, Loader2, X } from 'lucide-react';
import { sendMessage } from '../services/api';
import { toast } from 'sonner';
import MessageTemplateSelector from './MessageTemplateSelector';

export default function MessageComposer({ leadId, onMessageSent, defaultOpen = false }) {
  const [activeChannel, setActiveChannel] = useState(null); // null = collapsed, 'sms'|'email'|'note' = open
  const [body, setBody] = useState('');
  const [subject, setSubject] = useState('');
  const [sending, setSending] = useState(false);
  const textareaRef = useRef(null);

  useEffect(() => {
    if (defaultOpen && !activeChannel) setActiveChannel('sms');
  }, [defaultOpen]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  }, [body]);

  useEffect(() => {
    if (activeChannel) setTimeout(() => textareaRef.current?.focus(), 100);
  }, [activeChannel]);

  async function handleSend() {
    if (!body.trim()) return;
    if (activeChannel === 'email' && !subject.trim()) { toast.error('Subject required'); return; }
    setSending(true);
    try {
      const payload = { lead_id: leadId, channel: activeChannel, body: body.trim() };
      if (activeChannel === 'email') payload.subject = subject.trim();
      await sendMessage(payload);
      setBody('');
      setSubject('');
      toast.success(activeChannel === 'note' ? 'Note added' : activeChannel === 'sms' ? 'SMS sent' : 'Email sent');
      if (onMessageSent) onMessageSent();
      setActiveChannel(null);
    } catch (err) {
      toast.error(err.message || 'Failed to send');
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); handleSend(); }
    if (e.key === 'Escape') { if (!body.trim()) setActiveChannel(null); }
  }

  const config = {
    sms:   { label: 'SMS',   placeholder: 'Type an SMS message...', icon: MessageSquare, color: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900/40' },
    email: { label: 'Email', placeholder: 'Type your email...',     icon: Mail,          color: 'text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/30 border-violet-200 dark:border-violet-700 hover:bg-violet-100 dark:hover:bg-violet-900/40' },
    note:  { label: 'Note',  placeholder: 'Add an internal note...', icon: StickyNote,   color: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/40' },
  };

  // Collapsed: 3 action buttons
  if (!activeChannel) {
    return (
      <div id="message-composer" className="flex items-center gap-2 px-4 py-3">
        {Object.entries(config).map(([key, cfg]) => {
          const Icon = cfg.icon;
          return (
            <button
              key={key}
              onClick={() => setActiveChannel(key)}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium rounded-lg border transition-colors ${cfg.color}`}
            >
              <Icon size={13} />
              {key === 'sms' ? 'Send SMS' : key === 'email' ? 'Send Email' : 'Add Note'}
            </button>
          );
        })}
      </div>
    );
  }

  // Expanded: specific composer
  const cfg = config[activeChannel];
  const Icon = cfg.icon;

  return (
    <div id="message-composer" className="border-t border-slate-100 dark:border-zinc-800">
      {/* Active channel header */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-50/50 dark:bg-zinc-900/50 border-b border-slate-100 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <Icon size={13} className={activeChannel === 'sms' ? 'text-blue-500' : activeChannel === 'email' ? 'text-violet-500' : 'text-amber-500'} />
          <span className="text-xs font-semibold text-slate-700 dark:text-zinc-300">{cfg.label}</span>
        </div>
        <div className="flex items-center gap-1">
          {/* Switch to other channels */}
          {Object.entries(config).filter(([k]) => k !== activeChannel).map(([key, c]) => {
            const Ic = c.icon;
            return (
              <button key={key} onClick={() => { setActiveChannel(key); setSubject(''); }} className="p-1.5 rounded-md text-slate-300 dark:text-zinc-600 hover:text-slate-500 dark:hover:text-zinc-500 hover:bg-slate-100 dark:hover:bg-zinc-800/50 transition-colors" title={c.label}>
                <Ic size={13} />
              </button>
            );
          })}
          <button onClick={() => { if (!body.trim()) { setActiveChannel(null); setBody(''); setSubject(''); } }} className="p-1.5 rounded-md text-slate-300 dark:text-zinc-600 hover:text-slate-500 dark:hover:text-zinc-500 hover:bg-slate-100 dark:hover:bg-zinc-800/50 transition-colors">
            <X size={13} />
          </button>
        </div>
      </div>

      <div className="p-3 space-y-2">
        {activeChannel === 'email' && (
          <input
            type="text" placeholder="Subject" value={subject}
            onChange={(e) => setSubject(e.target.value)} onKeyDown={handleKeyDown} disabled={sending}
            className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500/20 placeholder:text-slate-300 dark:placeholder:text-zinc-600 disabled:opacity-50"
          />
        )}
        <div className="flex gap-2 items-end">
          <MessageTemplateSelector onSelect={(text) => setBody(text)} />
          <textarea
            ref={textareaRef} rows={1} placeholder={cfg.placeholder}
            value={body} onChange={(e) => setBody(e.target.value)} onKeyDown={handleKeyDown} disabled={sending}
            className="flex-1 px-3 py-2 text-sm bg-slate-50 dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500/20 placeholder:text-slate-300 dark:placeholder:text-zinc-600 resize-none min-h-[36px] disabled:opacity-50"
          />
          <button
            onClick={handleSend} disabled={sending || !body.trim()}
            className="px-3 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-all disabled:opacity-30 flex-shrink-0"
          >
            {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          </button>
        </div>
      </div>
    </div>
  );
}
