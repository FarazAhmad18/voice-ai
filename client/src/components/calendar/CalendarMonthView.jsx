import { getMonthGrid, isToday, getStaffColor, getInitials, groupByDate } from './calendarUtils';
import StatusBadge from '../StatusBadge';
import { Link } from 'react-router-dom';
import { X, Clock, ChevronRight } from 'lucide-react';
import { useState } from 'react';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function CalendarMonthView({ currentDate, appointments, staffMap, onSelectAppointment }) {
  const [selectedDate, setSelectedDate] = useState(null);
  const cells = getMonthGrid(currentDate);
  const grouped = groupByDate(appointments);

  const selectedApts = selectedDate ? (grouped[selectedDate] || []) : [];

  return (
    <div className="flex gap-4">
      {/* Calendar grid */}
      <div className="flex-1 bg-white rounded-lg border border-slate-200 overflow-hidden">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 border-b border-slate-100">
          {WEEKDAYS.map(d => (
            <div key={d} className="px-2 py-2.5 text-center text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              {d}
            </div>
          ))}
        </div>

        {/* Date grid */}
        <div className="grid grid-cols-7">
          {cells.map((cell, idx) => {
            const dayApts = grouped[cell.dateStr] || [];
            const today = isToday(cell.dateStr);
            const isSelected = selectedDate === cell.dateStr;

            return (
              <button
                key={idx}
                onClick={() => setSelectedDate(isSelected ? null : cell.dateStr)}
                className={`min-h-[80px] p-1.5 border-b border-r border-slate-50 text-left transition-colors relative ${
                  !cell.isCurrentMonth ? 'bg-slate-50/50' : 'bg-white hover:bg-slate-50/50'
                } ${isSelected ? 'ring-2 ring-inset ring-violet-500/30 bg-violet-50/30' : ''}`}
              >
                <span className={`inline-flex items-center justify-center w-6 h-6 text-xs font-medium rounded-full ${
                  today ? 'bg-slate-900 text-white' : cell.isCurrentMonth ? 'text-slate-700' : 'text-slate-300'
                }`}>
                  {cell.date.getDate()}
                </span>

                {/* Appointment indicators */}
                {dayApts.length > 0 && (
                  <div className="mt-0.5 space-y-0.5">
                    {dayApts.slice(0, 3).map(apt => {
                      const color = getStaffColor(apt.assigned_staff_id);
                      return (
                        <div key={apt.id} className={`text-[9px] font-medium px-1 py-0.5 rounded truncate ${color.bg} ${color.text}`}>
                          {apt.appointment_time}
                        </div>
                      );
                    })}
                    {dayApts.length > 3 && (
                      <p className="text-[9px] text-slate-400 px-1">+{dayApts.length - 3} more</p>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Side panel — selected day */}
      {selectedDate && (
        <div className="w-72 bg-white rounded-lg border border-slate-200 flex flex-col max-h-[600px] flex-shrink-0">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-900">
                {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">{selectedApts.length} appointment{selectedApts.length !== 1 ? 's' : ''}</p>
            </div>
            <button onClick={() => setSelectedDate(null)} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400">
              <X size={14} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {selectedApts.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">No appointments</p>
            ) : (
              selectedApts.map(apt => {
                const color = getStaffColor(apt.assigned_staff_id);
                const staff = staffMap?.[apt.assigned_staff_id];
                return (
                  <button
                    key={apt.id}
                    onClick={() => onSelectAppointment(apt)}
                    className={`w-full text-left p-3 rounded-lg border-l-[3px] ${color.border} bg-slate-50/50 hover:bg-slate-50 transition-colors`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-700">{apt.appointment_time}</span>
                      <StatusBadge status={apt.status} />
                    </div>
                    <p className="text-sm font-medium text-slate-900 mt-1 truncate">{apt.caller_name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {staff && (
                        <span className="flex items-center gap-1 text-[10px] text-slate-400">
                          <span className={`w-1.5 h-1.5 rounded-full ${color.dot}`} />
                          {staff.name}
                        </span>
                      )}
                      {apt.case_type && (
                        <span className="text-[10px] text-slate-400 capitalize">{apt.case_type}</span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
