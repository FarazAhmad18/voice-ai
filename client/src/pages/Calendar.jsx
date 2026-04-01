import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { fetchAppointmentsFiltered, fetchStaff, updateAppointment } from '../services/api';
import { supabase } from '../services/supabase';
import { toast } from 'sonner';
import { getMonthRange, getWeekRange, getDayRange } from '../components/calendar/calendarUtils';
import CalendarToolbar from '../components/calendar/CalendarToolbar';
import CalendarMonthView from '../components/calendar/CalendarMonthView';
import CalendarWeekView from '../components/calendar/CalendarWeekView';
import CalendarDayView from '../components/calendar/CalendarDayView';
import FirmCalendarView from '../components/calendar/FirmCalendarView';
import AppointmentDetailPanel from '../components/calendar/AppointmentDetailPanel';
import StaffFilter from '../components/calendar/StaffFilter';
import { AlertCircle, CalendarDays } from 'lucide-react';

function SkeletonBlock({ className }) {
  return <div className={`skeleton-shimmer rounded-lg ${className}`} />;
}

function CalendarSkeleton() {
  return (
    <div className="space-y-4">
      <SkeletonBlock className="h-24" />
      <SkeletonBlock className="h-[500px]" />
    </div>
  );
}

export default function Calendar() {
  const { firm } = useAuth();
  const [viewMode, setViewMode] = useState('month');
  const [isFirmView, setIsFirmView] = useState(false);
  const [selectedStaffId, setSelectedStaffId] = useState(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [appointments, setAppointments] = useState([]);
  const [staff, setStaff] = useState([]);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Build staff map
  const staffMap = useMemo(() => {
    const map = {};
    staff.forEach(s => { map[s.id] = s; });
    return map;
  }, [staff]);

  // Get date range for current view
  function getDateRange() {
    if (viewMode === 'month') return getMonthRange(currentDate);
    if (viewMode === 'week') return getWeekRange(currentDate);
    return getDayRange(currentDate);
  }

  // Load staff on mount
  useEffect(() => {
    fetchStaff().then(data => {
      setStaff(Array.isArray(data) ? data : []);
    }).catch(() => {});
  }, []);

  // Load appointments when view/date/staff changes
  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const { dateFrom, dateTo } = getDateRange();
        const data = await fetchAppointmentsFiltered({
          staffId: isFirmView ? null : selectedStaffId,
          dateFrom,
          dateTo,
        });
        setAppointments(data);
      } catch (err) {
        setError(err.message || 'Failed to load appointments');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [viewMode, currentDate, selectedStaffId, isFirmView]);

  // Realtime updates
  useEffect(() => {
    const firmId = firm?.id;
    const filter = firmId ? `firm_id=eq.${firmId}` : undefined;
    const channel = supabase
      .channel('calendar-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments', filter }, () => {
        // Reload on any appointment change
        const { dateFrom, dateTo } = getDateRange();
        fetchAppointmentsFiltered({
          staffId: isFirmView ? null : selectedStaffId,
          dateFrom,
          dateTo,
        }).then(data => setAppointments(data)).catch(() => {});
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [viewMode, currentDate, selectedStaffId, isFirmView]);

  async function handleUpdateStatus(id, status) {
    try {
      await updateAppointment(id, { status });
      setAppointments(prev => prev.map(a => a.id === id ? { ...a, status } : a));
      setSelectedAppointment(prev => prev?.id === id ? { ...prev, status } : prev);
      toast.success(`Appointment ${status}`);
    } catch (err) {
      toast.error(err.message || 'Failed to update');
    }
  }

  if (loading && appointments.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <CalendarDays size={20} className="text-slate-400" />
          <h1 className="text-xl font-bold text-slate-900">Calendar</h1>
        </div>
        <CalendarSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <CalendarDays size={20} className="text-slate-400" />
        <h1 className="text-xl font-bold text-slate-900">Calendar</h1>
        <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
          {appointments.length} appointment{appointments.length !== 1 ? 's' : ''}
        </span>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-100 rounded-lg px-4 py-3 flex items-center gap-3">
          <AlertCircle size={16} className="text-red-500" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Toolbar */}
      <CalendarToolbar
        viewMode={viewMode}
        setViewMode={setViewMode}
        currentDate={currentDate}
        setCurrentDate={setCurrentDate}
        isFirmView={isFirmView}
        setIsFirmView={setIsFirmView}
      >
        {!isFirmView && (
          <StaffFilter
            staff={staff}
            selectedStaffId={selectedStaffId}
            onSelect={setSelectedStaffId}
          />
        )}
      </CalendarToolbar>

      {/* Calendar view */}
      {isFirmView ? (
        <FirmCalendarView
          currentDate={currentDate}
          viewMode={viewMode}
          appointments={appointments}
          staff={staff}
          staffMap={staffMap}
          onSelectAppointment={setSelectedAppointment}
        />
      ) : viewMode === 'month' ? (
        <CalendarMonthView
          currentDate={currentDate}
          appointments={appointments}
          staffMap={staffMap}
          onSelectAppointment={setSelectedAppointment}
        />
      ) : viewMode === 'week' ? (
        <CalendarWeekView
          currentDate={currentDate}
          appointments={appointments}
          staffMap={staffMap}
          onSelectAppointment={setSelectedAppointment}
        />
      ) : (
        <CalendarDayView
          currentDate={currentDate}
          appointments={appointments}
          staffMap={staffMap}
          onSelectAppointment={setSelectedAppointment}
        />
      )}

      {/* Detail panel */}
      {selectedAppointment && (
        <AppointmentDetailPanel
          appointment={selectedAppointment}
          staffMap={staffMap}
          onClose={() => setSelectedAppointment(null)}
          onUpdateStatus={handleUpdateStatus}
        />
      )}
    </div>
  );
}
