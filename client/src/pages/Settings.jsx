import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useFirm } from '../context/FirmContext';
import { updateSettings, syncAgent, fetchStaff, fetchKnowledge } from '../services/api';
import { toast } from 'sonner';
import {
  Webhook, Eye, EyeOff, Loader2, Building2, Bot, Users,
  CreditCard, User, CheckCircle, Shield,
  Globe, Clock, MapPin, Mail, Phone, ExternalLink, Brain, ArrowRight, RefreshCw, Calendar,
} from 'lucide-react';

/* ─── Inject keyframe styles once ─── */
const STYLE_ID = '__settings-premium-styles';
if (typeof document !== 'undefined' && !document.getElementById(STYLE_ID)) {
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    @keyframes settingsFadeInUp {
      from { opacity: 0; transform: translateY(16px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes settingsShimmer {
      0%   { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }
    @keyframes settingsPulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.7; transform: scale(1.2); }
    }
    .settings-fade-in-up {
      animation: settingsFadeInUp 0.4s ease forwards;
      opacity: 0;
    }
    .settings-shimmer {
      background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%);
      background-size: 200% 100%;
      animation: settingsShimmer 1.5s ease-in-out infinite;
    }
    .settings-status-pulse {
      animation: settingsPulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
    }
  `;
  document.head.appendChild(style);
}

export default function Settings() {
  const { user, firm, refreshProfile } = useAuth();
  const { labels } = useFirm();
  const [staff, setStaff] = useState([]);
  const [knowledgeCount, setKnowledgeCount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const [showApiKey, setShowApiKey] = useState(false);
  const [testingWebhook, setTestingWebhook] = useState(false);
  const [webhookTestResult, setWebhookTestResult] = useState(null);
  const [syncAgentId, setSyncAgentId] = useState('');
  const [syncLlmId, setSyncLlmId] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null); // { success, promptLength, error }

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
    calendar_mode: 'builtin',
    google_calendar_id: '',
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
        calendar_mode: firm.calendar_mode || 'builtin',
        google_calendar_id: firm.google_calendar_id || '',
      });
      // Pre-fill sync fields from stored IDs
      setSyncAgentId(firm.retell_agent_id || '');
      setSyncLlmId(firm.retell_llm_id || '');
    }
    fetchStaff().then(setStaff).catch(() => {});
    fetchKnowledge().then(data => {
      const items = Array.isArray(data) ? data : [];
      setKnowledgeCount(items.filter(e => e.is_active !== false).length);
    }).catch(() => {});
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
      // BUG #7: Refresh auth context so firm data is up-to-date everywhere
      await refreshProfile();
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
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Loading skeleton */}
        {[1,2,3,4].map(i => (
          <div key={i} className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
            <div className="h-14 settings-shimmer" />
            <div className="p-6 space-y-4">
              <div className="h-4 w-32 settings-shimmer rounded" />
              <div className="h-10 settings-shimmer rounded-xl" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="h-10 settings-shimmer rounded-xl" />
                <div className="h-10 settings-shimmer rounded-xl" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  const activeStaff = staff.filter(s => s.is_active);

  const AVATAR_GRADIENTS = [
    'from-violet-500 to-purple-600',
    'from-blue-500 to-indigo-600',
    'from-emerald-500 to-teal-600',
    'from-amber-500 to-orange-600',
    'from-rose-500 to-pink-600',
  ];

  function getStaffGradient(name) {
    if (!name) return AVATAR_GRADIENTS[0];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length];
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {error && (
        <div className="bg-red-50/80 backdrop-blur-sm border border-red-100 rounded-2xl px-5 py-4 flex items-center gap-3">
          <div className="w-9 h-9 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <Shield size={16} className="text-red-500" />
          </div>
          <p className="text-sm font-medium text-red-700">{error}</p>
        </div>
      )}

      {/* Firm Info */}
      <div className={`settings-fade-in-up bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden ${saving ? 'opacity-50 pointer-events-none' : ''}`} style={{ animationDelay: '0ms' }}>
        <div className="bg-gradient-to-r from-slate-800 to-slate-900 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center">
              <Building2 size={16} className="text-white/80" />
            </div>
            <h3 className="text-sm font-bold text-white">Company Information</h3>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className={`px-5 py-2 text-xs font-semibold rounded-lg transition-all shadow-sm ${
              saved
                ? 'bg-emerald-500 text-white'
                : 'bg-gradient-to-r from-violet-500 to-purple-500 text-white hover:from-violet-600 hover:to-purple-600 shadow-violet-300/30'
            } disabled:opacity-50`}
          >
            {saving ? (
              <span className="inline-flex items-center gap-1.5">
                <Loader2 size={12} className="animate-spin" />
                Saving...
              </span>
            ) : saved ? (
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle size={12} />
                Saved
              </span>
            ) : 'Save Changes'}
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Company Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))}
              disabled={saving}
              className="w-full px-4 py-3 text-sm bg-slate-50/80 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-300 focus:bg-white disabled:opacity-50 transition-all"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 mb-1.5">
                <Mail size={10} className="text-slate-400" />
                Email
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm(p => ({ ...p, email: e.target.value }))}
                disabled={saving}
                className="w-full px-4 py-3 text-sm bg-slate-50/80 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-300 focus:bg-white disabled:opacity-50 transition-all"
              />
            </div>
            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 mb-1.5">
                <Phone size={10} className="text-slate-400" />
                Phone
              </label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm(p => ({ ...p, phone: e.target.value }))}
                disabled={saving}
                className="w-full px-4 py-3 text-sm bg-slate-50/80 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-300 focus:bg-white disabled:opacity-50 transition-all"
              />
            </div>
          </div>
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 mb-1.5">
              <MapPin size={10} className="text-slate-400" />
              Address
            </label>
            <input
              type="text"
              value={form.address}
              onChange={(e) => setForm(p => ({ ...p, address: e.target.value }))}
              placeholder="123 Main St, Suite 100, City, State"
              disabled={saving}
              className="w-full px-4 py-3 text-sm bg-slate-50/80 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-300 focus:bg-white placeholder:text-slate-300 disabled:opacity-50 transition-all"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 mb-1.5">
                <Globe size={10} className="text-slate-400" />
                Website
              </label>
              <input
                type="text"
                value={form.website}
                onChange={(e) => setForm(p => ({ ...p, website: e.target.value }))}
                disabled={saving}
                className="w-full px-4 py-3 text-sm bg-slate-50/80 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-300 focus:bg-white disabled:opacity-50 transition-all"
              />
            </div>
            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 mb-1.5">
                <Clock size={10} className="text-slate-400" />
                Business Hours
              </label>
              <input
                type="text"
                value={form.business_hours}
                onChange={(e) => setForm(p => ({ ...p, business_hours: e.target.value }))}
                disabled={saving}
                className="w-full px-4 py-3 text-sm bg-slate-50/80 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-300 focus:bg-white disabled:opacity-50 transition-all"
              />
            </div>
          </div>
        </div>
      </div>

      {/* AI Assistant */}
      <div className="settings-fade-in-up bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 rounded-2xl shadow-lg shadow-violet-200/50 overflow-hidden" style={{ animationDelay: '100ms' }}>
        <div className="px-6 py-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 bg-white/15 rounded-xl flex items-center justify-center backdrop-blur-sm">
              <Bot size={18} className="text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">AI Assistant</h3>
              <p className="text-xs text-white/50">Voice agent configuration</p>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2.5 border-b border-white/10">
              <span className="text-sm text-white/60">Name</span>
              <span className="text-sm font-semibold text-white">{firm.agent_name || 'Not configured'}</span>
            </div>
            <div className="flex items-center justify-between py-2.5 border-b border-white/10">
              <span className="text-sm text-white/60">Phone Number</span>
              <span className="text-sm font-semibold text-white font-mono">{firm.retell_phone_number || 'Not assigned'}</span>
            </div>
            <div className="flex items-center justify-between py-2.5">
              <span className="text-sm text-white/60">Status</span>
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-white">
                {firm.retell_agent_id ? (
                  <>
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="settings-status-pulse absolute inline-flex h-full w-full rounded-full bg-emerald-400" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400" />
                    </span>
                    Active
                  </>
                ) : (
                  <>
                    <span className="w-2.5 h-2.5 rounded-full bg-white/30" />
                    Not deployed
                  </>
                )}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Sync Agent */}
      {(user?.role === 'admin' || user?.role === 'super_admin') && (
        <div className="settings-fade-in-up bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden" style={{ animationDelay: '120ms' }}>
          <div className="bg-gradient-to-r from-indigo-500 to-violet-600 px-6 py-4 flex items-center gap-3">
            <div className="w-8 h-8 bg-white/15 rounded-lg flex items-center justify-center">
              <RefreshCw size={16} className="text-white/90" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Sync AI Agent</h3>
              <p className="text-xs text-white/50">Push staff & knowledge to your Retell agent</p>
            </div>
          </div>
          <div className="p-6 space-y-4">
            <p className="text-xs text-slate-500 leading-relaxed">
              Paste your Retell Agent ID and LLM ID below. Clicking <strong>Sync Now</strong> will push your current staff list and knowledge base into the AI agent's prompt.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Agent ID</label>
                <input
                  type="text"
                  value={syncAgentId || firm?.retell_agent_id || ''}
                  onChange={(e) => setSyncAgentId(e.target.value)}
                  placeholder="agent_xxxxxxxxxxxxxxxx"
                  className="w-full px-3 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-300 font-mono placeholder:text-slate-300 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">LLM ID</label>
                <input
                  type="text"
                  value={syncLlmId || firm?.retell_llm_id || ''}
                  onChange={(e) => setSyncLlmId(e.target.value)}
                  placeholder="llm_xxxxxxxxxxxxxxxx"
                  className="w-full px-3 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-300 font-mono placeholder:text-slate-300 transition-all"
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={async () => {
                  setSyncing(true);
                  setSyncResult(null);
                  try {
                    const agentId = syncAgentId.trim() || firm?.retell_agent_id || '';
                    const llmId = syncLlmId.trim() || firm?.retell_llm_id || '';
                    const result = await syncAgent(agentId || undefined, llmId || undefined);
                    setSyncResult({ success: true, promptLength: result.promptLength });
                    toast.success('Agent synced — staff & knowledge pushed to Retell');
                    await refreshProfile();
                  } catch (err) {
                    setSyncResult({ success: false, error: err.message });
                    toast.error(`Sync failed: ${err.message}`);
                  } finally {
                    setSyncing(false);
                    setTimeout(() => setSyncResult(null), 6000);
                  }
                }}
                disabled={syncing}
                className={`inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold rounded-xl transition-all disabled:opacity-40 shadow-sm ${
                  syncResult?.success
                    ? 'bg-emerald-500 text-white shadow-emerald-200/50'
                    : syncResult?.error
                    ? 'bg-red-500 text-white shadow-red-200/50'
                    : 'bg-gradient-to-r from-indigo-500 to-violet-600 text-white hover:from-indigo-600 hover:to-violet-700 shadow-violet-200/50'
                }`}
              >
                {syncing ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : syncResult?.success ? (
                  <CheckCircle size={13} />
                ) : (
                  <RefreshCw size={13} />
                )}
                {syncing ? 'Syncing...' : syncResult?.success ? `Synced${syncResult.promptLength ? ` (${syncResult.promptLength} chars)` : ''}` : syncResult?.error ? 'Sync Failed' : 'Sync Now'}
              </button>
              {syncResult?.error && (
                <p className="text-xs text-red-500">{syncResult.error}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* AI Knowledge Preview */}
      <div className="settings-fade-in-up bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden" style={{ animationDelay: '150ms' }}>
        <div className="bg-gradient-to-r from-violet-500 to-purple-500 px-6 py-4 flex items-center gap-3">
          <div className="w-8 h-8 bg-white/15 rounded-lg flex items-center justify-center">
            <Brain size={16} className="text-white/90" />
          </div>
          <h3 className="text-sm font-bold text-white">AI Knowledge</h3>
        </div>
        <div className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 bg-gradient-to-br from-violet-50 to-purple-50 rounded-xl flex items-center justify-center">
                <Brain size={20} className="text-violet-500" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">
                  {knowledgeCount} active {knowledgeCount === 1 ? 'entry' : 'entries'}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">Questions your AI can answer</p>
              </div>
            </div>
            <Link
              to="/knowledge"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-violet-600 bg-violet-50 hover:bg-violet-100 rounded-lg border border-violet-100 transition-all duration-200"
            >
              Manage Knowledge
              <ArrowRight size={12} />
            </Link>
          </div>
        </div>
      </div>

      {/* Staff */}
      <div className="settings-fade-in-up bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden" style={{ animationDelay: '200ms' }}>
        <div className="bg-gradient-to-r from-emerald-500 to-teal-600 px-6 py-4 flex items-center gap-3">
          <div className="w-8 h-8 bg-white/15 rounded-lg flex items-center justify-center">
            <Users size={16} className="text-white/90" />
          </div>
          <h3 className="text-sm font-bold text-white">{labels.staff} ({activeStaff.length})</h3>
        </div>
        <div className="p-6">
          {activeStaff.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-sm text-slate-400">No {labels.staff.toLowerCase()} added yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {activeStaff.map(s => {
                const initials = ((s.name || 'U').split(' ').map(n => n?.[0] || '').join('').slice(0, 2).toUpperCase()) || '?';
                const gradient = getStaffGradient(s.name);
                return (
                  <div key={s.id} className="flex items-center gap-3 py-2.5 px-3 rounded-xl hover:bg-slate-50 transition-colors">
                    <div className={`w-9 h-9 bg-gradient-to-br ${gradient} rounded-lg flex items-center justify-center text-xs font-bold text-white shadow-sm flex-shrink-0`}>
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800">{s.name}</p>
                      <p className="text-xs text-slate-400">{s.specialization || s.role || ''}</p>
                    </div>
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full ring-1 ring-emerald-100">
                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                      Active
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Calendar Mode -- admin only */}
      {(user?.role === 'admin' || user?.role === 'super_admin') && (
        <div className="settings-fade-in-up bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden" style={{ animationDelay: '280ms' }}>
          <div className="bg-gradient-to-r from-emerald-500 to-teal-600 px-6 py-4 flex items-center gap-3">
            <div className="w-8 h-8 bg-white/15 rounded-lg flex items-center justify-center">
              <Calendar size={16} className="text-white/90" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Appointment Calendar</h3>
              <p className="text-xs text-white/50">How availability is checked during calls</p>
            </div>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Calendar Mode</label>
              <select
                value={form.calendar_mode}
                onChange={(e) => setForm(p => ({ ...p, calendar_mode: e.target.value }))}
                disabled={saving}
                className="w-full px-4 py-3 text-sm bg-slate-50/80 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300 focus:bg-white disabled:opacity-50 transition-all appearance-none cursor-pointer"
              >
                <option value="builtin">Built-in (Recommended)</option>
                <option value="google">Google Calendar</option>
              </select>
              <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                {form.calendar_mode === 'builtin'
                  ? 'Availability checked against your dashboard appointments. Per-attorney, zero setup, works immediately.'
                  : 'Availability checked against a linked Google Calendar. Blocks external meetings. Requires Google Calendar ID below.'}
              </p>
            </div>

            {form.calendar_mode === 'google' && (
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Google Calendar ID</label>
                <input
                  type="text"
                  value={form.google_calendar_id}
                  onChange={(e) => setForm(p => ({ ...p, google_calendar_id: e.target.value }))}
                  placeholder="example@group.calendar.google.com"
                  disabled={saving}
                  className="w-full px-4 py-3 text-sm bg-slate-50/80 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300 focus:bg-white placeholder:text-slate-300 disabled:opacity-50 transition-all font-mono text-xs"
                />
                <p className="text-[11px] text-slate-400 mt-1.5">
                  Found in Google Calendar → Settings → your calendar → Calendar ID
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CRM Integration -- admin only */}
      {user?.role === 'admin' || user?.role === 'super_admin' ? (
        <div className="settings-fade-in-up bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden" style={{ animationDelay: '300ms' }}>
          <div className="bg-gradient-to-r from-blue-500 to-indigo-600 px-6 py-4 flex items-center gap-3">
            <div className="w-8 h-8 bg-white/15 rounded-lg flex items-center justify-center">
              <Webhook size={16} className="text-white/90" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">CRM Integration</h3>
              <p className="text-xs text-white/50">Connect your external CRM</p>
            </div>
          </div>

          <div className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">CRM Mode</label>
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
                disabled={saving}
                className="w-full px-4 py-3 text-sm bg-slate-50/80 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-300 focus:bg-white disabled:opacity-50 transition-all appearance-none cursor-pointer"
              >
                <option value="builtin">Built-in Only</option>
                <option value="external">External Webhook</option>
                <option value="both">Both (Built-in + External)</option>
              </select>
              <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
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
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 mb-1.5">
                    <ExternalLink size={10} className="text-slate-400" />
                    Webhook URL
                  </label>
                  <input
                    type="url"
                    value={form.crm_webhook_url}
                    onChange={(e) => setForm(p => ({ ...p, crm_webhook_url: e.target.value }))}
                    placeholder="https://your-crm.com/api/webhook"
                    disabled={saving}
                    className="w-full px-4 py-3 text-sm bg-slate-50/80 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-300 focus:bg-white placeholder:text-slate-300 disabled:opacity-50 transition-all"
                  />
                </div>

                <div>
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 mb-1.5">
                    <Shield size={10} className="text-slate-400" />
                    API Key (optional)
                  </label>
                  <div className="relative">
                    <input
                      type={showApiKey ? 'text' : 'password'}
                      value={form.crm_api_key}
                      onChange={(e) => setForm(p => ({ ...p, crm_api_key: e.target.value }))}
                      placeholder="Bearer token for webhook authentication"
                      disabled={saving}
                      className="w-full px-4 py-3 pr-11 text-sm bg-slate-50/80 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-300 focus:bg-white placeholder:text-slate-300 disabled:opacity-50 transition-all font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-violet-500 transition-colors rounded"
                    >
                      {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1.5">
                    Sent as Authorization: Bearer header with each webhook request.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    disabled={testingWebhook || !form.crm_webhook_url}
                    onClick={async () => {
                      setTestingWebhook(true);
                      setWebhookTestResult(null);
                      try {
                        // Test via server-side endpoint to avoid SSRF and credential exposure
                        const API_BASE = import.meta.env.VITE_API_URL || '/api';
                        const token = localStorage.getItem('sb-' + new URL(import.meta.env.VITE_SUPABASE_URL).hostname.split('.')[0] + '-auth-token');
                        const accessToken = token ? JSON.parse(token)?.access_token : null;
                        const res = await fetch(`${API_BASE}/settings/test-webhook`, {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
                          },
                          body: JSON.stringify({ webhook_url: form.crm_webhook_url }),
                        });

                        if (res.ok) {
                          toast.success('Test webhook sent successfully');
                          setWebhookTestResult('success');
                        } else {
                          toast.error(`Webhook returned ${res.status}`);
                          setWebhookTestResult('error');
                        }
                      } catch (err) {
                        toast.error(`Webhook test failed: ${err.message}`);
                        setWebhookTestResult('error');
                      } finally {
                        setTestingWebhook(false);
                        setTimeout(() => setWebhookTestResult(null), 5000);
                      }
                    }}
                    className={`inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold rounded-xl transition-all disabled:opacity-40 ${
                      webhookTestResult === 'success'
                        ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-200/50'
                        : webhookTestResult === 'error'
                        ? 'bg-red-500 text-white shadow-sm shadow-red-200/50'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {testingWebhook ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : webhookTestResult === 'success' ? (
                      <CheckCircle size={13} />
                    ) : webhookTestResult === 'error' ? (
                      <Shield size={13} />
                    ) : (
                      <Webhook size={13} />
                    )}
                    {testingWebhook ? 'Sending...' : webhookTestResult === 'success' ? 'Test Passed' : webhookTestResult === 'error' ? 'Test Failed' : 'Send Test Webhook'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}

      {/* Plan */}
      <div className="settings-fade-in-up bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden" style={{ animationDelay: '400ms' }}>
        <div className={`px-6 py-4 flex items-center gap-3 ${
          firm.plan === 'enterprise' ? 'bg-gradient-to-r from-amber-500 to-orange-500' :
          firm.plan === 'scale' ? 'bg-gradient-to-r from-violet-600 to-purple-600' :
          'bg-gradient-to-r from-blue-500 to-indigo-600'
        }`}>
          <div className="w-8 h-8 bg-white/15 rounded-lg flex items-center justify-center">
            <CreditCard size={16} className="text-white/90" />
          </div>
          <h3 className="text-sm font-bold text-white">Plan & Usage</h3>
          <span className={`ml-auto inline-flex items-center gap-2 px-3 py-1 rounded-lg text-xs font-semibold ${
            firm.status === 'active' ? 'bg-white/20 text-white' :
            firm.status === 'paused' ? 'bg-black/20 text-white/80' :
            'bg-black/20 text-white/60'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${firm.status === 'active' ? 'bg-white' : 'bg-white/40'}`} />
            {firm.status || 'active'}
          </span>
        </div>

        <div className="p-6 space-y-5">
          {/* Plan name + price */}
          {(() => {
            const PLAN_DATA = {
              growth:     { price: '$899/mo', minutes: '1,000 min/mo', agents: '1 AI agent', support: 'Email support' },
              scale:      { price: '$1,499/mo', minutes: '3,000 min/mo', agents: '2 AI agents', support: 'Priority support' },
              enterprise: { price: 'Custom pricing', minutes: 'Unlimited minutes', agents: 'Unlimited AI agents', support: 'Dedicated account manager' },
            };
            const PLAN_FEATURES = {
              growth:     ['1,000 minutes/month', '1 AI voice agent', 'Full CRM dashboard', 'Lead tracking & scoring', 'Appointment booking', 'Custom agent script', 'Call transcripts', 'Email support'],
              scale:      ['3,000 minutes/month', '2 AI voice agents', 'Full CRM dashboard', 'Lead tracking & scoring', 'Appointment booking', 'Custom agent scripts', 'Call transcripts & analytics', 'Follow-up automation', 'Priority support'],
              enterprise: ['Unlimited minutes', 'Unlimited AI agents', 'Full CRM dashboard', 'Lead tracking & scoring', 'Appointment booking', 'Custom agent scripts', 'Advanced analytics & reporting', 'Follow-up automation', 'Custom integrations', 'Dedicated account manager'],
            };
            const plan = firm.plan || 'growth';
            const data = PLAN_DATA[plan] || PLAN_DATA.growth;
            const features = PLAN_FEATURES[plan] || PLAN_FEATURES.growth;
            const accentColor = plan === 'enterprise' ? 'text-amber-600' : plan === 'scale' ? 'text-violet-600' : 'text-blue-600';
            const badgeBg = plan === 'enterprise' ? 'bg-amber-50 border-amber-100' : plan === 'scale' ? 'bg-violet-50 border-violet-100' : 'bg-blue-50 border-blue-100';
            const checkColor = plan === 'enterprise' ? 'text-amber-500' : plan === 'scale' ? 'text-violet-500' : 'text-blue-500';

            return (
              <>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <p className="text-xl font-bold text-slate-900 capitalize">{plan} Plan</p>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${badgeBg} ${accentColor} uppercase tracking-wider`}>
                        {plan}
                      </span>
                    </div>
                    <p className={`text-2xl font-bold mt-1 ${accentColor}`}>
                      {data.price}
                    </p>
                  </div>
                  <div className="text-right space-y-1">
                    <p className="text-xs font-semibold text-slate-700">{data.minutes}</p>
                    <p className="text-xs font-semibold text-slate-700">{data.agents}</p>
                    <p className="text-xs text-slate-400">{data.support}</p>
                  </div>
                </div>

                {/* Features list */}
                <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                  {features.map((f, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <svg className={`w-4 h-4 shrink-0 ${checkColor}`} viewBox="0 0 16 16" fill="none">
                        <circle cx="8" cy="8" r="7" className={plan === 'enterprise' ? 'fill-amber-100' : plan === 'scale' ? 'fill-violet-100' : 'fill-blue-100'} />
                        <path d="M5 8l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <span className="text-xs text-slate-600">{f}</span>
                    </div>
                  ))}
                </div>

                {/* Upgrade prompt */}
                {plan !== 'enterprise' && (
                  <div className="pt-4 border-t border-slate-100">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-semibold text-slate-700">
                          {plan === 'growth' ? 'Upgrade to Scale for 3× minutes + analytics' : 'Upgrade to Enterprise for unlimited capacity'}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">Contact us to upgrade your plan</p>
                      </div>
                      <a
                        href="mailto:support@voibixai.com?subject=Plan Upgrade Request"
                        className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${
                          plan === 'growth'
                            ? 'bg-violet-600 text-white hover:bg-violet-700'
                            : 'bg-amber-500 text-white hover:bg-amber-600'
                        }`}
                      >
                        Upgrade Plan
                      </a>
                    </div>
                  </div>
                )}
              </>
            );
          })()}
        </div>
      </div>

      {/* Account */}
      <div className="settings-fade-in-up bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden" style={{ animationDelay: '500ms' }}>
        <div className="bg-gradient-to-r from-slate-600 to-slate-700 px-6 py-4 flex items-center gap-3">
          <div className="w-8 h-8 bg-white/15 rounded-lg flex items-center justify-center">
            <User size={16} className="text-white/90" />
          </div>
          <h3 className="text-sm font-bold text-white">Your Account</h3>
        </div>
        <div className="p-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2.5 px-3 rounded-xl hover:bg-slate-50 transition-colors">
              <span className="text-sm text-slate-400">Name</span>
              <span className="text-sm font-semibold text-slate-800">{user?.name}</span>
            </div>
            <div className="flex items-center justify-between py-2.5 px-3 rounded-xl hover:bg-slate-50 transition-colors">
              <span className="text-sm text-slate-400">Email</span>
              <span className="text-sm font-semibold text-slate-800">{user?.email}</span>
            </div>
            <div className="flex items-center justify-between py-2.5 px-3 rounded-xl hover:bg-slate-50 transition-colors">
              <span className="text-sm text-slate-400">Role</span>
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-800 capitalize">
                <Shield size={12} className="text-violet-400" />
                {user?.role?.replace('_', ' ')}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
