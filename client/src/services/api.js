const API_BASE = '/api';

export async function fetchLeads() {
  const res = await fetch(`${API_BASE}/leads`);
  if (!res.ok) throw new Error('Failed to fetch leads');
  return res.json();
}

export async function fetchLead(id) {
  const res = await fetch(`${API_BASE}/leads/${id}`);
  if (!res.ok) throw new Error('Failed to fetch lead');
  return res.json();
}

export async function updateLead(id, updates) {
  const res = await fetch(`${API_BASE}/leads/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error('Failed to update lead');
  return res.json();
}

export async function fetchAppointments() {
  const res = await fetch(`${API_BASE}/appointments`);
  if (!res.ok) throw new Error('Failed to fetch appointments');
  return res.json();
}

export async function updateAppointment(id, updates) {
  const res = await fetch(`${API_BASE}/appointments/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error('Failed to update appointment');
  return res.json();
}
