import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { fetchFirm, updateFirm, fetchTemplates, syncFirmAgent, deployFirmAgent } from '../../services/api';
import { ArrowLeft, Bot, Phone, Save, Users, BarChart3, Calendar, RefreshCw, Rocket, Check, AlertCircle } from 'lucide-react';

const INDUSTRIES = ['legal', 'dental', 'plumbing', 'real_estate', 'medical', 'other'];
const PLANS = ['growth', 'scale', 'enterprise'];
const STATUSES = ['active', 'paused', 'cancelled'];

export default function ClientDetail() {
  const { id } = useParams();
  const [firm, setFirm] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  // Agent actions
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null); // { success, promptLength } | { error }
  const [deploying, setDeploying] = useState(false);
  const [deployAreaCode, setDeployAreaCode] = useState('');
  const [showDeploy, setShowDeploy] = useState(false);

  const [form, setForm] = useState({
    name: '', industry: 'legal', email: '', phone: '', address: '',
    website: '', business_hours: '', agent_name: '', agent_voice_id: '',
    prompt_template_id: '', brand_color: '#6d28d9', status: 'active', plan: 'growth',
  });

  useEffect(() => {
    async function load() {
      try {
        const [firmData, tmplData] = await Promise.all([fetchFirm(id), fetchTemplates()]);
        setFirm(firmData);
        setTemplates(tmplData);
        setForm({
          name: firmData.name || '',
          industry: firmData.industry || 'legal',
          email: firmData.email || '',
          phone: firmData.phone || '',
          address: firmData.address || '',
          website: firmData.website || '',
          business_hours: firmData.business_hours || '',
          agent_name: firmData.agent_name || '',
          agent_voice_id: firmData.agent_voice_id || '',
          prompt_template_id: firmData.prompt_template_id || '',
          brand_color: firmData.brand_color || '#6d28d9',
          status: firmData.status || 'active',
          plan: firmData.plan || 'growth',
        });
      } catch {
        // handled by null firm state
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    setError('');
    try {
      const updated = await updateFirm(id, form);
      setFirm(prev => ({ ...prev, ...updated }));
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err.message || 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  }

  async function handleSync() {
    setSyncing(true);
    setSyncResult(null);
    try {
      const result = await syncFirmAgent(id);
      setSyncResult({ success: true, promptLength: result.promptLength });
      // Refresh firm to get updated rendered_prompt
      const updated = await fetchFirm(id);
      setFirm(updated);
      setTimeout(() => setSyncResult(null), 5000);
    } catch (err) {
      setSyncResult({ error: err.message || 'Sync failed' });
      setTimeout(() => setSyncResult(null), 5000);
    } finally {
      setSyncing(false);
    }
  }

  async function handleDeploy() {
    setDeploying(true);
    setError('');
    try {
      const result = await deployFirmAgent(id, { area_code: deployAreaCode || undefined, voice_id: form.agent_voice_id || undefined });
      setFirm(prev => ({ ...prev, ...result.firm }));
      setShowDeploy(false);
      setDeployAreaCode('');
    } catch (err) {
      setError(err.message || 'Deploy failed');
    } finally {
      setDeploying(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-6 h-6 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!firm) {
    return (
      <div className="text-center py-16">
        <p className="text-sm font-medium text-slate-500">Client not found</p>
        <Link to="/admin/clients" className="text-sm text-blue-600 mt-2 inline-block">Back to Clients</Link>
      </div>
    );
  }

  const isDeployed = !!firm.retell_agent_id;

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <Link to="/admin/clients" className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-600 transition-colors">
        <ArrowLeft size={15} /> Clients
      </Link>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-bold text-white"
            style={{ backgroundColor: firm.brand_color || '#6d28d9' }}>
            {firm.name?.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-900 tracking-tight">{firm.name}</h1>
            <p className="text-sm text-slate-400 capitalize">{firm.industry} · {firm.status}</p>
          </div>
        </div>
        <button onClick={handleSave} disabled={saving}
          className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-xs font-medium rounded-xl hover:bg-slate-800 transition-colors disabled:opacity-50">
          <Save size={14} />
          {saving ? 'Saving...' : saved ? 'Saved ✓' : 'Save Changes'}
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-100 rounded-xl">
          <AlertCircle size={15} className="text-red-500 shrink-0" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { icon: BarChart3, color: 'blue', count: firm._counts?.leads || 0, label: 'Leads' },
          { icon: Calendar, color: 'violet', count: firm._counts?.appointments || 0, label: 'Appointments' },
          { icon: Users, color: 'emerald', count: firm._counts?.staff || 0, label: 'Staff' },
        ].map(({ icon: Icon, color, count, label }) => (
          <div key={label} className="bg-white rounded-2xl border border-slate-100 p-5 flex items-center gap-4">
            <div className={`w-10 h-10 bg-${color}-50 rounded-xl flex items-center justify-center`}>
              <Icon size={18} className={`text-${color}-600`} />
            </div>
            <div>
              <p className="text-2xl font-semibold text-slate-900">{count}</p>
              <p className="text-sm text-slate-400">{label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: Edit Form */}
        <div className="lg:col-span-2 space-y-4">

          {/* Company Details */}
          <div className="bg-white rounded-2xl border border-slate-100 p-6 space-y-4">
            <h3 className="text-sm font-semibold text-slate-800">Company Details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Name" value={form.name} onChange={v => setForm(p => ({ ...p, name: v }))} />
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Industry</label>
                <select value={form.industry} onChange={e => setForm(p => ({ ...p, industry: e.target.value }))}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-200">
                  {INDUSTRIES.map(i => <option key={i} value={i} className="capitalize">{i.replace('_', ' ')}</option>)}
                </select>
              </div>
              <Field label="Email" value={form.email} onChange={v => setForm(p => ({ ...p, email: v }))} />
              <Field label="Phone" value={form.phone} onChange={v => setForm(p => ({ ...p, phone: v }))} />
              <div className="col-span-1 sm:col-span-2">
                <Field label="Address" value={form.address} onChange={v => setForm(p => ({ ...p, address: v }))} />
              </div>
              <Field label="Website" value={form.website} onChange={v => setForm(p => ({ ...p, website: v }))} />
              <Field label="Business Hours" value={form.business_hours} onChange={v => setForm(p => ({ ...p, business_hours: v }))} />
            </div>
          </div>

          {/* AI Agent Config */}
          <div className="bg-white rounded-2xl border border-slate-100 p-6 space-y-4">
            <h3 className="text-sm font-semibold text-slate-800">AI Agent Configuration</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Agent Name" value={form.agent_name} onChange={v => setForm(p => ({ ...p, agent_name: v }))} placeholder="Sarah" />
              <Field label="Voice ID" value={form.agent_voice_id} onChange={v => setForm(p => ({ ...p, agent_voice_id: v }))} placeholder="retell-Cimo" />
              <div className="col-span-1 sm:col-span-2">
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Prompt Template</label>
                <select value={form.prompt_template_id} onChange={e => setForm(p => ({ ...p, prompt_template_id: e.target.value }))}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-200">
                  <option value="">No template selected</option>
                  {templates.map(t => (
                    <option key={t.id} value={t.id}>{t.name} ({t.industry})</option>
                  ))}
                </select>
                {form.prompt_template_id && form.prompt_template_id !== firm.prompt_template_id && (
                  <p className="text-xs text-amber-600 mt-1.5">Template changed — save then click Sync Agent to push to Retell.</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Brand Color</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={form.brand_color} onChange={e => setForm(p => ({ ...p, brand_color: e.target.value }))}
                    className="w-10 h-10 rounded-lg border border-slate-100 cursor-pointer" />
                  <input type="text" value={form.brand_color} onChange={e => setForm(p => ({ ...p, brand_color: e.target.value }))}
                    className="flex-1 px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-200" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Sidebar */}
        <div className="space-y-4">

          {/* Agent Status */}
          <div className="bg-white rounded-2xl border border-slate-100 p-5 space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Agent Status</h3>

            <div className="space-y-3">
              <InfoRow icon={Bot} label="Agent ID" value={firm.retell_agent_id || 'Not deployed'} muted={!firm.retell_agent_id} />
              <InfoRow icon={Phone} label="Phone" value={firm.retell_phone_number || 'No phone assigned'} muted={!firm.retell_phone_number} />
            </div>

            {/* Sync Agent — only if deployed */}
            {isDeployed && (
              <div className="space-y-2 pt-1">
                <button onClick={handleSync} disabled={syncing}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-violet-600 text-white text-xs font-medium rounded-xl hover:bg-violet-700 disabled:opacity-50 transition-colors">
                  <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} />
                  {syncing ? 'Syncing...' : 'Sync Agent'}
                </button>
                {syncResult && (
                  <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium ${syncResult.error ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-700'}`}>
                    {syncResult.error
                      ? <><AlertCircle size={12} /> {syncResult.error}</>
                      : <><Check size={12} /> Synced — {syncResult.promptLength?.toLocaleString()} chars pushed</>
                    }
                  </div>
                )}
                <p className="text-[11px] text-slate-400 text-center">Re-renders prompt + pushes to Retell LLM</p>
              </div>
            )}

            {/* Deploy Agent — only if not deployed */}
            {!isDeployed && (
              <div className="pt-1">
                {!showDeploy ? (
                  <button onClick={() => setShowDeploy(true)}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 text-white text-xs font-medium rounded-xl hover:bg-slate-800 transition-colors">
                    <Rocket size={13} /> Deploy Agent
                  </button>
                ) : (
                  <div className="space-y-2">
                    <input type="text" placeholder="Area code (e.g. 425) — optional"
                      value={deployAreaCode} onChange={e => setDeployAreaCode(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-200" />
                    <div className="flex gap-2">
                      <button onClick={handleDeploy} disabled={deploying}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-900 text-white text-xs font-medium rounded-xl hover:bg-slate-800 disabled:opacity-50 transition-colors">
                        <Rocket size={12} /> {deploying ? 'Deploying...' : 'Deploy'}
                      </button>
                      <button onClick={() => setShowDeploy(false)}
                        className="px-3 py-2 text-xs text-slate-500 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Plan & Status */}
          <div className="bg-white rounded-2xl border border-slate-100 p-5 space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Plan & Status</h3>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Status</label>
              <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-200">
                {STATUSES.map(s => <option key={s} value={s} className="capitalize">{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Plan</label>
              <select value={form.plan} onChange={e => setForm(p => ({ ...p, plan: e.target.value }))}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-200">
                {PLANS.map(p => <option key={p} value={p} className="capitalize">{p}</option>)}
              </select>
            </div>
          </div>

          {/* Staff */}
          <div className="bg-white rounded-2xl border border-slate-100 p-5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
              Staff ({firm.staff?.length || 0})
            </h3>
            {firm.staff?.length > 0 ? (
              <div className="space-y-2">
                {firm.staff.map(s => (
                  <div key={s.id} className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded-xl">
                    <div>
                      <p className="text-sm font-medium text-slate-800">{s.name}</p>
                      <p className="text-xs text-slate-400">{s.specialization || s.role || ''}</p>
                    </div>
                    <span className={`w-2 h-2 rounded-full ${s.is_active ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400">No staff members</p>
            )}
          </div>

          {/* Current Rendered Prompt */}
          {firm.rendered_prompt && (
            <div className="bg-white rounded-2xl border border-slate-100 p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Live Prompt</h3>
                <span className="text-[11px] text-slate-400">{firm.rendered_prompt.length.toLocaleString()} chars</span>
              </div>
              <pre className="text-xs text-slate-600 whitespace-pre-wrap font-sans leading-relaxed max-h-48 overflow-y-auto bg-slate-50 rounded-xl p-3">
                {firm.rendered_prompt}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder = '' }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-400 mb-1.5">{label}</label>
      <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-200" />
    </div>
  );
}

function InfoRow({ icon: Icon, label, value, muted = false }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center shrink-0">
        <Icon size={14} className="text-slate-500" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] text-slate-400">{label}</p>
        <p className={`text-sm font-medium break-all ${muted ? 'text-slate-400 italic' : 'text-slate-800'}`}>{value}</p>
      </div>
    </div>
  );
}
