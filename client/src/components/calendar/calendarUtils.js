// ── Staff Color System ──────────────────────────────────
const STAFF_COLORS = [
  { bg: 'bg-violet-100', text: 'text-violet-700', border: 'border-violet-400', dot: 'bg-violet-500', light: 'bg-violet-50', hex: '#8b5cf6' },
  { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-400', dot: 'bg-blue-500', light: 'bg-blue-50', hex: '#3b82f6' },
  { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-400', dot: 'bg-emerald-500', light: 'bg-emerald-50', hex: '#10b981' },
  { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-400', dot: 'bg-amber-500', light: 'bg-amber-50', hex: '#f59e0b' },
  { bg: 'bg-rose-100', text: 'text-rose-700', border: 'border-rose-400', dot: 'bg-rose-500', light: 'bg-rose-50', hex: '#f43f5e' },
  { bg: 'bg-cyan-100', text: 'text-cyan-700', border: 'border-cyan-400', dot: 'bg-cyan-500', light: 'bg-cyan-50', hex: '#06b6d4' },
  { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-400', dot: 'bg-orange-500', light: 'bg-orange-50', hex: '#f97316' },
  { bg: 'bg-pink-100', text: 'text-pink-700', border: 'border-pink-400', dot: 'bg-pink-500', light: 'bg-pink-50', hex: '#ec4899' },
];

const UNASSIGNED_COLOR = { bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-300', dot: 'bg-slate-400', light: 'bg-slate-50', hex: '#94a3b8' };

export function getStaffColor(staffId) {
  if (!staffId) return UNASSIGNED_COLOR;
  let hash = 0;
  for (let i = 0; i < staffId.length; i++) {
    hash = staffId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return STAFF_COLORS[Math.abs(hash) % STAFF_COLORS.length];
}

export function buildStaffColorMap(staffList) {
  const map = {};
  staffList.forEach(s => { map[s.id] = getStaffColor(s.id); });
  return map;
}

// ── Time Parsing ────────────────────────────────────────

export function timeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const match = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return 0;
  let hours = parseInt(match[1]);
  const minutes = parseInt(match[2]);
  const period = match[3].toUpperCase();
  if (period === 'PM' && hours !== 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;
  return hours * 60 + minutes;
}

export function formatTime(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const period = h >= 12 ? 'PM' : 'AM';
  const hour = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${hour}:${String(m).padStart(2, '0')} ${period}`;
}

// Business hours: 9 AM to 5 PM
export const START_HOUR = 9;
export const END_HOUR = 17;
export const SLOT_DURATION = 30; // minutes
export const PIXELS_PER_MINUTE = 1.5;

export function getBlockStyle(timeStr) {
  const mins = timeToMinutes(timeStr);
  const startMins = START_HOUR * 60;
  const top = (mins - startMins) * PIXELS_PER_MINUTE;
  const height = SLOT_DURATION * PIXELS_PER_MINUTE;
  return { top: Math.max(0, top), height };
}

export function getTimeSlots() {
  const slots = [];
  for (let h = START_HOUR; h < END_HOUR; h++) {
    for (let m = 0; m < 60; m += SLOT_DURATION) {
      slots.push(formatTime(h * 60 + m));
    }
  }
  return slots;
}

export function getGridHeight() {
  return (END_HOUR - START_HOUR) * 60 * PIXELS_PER_MINUTE;
}

// ── Date Helpers ────────────────────────────────────────

export function toDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function isToday(dateStr) {
  return dateStr === toDateStr(new Date());
}

export function getMonthRange(date) {
  const y = date.getFullYear();
  const m = date.getMonth();
  const from = new Date(y, m, 1);
  const to = new Date(y, m + 1, 0);
  return { dateFrom: toDateStr(from), dateTo: toDateStr(to) };
}

export function getWeekRange(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday start
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { dateFrom: toDateStr(monday), dateTo: toDateStr(sunday) };
}

export function getDayRange(date) {
  const str = toDateStr(date);
  return { dateFrom: str, dateTo: str };
}

export function getWeekDays(date) {
  const { dateFrom } = getWeekRange(date);
  const monday = new Date(dateFrom + 'T00:00:00');
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    days.push(d);
  }
  return days;
}

export function getMonthGrid(date) {
  const y = date.getFullYear();
  const m = date.getMonth();
  const firstDay = new Date(y, m, 1);
  const lastDay = new Date(y, m + 1, 0);

  // Monday = 0, Sunday = 6
  let startOffset = firstDay.getDay() - 1;
  if (startOffset < 0) startOffset = 6;

  const cells = [];
  // Previous month padding
  for (let i = startOffset - 1; i >= 0; i--) {
    const d = new Date(y, m, -i);
    cells.push({ date: d, dateStr: toDateStr(d), isCurrentMonth: false });
  }
  // Current month
  for (let i = 1; i <= lastDay.getDate(); i++) {
    const d = new Date(y, m, i);
    cells.push({ date: d, dateStr: toDateStr(d), isCurrentMonth: true });
  }
  // Next month padding (fill to 42 cells = 6 rows)
  while (cells.length < 42) {
    const d = new Date(y, m + 1, cells.length - startOffset - lastDay.getDate() + 1);
    cells.push({ date: d, dateStr: toDateStr(d), isCurrentMonth: false });
  }
  return cells;
}

export function formatMonthYear(date) {
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export function formatDayHeader(date) {
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export function formatWeekdayShort(date) {
  return date.toLocaleDateString('en-US', { weekday: 'short' });
}

// ── Grouping ────────────────────────────────────────────

export function groupByDate(appointments) {
  const map = {};
  appointments.forEach(apt => {
    const key = apt.appointment_date;
    if (!map[key]) map[key] = [];
    map[key].push(apt);
  });
  // Sort each group by time
  Object.values(map).forEach(arr => arr.sort((a, b) => timeToMinutes(a.appointment_time) - timeToMinutes(b.appointment_time)));
  return map;
}

export function groupByStaff(appointments) {
  const map = {};
  appointments.forEach(apt => {
    const key = apt.assigned_staff_id || '_unassigned';
    if (!map[key]) map[key] = [];
    map[key].push(apt);
  });
  return map;
}

// ── Initials ────────────────────────────────────────────

export function getInitials(name) {
  return ((name || 'U').split(' ').map(n => n?.[0] || '').join('').slice(0, 2).toUpperCase()) || '?';
}
