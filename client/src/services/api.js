const API_BASE = import.meta.env.VITE_API_URL || '/api';

/**
 * Get the current auth token from Supabase session storage.
 */
function getToken() {
  try {
    const hostname = new URL(import.meta.env.VITE_SUPABASE_URL).hostname.split('.')[0];
    const raw = localStorage.getItem(`sb-${hostname}-auth-token`);
    if (!raw) return null;
    const session = JSON.parse(raw);
    return session?.access_token || null;
  } catch {
    return null;
  }
}

/**
 * Authenticated fetch wrapper.
 */
async function apiFetch(path, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (res.status === 401) {
    window.location.href = '/login';
    throw new Error('Session expired');
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `API error: ${res.status}`);
  }

  return res.json();
}

// ── Leads ──────────────────────────────────────────────

export async function fetchLeads() {
  return apiFetch('/leads');
}

export async function fetchLead(id) {
  return apiFetch(`/leads/${id}`);
}

export async function updateLead(id, updates) {
  return apiFetch(`/leads/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

export async function addCallNote(leadId, text) {
  return apiFetch(`/leads/${leadId}/notes`, {
    method: 'POST',
    body: JSON.stringify({ text }),
  });
}

// ── Appointments ───────────────────────────────────────

export async function fetchAppointments() {
  return apiFetch('/appointments');
}

export async function updateAppointment(id, updates) {
  return apiFetch(`/appointments/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

// ── Logs ───────────────────────────────────────────────

export async function fetchLogs(params = {}) {
  const query = new URLSearchParams(params).toString();
  return apiFetch(`/logs?${query}`);
}
