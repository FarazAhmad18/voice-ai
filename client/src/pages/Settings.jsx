import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useFirm } from '../context/FirmContext';
import { updateSettings, fetchStaff } from '../services/api';
import { toast } from 'sonner';
import { Webhook, Eye, EyeOff, Loader2 } from 'lucide-react';

export default function Settings() {
  const { user, firm } = useAuth();
  const { labels } = useFirm();
  const [staff, setStaff] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const [showApiKey, setShowApiKey] = useState(false);
  const [testingWebhook, setTestingWebhook] = useState(false);

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    business_hours: '',
    website: '',
    crm_mode: 'builtin',
    crm_type: '',
    crm_webhook_url: '',
    crm_api_key: '',
  });

  useEffect(() => {
    if (firm) {
      setForm({
        name: firm.name || '',
        email: firm.email || '',
        phone: firm.phone || '',
        address: firm.address || '',
        business_hours: firm.business_hours || '',
        website: firm.website || '',
        crm_mode: firm.crm_mode || 'builtin',
        crm_type: firm.crm_type || '',
        crm_webhook_url: firm.crm_webhook_url || '',
        crm_api_key: firm.crm_api_key || '',
      });
    }
    fetchStaff().then(setStaff).catch(() => {});
  }, [firm]);

  async function handleSave() {
    if (!firm) return;
    setSaving(true);
    setSaved(false);
    setError('');
    try {
      const payload = { ...form };
      // Set crm_type based on crm_mode
      if (payload.crm_mode === 'builtin') {
        payload.crm_type = null;
      } else {
        payload.crm_type = 'webhook';
      }
      await updateSettings(payload);
      setSaved(true);
      toast.success('Settings saved');
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err.message || 'Failed to save');
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  if (!firm) {
    return (
      <div className="text-center py-16">
        <p className="text-sm text-slate-400">No firm data available</p>
      </div>
    );
  }

  const activeStaff = staff.filter(s => s.is_active);

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {error && (
        <div className="px-4 py-3 bg-red-50 border border-red-100 rounded-xl">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Firm Info */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-sm font-semibold text-slate-800">Company Information</h3>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-xs font-medium bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : saved ? 'Saved' : 'Save Changes'}
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Company Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))}
              className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-200"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm(p => ({ ...p, email: e.target.value }))}
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-200"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Phone</label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm(p => ({ ...p, phone: e.target.value }))}
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-200"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Address</label>
            <input
              type="text"
              value={form.address}
              onChange={(e) => setForm(p => ({ ...p, address: e.target.value }))}
              placeholder="123 Main St, Suite 100, City, State"
              className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-200 placeholder:text-slate-300"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Website</label>
              <input
                type="text"
                value={form.website}
                onChange={(e) => setForm(p => ({ ...p, website: e.target.value }))}
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-200"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Business Hours</label>
              <input
                type="text"
                value={form.business_hours}
                onChange={(e) => setForm(p => ({ ...p, business_hours: e.target.value }))}
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-200"
              />
            </div>
          </div>
        </div>
      </div>

      {/* AI Assistant */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6">
        <h3 className="text-sm font-semibold text-slate-800 mb-4">AI Assistant</h3>
        <div className="divide-y divide-slate-50">
          <div className="flex items-center justify-between py-3">
            <span className="text-sm text-slate-400">Name</span>
            <span className="text-sm font-medium text-slate-800">{firm.agent_name || 'Not configured'}</span>
          </div>
          <div className="flex items-center justify-between py-3">
            <span className="text-sm text-slate-400">Phone Number</span>
            <span className="text-sm font-medium text-slate-800">{firm.retell_phone_number || 'Not assigned'}</span>
          </div>
          <div className="flex items-center justify-between py-3">
            <span className="text-sm text-slate-400">Status</span>
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-800">
              <span className={`w-1.5 h-1.5 rounded-full ${firm.retell_agent_id ? 'bg-emerald-500' : 'bg-slate-300'}`} />
              {firm.retell_agent_id ? 'Active' : 'Not deployed'}
            </span>
          </div>
        </div>
      </div>

      {/* Staff */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6">
        <h3 className="text-sm font-semibold text-slate-800 mb-4">{labels.staff} ({activeStaff.length})</h3>
        {activeStaff.length === 0 ? (
          <p className="text-sm text-slate-400">No {labels.staff.toLowerCase()} added yet</p>
        ) : (
          <div className="divide-y divide-slate-50">
            {activeStaff.map(s => (
              <div key={s.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium text-slate-800">{s.name}</p>
                  <p className="text-xs text-slate-400">{s.specialization || s.role || ''}</p>
                </div>
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                  Active
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* CRM Integration — admin only */}
      {user?.role === 'admin' || user?.role === 'super_admin' ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Webhook size={16} className="text-slate-400" />
            <h3 className="text-sm font-semibold text-slate-800">CRM Integration</h3>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">CRM Mode</label>
              <select
                value={form.crm_mode}
                onChange={(e) => {
                  const mode = e.target.value;
                  setForm(p => ({
                    ...p,
                    crm_mode: mode,
                    crm_type: mode === 'builtin' ? '' : p.crm_type || 'webhook',
                  }));
                }}
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-200"
              >
                <option value="builtin">Built-in Only</option>
                <option value="external">External Webhook</option>
                <option value="both">Both (Built-in + External)</option>
              </select>
              <p className="text-[11px] text-slate-400 mt-1">
                {form.crm_mode === 'builtin'
                  ? 'Lead data stays in the built-in CRM only.'
                  : form.crm_mode === 'external'
                  ? 'Lead data is pushed to your external CRM via webhook.'
                  : 'Lead data is stored locally and also pushed to your external CRM.'}
              </p>
            </div>

            {(form.crm_mode === 'external' || form.crm_mode === 'both') && (
              <>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Webhook URL</label>
                  <input
                    type="url"
                    value={form.crm_webhook_url}
                    onChange={(e) => setForm(p => ({ ...p, crm_webhook_url: e.target.value }))}
                    placeholder="https://your-crm.com/api/webhook"
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-200 placeholder:text-slate-300"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">API Key (optional)</label>
                  <div className="relative">
                    <input
                      type={showApiKey ? 'text' : 'password'}
                      value={form.crm_api_key}
                      onChange={(e) => setForm(p => ({ ...p, crm_api_key: e.target.value }))}
                      placeholder="Bearer token for webhook authentication"
                      className="w-full px-3.5 py-2.5 pr-10 text-sm bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-200 placeholder:text-slate-300"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Sent as Authorization: Bearer header with each webhook request.
                  </p>
                </div>

                <button
                  type="button"
                  disabled={testingWebhook || !form.crm_webhook_url}
                  onClick={async () => {
                    setTestingWebhook(true);
                    try {
                      const testPayload = {
                        event: 'test',
                        timestamp: new Date().toISOString(),
                        firm: { id: firm.id, name: firm.name },
                        lead: {
                          id: 'test_lead_001',
                          name: 'Test Lead',
                          phone: '+10000000000',
                          email: 'test@example.com',
                          service_type: 'other',
                          urgency: 'low',
                          score: 50,
                          score_label: 'warm',
                          summary: 'This is a test webhook payload from LeapingAI.',
                          recording_url: null,
                        },
                        appointment: null,
                      };

                      const headers = { 'Content-Type': 'application/json' };
                      if (form.crm_api_key) {
                        headers['Authorization'] = `Bearer ${form.crm_api_key}`;
                      }

                      const res = await fetch(form.crm_webhook_url, {
                        method: 'POST',
                        headers,
                        body: JSON.stringify(testPayload),
                      });

                      if (res.ok) {
                        toast.success('Test webhook sent successfully');
                      } else {
                        toast.error(`Webhook returned ${res.status}`);
                      }
                    } catch (err) {
                      toast.error(`Webhook test failed: ${err.message}`);
                    } finally {
                      setTestingWebhook(false);
                    }
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 transition-colors disabled:opacity-40"
                >
                  {testingWebhook ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <Webhook size={13} />
                  )}
                  Send Test Webhook
                </button>
              </>
            )}
          </div>
        </div>
      ) : null}

      {/* Plan */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6">
        <h3 className="text-sm font-semibold text-slate-800 mb-4">Plan & Usage</h3>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-900 capitalize">{firm.plan || 'Free'} Plan</p>
            <p className="text-xs text-slate-400 mt-0.5">Contact admin for plan changes</p>
          </div>
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${
            firm.status === 'active' ? 'bg-emerald-50 text-emerald-700' :
            firm.status === 'paused' ? 'bg-amber-50 text-amber-700' :
            'bg-slate-50 text-slate-500'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${
              firm.status === 'active' ? 'bg-emerald-500' :
              firm.status === 'paused' ? 'bg-amber-500' : 'bg-slate-400'
            }`} />
            {firm.status || 'unknown'}
          </span>
        </div>
      </div>

      {/* Account */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6">
        <h3 className="text-sm font-semibold text-slate-800 mb-4">Your Account</h3>
        <div className="divide-y divide-slate-50">
          <div className="flex items-center justify-between py-3">
            <span className="text-sm text-slate-400">Name</span>
            <span className="text-sm font-medium text-slate-800">{user?.name}</span>
          </div>
          <div className="flex items-center justify-between py-3">
            <span className="text-sm text-slate-400">Email</span>
            <span className="text-sm font-medium text-slate-800">{user?.email}</span>
          </div>
          <div className="flex items-center justify-between py-3">
            <span className="text-sm text-slate-400">Role</span>
            <span className="text-sm font-medium text-slate-800 capitalize">{user?.role?.replace('_', ' ')}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
