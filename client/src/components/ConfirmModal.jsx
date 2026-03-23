import { useEffect, useRef } from 'react';
import { AlertTriangle, X } from 'lucide-react';

/**
 * Reusable confirmation modal.
 *
 * Props:
 *   open       - boolean, show/hide
 *   onConfirm  - called when user clicks the confirm button
 *   onCancel   - called when user clicks cancel or the X
 *   title      - modal heading
 *   message    - body text (string or JSX)
 *   confirmLabel - text for the confirm button (default: "Confirm")
 *   danger     - boolean, makes confirm button red (default: true)
 *   loading    - boolean, disables buttons and shows spinner on confirm
 */
export default function ConfirmModal({
  open,
  onConfirm,
  onCancel,
  title = 'Are you sure?',
  message,
  confirmLabel = 'Confirm',
  danger = true,
  loading = false,
}) {
  const cancelRef = useRef(null);

  // Focus cancel button when modal opens (safer default)
  useEffect(() => {
    if (open) setTimeout(() => cancelRef.current?.focus(), 50);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onCancel}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-5 pb-4">
          <div className="flex items-start gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
              danger ? 'bg-red-50' : 'bg-amber-50'
            }`}>
              <AlertTriangle size={18} className={danger ? 'text-red-500' : 'text-amber-500'} />
            </div>
            <div>
              <h3 className="text-[15px] font-semibold text-slate-900">{title}</h3>
              {message && (
                <p className="text-sm text-slate-500 mt-1 leading-relaxed">{message}</p>
              )}
            </div>
          </div>
          <button
            onClick={onCancel}
            className="ml-2 shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2.5 px-6 pb-5">
          <button
            ref={cancelRef}
            onClick={onCancel}
            disabled={loading}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors disabled:opacity-50 ${
              danger
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-amber-500 hover:bg-amber-600'
            }`}
          >
            {loading && (
              <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            )}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
