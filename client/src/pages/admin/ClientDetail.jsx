import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { fetchFirm, updateFirm } from '../../services/api';
import { ArrowLeft, Building2, Phone, Globe, MapPin, Clock, Bot, Palette, Save, Users, BarChart3, Calendar } from 'lucide-react';

export default function ClientDetail() {
  const { id } = useParams();
  const [firm, setFirm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    name: '', industry: '', email: '', phone: '', address: '',
    website: '', business_hours: '', agent_name: '', brand_color: '#6d28d9',
    status: 'active', plan: 'free',
  });

  useEffect(() => {
    async function load() {
      try {
        const data = await fetchFirm(id);
        setFirm(data);
        setForm({
          name: data.name || '',
          industry: data.industry || '',
          email: data.email || '',
          phone: data.phone || '',
          address: data.address || '',
          website: data.website || '',
          business_hours: data.business_hours || '',
          agent_name: data.agent_name || '',
          brand_color: data.brand_color || '#6d28d9',
          status: data.status || 'active',
          plan: data.plan || 'free',
        });
      } catch (err) {
        // error handled by UI state
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

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <Link to="/admin/clients" className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-600 transition-colors">
        <ArrowLeft size={15} /> Clients
      </Link>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-bold text-white" style={{ backgroundColor: firm.brand_color || '#6d28d9' }}>
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
          {saving ? 'Saving...' : saved ? 'Saved' : 'Save Changes'}
        </button>
      </div>

      {error && (
        <div className="px-4 py-3 bg-red-50 border border-red-100 rounded-xl">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-100 p-5 flex items-center gap-4">
          <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
            <BarChart3 size={18} className="text-blue-600" />
          </div>
          <div>
            <p className="text-2xl font-semibold text-slate-900">{firm._counts?.leads || 0}</p>
            <p className="text-sm text-slate-400">Leads</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 p-5 flex items-center gap-4">
          <div className="w-10 h-10 bg-violet-50 rounded-xl flex items-center justify-center">
            <Calendar size={18} className="text-violet-600" />
          </div>
          <div>
            <p className="text-2xl font-semibold text-slate-900">{firm._counts?.appointments || 0}</p>
            <p className="text-sm text-slate-400">Appointments</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 p-5 flex items-center gap-4">
          <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
            <Users size={18} className="text-emerald-600" />
          </div>
          <div>
            <p className="text-2xl font-semibold text-slate-900">{firm._counts?.staff || 0}</p>
            <p className="text-sm text-slate-400">Staff</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: Edit Form */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-100 p-6 space-y-4">
            <h3 className="text-sm font-semibold text-slate-800">Company Details</h3>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Name" value={form.name} onChange={v => setForm(p => ({ ...p, name: v }))} />
              <Field label="Industry" value={form.industry} onChange={v => setForm(p => ({ ...p, industry: v }))} />
              <Field label="Email" value={form.email} onChange={v => setForm(p => ({ ...p, email: v }))} />
              <Field label="Phone" value={form.phone} onChange={v => setForm(p => ({ ...p, phone: v }))} />
              <div className="col-span-2">
                <Field label="Address" value={form.address} onChange={v => setForm(p => ({ ...p, address: v }))} />
              </div>
              <Field label="Website" value={form.website} onChange={v => setForm(p => ({ ...p, website: v }))} />
              <Field label="Business Hours" value={form.business_hours} onChange={v => setForm(p => ({ ...p, business_hours: v }))} />
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 p-6 space-y-4">
            <h3 className="text-sm font-semibold text-slate-800">AI Agent</h3>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Agent Name" value={form.agent_name} onChange={v => setForm(p => ({ ...p, agent_name: v }))} />
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

        {/* Right: Sidebar Info */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-100 p-5 space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Agent Status</h3>
            <div className="space-y-3">
              <InfoRow icon={Bot} label="Agent ID" value={firm.retell_agent_id || 'Not deployed'} />
              <InfoRow icon={Phone} label="Phone" value={firm.retell_phone_number || 'No phone'} />
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 p-5 space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Plan & Status</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Status</label>
                <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-200">
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Plan</label>
                <select value={form.plan} onChange={e => setForm(p => ({ ...p, plan: e.target.value }))}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-200">
                  <option value="free">Free</option>
                  <option value="starter">Starter</option>
                  <option value="pro">Pro</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </div>
            </div>
          </div>

          {/* Staff List */}
          <div className="bg-white rounded-2xl border border-slate-100 p-5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Staff ({firm.staff?.length || 0})</h3>
            {firm.staff && firm.staff.length > 0 ? (
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

          {/* Rendered Prompt Preview */}
          {firm.rendered_prompt && (
            <div className="bg-white rounded-2xl border border-slate-100 p-5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Current Prompt</h3>
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

function Field({ label, value, onChange }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-400 mb-1.5">{label}</label>
      <input type="text" value={value} onChange={e => onChange(e.target.value)}
        className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-200" />
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center">
        <Icon size={14} className="text-slate-500" />
      </div>
      <div>
        <p className="text-[11px] text-slate-400">{label}</p>
        <p className="text-sm font-medium text-slate-800 break-all">{value}</p>
      </div>
    </div>
  );
}
