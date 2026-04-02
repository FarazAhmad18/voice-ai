import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Users } from 'lucide-react';
import { getStaffColor, getInitials } from './calendarUtils';

export default function StaffFilter({ staff, selectedStaffId, onSelect }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const selectedStaff = staff.find(s => s.id === selectedStaffId);
  const selectedColor = selectedStaffId ? getStaffColor(selectedStaffId) : null;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
          open ? 'bg-slate-100 dark:bg-zinc-800/50 border-slate-300 dark:border-zinc-600' : 'border-slate-200 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-900'
        }`}
      >
        {selectedStaff ? (
          <>
            <span className={`w-2 h-2 rounded-full ${selectedColor.dot}`} />
            <span className="text-slate-700 dark:text-zinc-300">{selectedStaff.name}</span>
          </>
        ) : (
          <>
            <Users size={14} className="text-slate-400 dark:text-zinc-500" />
            <span className="text-slate-500 dark:text-zinc-500">All Staff</span>
          </>
        )}
        <ChevronDown size={12} className={`text-slate-400 dark:text-zinc-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-1 w-56 bg-white dark:bg-zinc-900 rounded-lg border border-slate-200 dark:border-zinc-700 shadow-lg z-50 overflow-hidden">
          <button
            onClick={() => { onSelect(null); setOpen(false); }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-zinc-900 transition-colors ${
              !selectedStaffId ? 'bg-slate-50 dark:bg-zinc-900 text-slate-900 dark:text-zinc-100' : 'text-slate-600 dark:text-zinc-500'
            }`}
          >
            <Users size={14} className="text-slate-400 dark:text-zinc-500" />
            <span className="flex-1 text-left">All Staff</span>
            {!selectedStaffId && <Check size={14} className="text-violet-500" />}
          </button>
          <div className="border-t border-slate-100 dark:border-zinc-800" />
          {staff.filter(s => s.is_active).map(s => {
            const color = getStaffColor(s.id);
            const active = s.id === selectedStaffId;
            return (
              <button
                key={s.id}
                onClick={() => { onSelect(s.id); setOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-zinc-900 transition-colors ${
                  active ? 'bg-slate-50 dark:bg-zinc-900' : ''
                }`}
              >
                <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${color.dot}`} />
                <div className="flex-1 text-left min-w-0">
                  <p className="text-slate-700 dark:text-zinc-300 truncate">{s.name}</p>
                  {s.specialization && <p className="text-[10px] text-slate-400 dark:text-zinc-500 truncate">{s.specialization}</p>}
                </div>
                {active && <Check size={14} className="text-violet-500 flex-shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
