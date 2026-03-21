import { getCached, setCached, invalidateByPath, getTTL } from './cache.js';

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
    const token = session?.access_token;
    if (!token) return null;

    // Check token expiry — reject tokens expiring within 60 seconds
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      if (payload.exp && payload.exp * 1000 < Date.now() + 60000) {
        return null; // Token expired or about to expire — let Supabase auto-refresh handle it
      }
    } catch {
      // If we can't parse the token, use it anyway
    }

    return token;
  } catch {
    return null;
  }
}

/**
 * Authenticated fetch wrapper.
 */
async function apiFetch(path, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const isGet = method === 'GET';

  // Serve from cache on GET hits
  if (isGet) {
    const cached = getCached(path);
    if (cached !== null) return cached;
  }

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
    const { toast } = await import('sonner');
    toast.error('Session expired. Redirecting to login...');
    setTimeout(() => { window.location.href = '/login'; }, 2000);
    throw new Error('Session expired');
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `API error: ${res.status}`);
  }

  const data = await res.json();

  if (isGet) {
    // Cache the response
    const ttl = getTTL(path);
    setCached(path, data, ttl);
  } else {
    // Mutation — invalidate related cache entries
    invalidateByPath(path);
  }

  return data;
}

// ── Leads ──────────────────────────────────────────────

export async function fetchLeads() {
  const res = await apiFetch('/leads');
  // Backend returns { data, total } with pagination — unwrap for compatibility
  return Array.isArray(res) ? res : (res.data || []);
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
  const res = await apiFetch('/appointments');
  return Array.isArray(res) ? res : (res.data || []);
}

export async function updateAppointment(id, updates) {
  return apiFetch(`/appointments/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

// ── Settings (client admin) ────────────────────────────

export async function updateSettings(updates) {
  return apiFetch('/settings', { method: 'PATCH', body: JSON.stringify(updates) });
}

export async function syncAgent(agentId, llmId) {
  return apiFetch('/settings/sync-agent', {
    method: 'POST',
    body: JSON.stringify({ agent_id: agentId, llm_id: llmId }),
  });
}

// ── Staff ──────────────────────────────────────────────

export async function fetchStaff() {
  return apiFetch('/staff');
}

export async function createStaff(data) {
  return apiFetch('/staff', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateStaff(id, updates) {
  return apiFetch(`/staff/${id}`, { method: 'PATCH', body: JSON.stringify(updates) });
}

export async function deleteStaff(id) {
  return apiFetch(`/staff/${id}`, { method: 'DELETE' });
}

// ── Firms (Admin) ──────────────────────────────────────

export async function fetchFirms() {
  return apiFetch('/firms');
}

export async function fetchFirm(id) {
  return apiFetch(`/firms/${id}`);
}

export async function createFirm(data) {
  return apiFetch('/firms', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateFirm(id, updates) {
  return apiFetch(`/firms/${id}`, { method: 'PATCH', body: JSON.stringify(updates) });
}

export async function syncFirmAgent(id) {
  return apiFetch(`/firms/${id}/sync-agent`, { method: 'POST' });
}

export async function deployFirmAgent(id, opts = {}) {
  return apiFetch(`/firms/${id}/deploy-agent`, { method: 'POST', body: JSON.stringify(opts) });
}

// ── Templates (Admin) ──────────────────────────────────

export async function fetchTemplates() {
  return apiFetch('/templates');
}

export async function fetchTemplate(id) {
  return apiFetch(`/templates/${id}`);
}

export async function createTemplate(data) {
  return apiFetch('/templates', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateTemplate(id, updates) {
  return apiFetch(`/templates/${id}`, { method: 'PATCH', body: JSON.stringify(updates) });
}

export async function deleteTemplate(id) {
  return apiFetch(`/templates/${id}`, { method: 'DELETE' });
}

export async function previewTemplate(templateId, firmId) {
  return apiFetch(`/templates/${templateId}/preview`, {
    method: 'POST',
    body: JSON.stringify({ firm_id: firmId }),
  });
}

// ── Messages ─────────────────────────────────────────────

export async function fetchMessages(leadId) {
  return apiFetch(`/messages?lead_id=${encodeURIComponent(leadId)}`);
}

export async function sendMessage(data) {
  return apiFetch('/messages', { method: 'POST', body: JSON.stringify(data) });
}

// ── Knowledge Base ───────────────────────────────────────

export async function fetchKnowledge() {
  return apiFetch('/knowledge');
}

export async function createKnowledge(data) {
  return apiFetch('/knowledge', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateKnowledge(id, updates) {
  return apiFetch(`/knowledge/${id}`, { method: 'PATCH', body: JSON.stringify(updates) });
}

export async function deleteKnowledge(id) {
  return apiFetch(`/knowledge/${id}`, { method: 'DELETE' });
}

export async function reorderKnowledge(items) {
  return apiFetch('/knowledge/reorder', { method: 'PATCH', body: JSON.stringify({ items }) });
}

// ── Logs (Admin) ───────────────────────────────────────

export async function fetchLogs(params = {}) {
  const query = new URLSearchParams(params).toString();
  return apiFetch(`/logs?${query}`);
}
