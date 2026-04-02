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

function CalendarSkeleton() {
  return (
    <div className="space-y-4">
      <div className="skeleton-shimmer rounded-lg h-[72px]" />
      <div className="skeleton-shimmer rounded-lg h-[520px]" />
    </div>
  );
}

export default function Calendar() {
  const { firm } = useAuth();
  const [viewMode, setViewMode] = useState('week');
  const [isFirmView, setIsFirmView] = useState(false);
  const [selectedStaffId, setSelectedStaffId] = useState(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [allAppointments, setAllAppointments] = useState([]);
  const [staff, setStaff] = useState([]);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const staffMap = useMemo(() => {
    const map = {};
    staff.forEach(s => { map[s.id] = s; });
    return map;
  }, [staff]);

  // Client-side filter by staff (safety net on top of server filter)
  const appointments = useMemo(() => {
    if (!selectedStaffId || isFirmView) return allAppointments;
    return allAppointments.filter(a => a.assigned_staff_id === selectedStaffId);
  }, [allAppointments, selectedStaffId, isFirmView]);

  function getDateRange() {
    if (viewMode === 'month') return getMonthRange(currentDate);
    if (viewMode === 'week') return getWeekRange(currentDate);
    return getDayRange(currentDate);
  }

  useEffect(() => {
    fetchStaff().then(data => setStaff(Array.isArray(data) ? data : [])).catch(() => {});
  }, []);

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
        setAllAppointments(data);
      } catch (err) {
        setError(err.message || 'Failed to load appointments');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [viewMode, currentDate, selectedStaffId, isFirmView]);

  useEffect(() => {
    const firmId = firm?.id;
    const filter = firmId ? `firm_id=eq.${firmId}` : undefined;
    const channel = supabase
      .channel('calendar-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments', filter }, () => {
        const { dateFrom, dateTo } = getDateRange();
        fetchAppointmentsFiltered({
          staffId: isFirmView ? null : selectedStaffId,
          dateFrom, dateTo,
        }).then(data => setAllAppointments(data)).catch(() => {});
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [viewMode, currentDate, selectedStaffId, isFirmView]);

  async function handleUpdateStatus(id, status) {
    try {
      await updateAppointment(id, { status });
      setAllAppointments(prev => prev.map(a => a.id === id ? { ...a, status } : a));
      setSelectedAppointment(prev => prev?.id === id ? { ...prev, status } : prev);
      toast.success(`Appointment ${status}`);
    } catch (err) {
      toast.error(err.message || 'Failed to update');
    }
  }

  if (loading && allAppointments.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-lg font-bold text-slate-900 dark:text-zinc-100">Calendar</h1>
        <CalendarSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-100 dark:border-red-800 rounded-lg px-4 py-3 flex items-center gap-3">
          <AlertCircle size={16} className="text-red-500" />
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      <CalendarToolbar
        viewMode={viewMode}
        setViewMode={setViewMode}
        currentDate={currentDate}
        setCurrentDate={setCurrentDate}
        isFirmView={isFirmView}
        setIsFirmView={setIsFirmView}
        appointmentCount={appointments.length}
      >
        {!isFirmView && (
          <StaffFilter staff={staff} selectedStaffId={selectedStaffId} onSelect={setSelectedStaffId} />
        )}
      </CalendarToolbar>

      {isFirmView ? (
        <FirmCalendarView
          currentDate={currentDate}
          viewMode={viewMode}
          appointments={allAppointments}
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
