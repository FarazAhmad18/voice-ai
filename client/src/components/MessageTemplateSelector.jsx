import { useState, useRef, useEffect } from 'react';
import { FileText, X } from 'lucide-react';

const TEMPLATES = [
  {
    name: 'Appointment Confirmation',
    body: 'Hi {name}, confirming your appointment on {date} at {time}.',
  },
  {
    name: 'Initial Follow-up',
    body: 'Thank you for contacting us. We\'ll review your case and get back to you shortly.',
  },
  {
    name: 'General Follow-up',
    body: 'Just following up on our earlier conversation. Do you have any questions?',
  },
  {
    name: 'Consultation Reminder',
    body: 'Your consultation has been scheduled. Please bring any relevant documents.',
  },
  {
    name: 'Missed Call',
    body: 'We tried reaching you but couldn\'t connect. Please call us back at your convenience.',
  },
];

export default function MessageTemplateSelector({ onSelect }) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef(null);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    function handleClick(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKey(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open]);

  function handleSelect(template) {
    onSelect(template.body);
    setOpen(false);
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        title="Insert template"
        className={`p-2 rounded-lg transition-all ${
          open
            ? 'bg-slate-200 dark:bg-zinc-700 text-slate-700 dark:text-zinc-300'
            : 'text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800/50'
        }`}
      >
        <FileText size={16} />
      </button>

      {open && (
        <div className="absolute bottom-full left-0 mb-2 w-72 bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-700 shadow-lg shadow-slate-200/50 dark:shadow-black/30 z-50 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-slate-100 dark:border-zinc-800">
            <span className="text-xs font-semibold text-slate-600 dark:text-zinc-500">Quick Templates</span>
            <button
              onClick={() => setOpen(false)}
              className="text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-400 transition-colors"
            >
              <X size={14} />
            </button>
          </div>
          <div className="max-h-56 overflow-y-auto">
            {TEMPLATES.map((template, i) => (
              <button
                key={i}
                onClick={() => handleSelect(template)}
                className="w-full text-left px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-zinc-900 transition-colors border-b border-slate-50 dark:border-zinc-800/50 last:border-0"
              >
                <p className="text-xs font-medium text-slate-700 dark:text-zinc-300">{template.name}</p>
                <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-0.5 line-clamp-2">{template.body}</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
