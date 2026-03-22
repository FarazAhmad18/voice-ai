import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createFirm, fetchTemplates } from '../../services/api';
import { ArrowLeft, Plus, X, Rocket, Check, Crown, Zap, TrendingUp } from 'lucide-react';

const PLANS = [
  {
    id: 'growth',
    label: 'Growth',
    price: '$899',
    icon: TrendingUp,
    color: 'blue',
    description: 'For businesses ready to automate calls and never miss a lead.',
    features: ['1,000 minutes/month', '1 AI voice agent', 'Full CRM dashboard', 'Lead tracking & scoring', 'Appointment booking', 'Custom agent script', 'Call transcripts', 'Email support'],
  },
  {
    id: 'scale',
    label: 'Scale',
    price: '$1,499',
    icon: Zap,
    color: 'violet',
    popular: true,
    description: 'For growing teams that need multiple agents and deeper insights.',
    features: ['3,000 minutes/month', '2 AI voice agents', 'Full CRM dashboard', 'Lead tracking & scoring', 'Appointment booking', 'Custom agent scripts', 'Call transcripts & analytics', 'Follow-up automation', 'Priority support'],
  },
  {
    id: 'enterprise',
    label: 'Enterprise',
    price: 'Custom',
    icon: Crown,
    color: 'amber',
    description: 'For large operations needing unlimited capacity and custom setup.',
    features: ['Unlimited minutes', 'Unlimited AI agents', 'Full CRM dashboard', 'Lead tracking & scoring', 'Appointment booking', 'Custom agent scripts', 'Advanced analytics & reporting', 'Follow-up automation', 'Custom integrations', 'Dedicated account manager'],
  },
];

const INDUSTRIES = [
  { value: 'legal', label: 'Legal / Law Firm' },
  { value: 'dental', label: 'Dental Clinic' },
  { value: 'plumbing', label: 'Plumbing / Home Services' },
  { value: 'real_estate', label: 'Real Estate' },
  { value: 'medical', label: 'Medical / Healthcare' },
  { value: 'other', label: 'Other' },
];

export default function ClientCreate() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    name: '',
    industry: 'legal',
    email: '',
    phone: '',
    address: '',
    website: '',
    business_hours: '9:00 AM - 5:00 PM, Monday - Friday',
    agent_name: 'Sarah',
    agent_voice_id: '',
    prompt_template_id: '',
    brand_color: '#6d28d9',
    plan: 'growth',
    admin_email: '',
    admin_name: '',
    admin_password: '',
    deploy_agent: false,
    area_code: '',
  });

  const [staffList, setStaffList] = useState([]);
  const [newStaff, setNewStaff] = useState({ name: '', role: '', specialization: '' });

  useEffect(() => {
    fetchTemplates().then(setTemplates).catch(() => {});
  }, []);

  // Auto-select template when industry changes
  useEffect(() => {
    const match = templates.find(t => t.industry === form.industry);
    if (match) {
      setForm(prev => ({ ...prev, prompt_template_id: match.id }));
    }
  }, [form.industry, templates]);

  function updateForm(field, value) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  function addStaff() {
    if (!newStaff.name.trim()) return;
    setStaffList(prev => [...prev, { ...newStaff, is_active: true }]);
    setNewStaff({ name: '', role: '', specialization: '' });
  }

  function removeStaff(index) {
    setStaffList(prev => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      const result = await createFirm({
        ...form,
        staff: staffList,
      });
      navigate(`/admin/clients/${result.id}`);
    } catch (err) {
      setError(err.message || 'Failed to create client');
    } finally {
      setSaving(false);
    }
  }

  const selectedTemplate = templates.find(t => t.id === form.prompt_template_id);

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <button onClick={() => navigate('/admin/clients')} className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-600 transition-colors">
        <ArrowLeft size={15} /> Back to Clients
      </button>

      <div>
        <h2 className="text-xl font-semibold text-slate-900 tracking-tight">Create New Client</h2>
        <p className="text-sm text-slate-400 mt-1">Set up a new business with an AI voice agent</p>
      </div>

      {error && (
        <div className="px-4 py-3 bg-red-50 border border-red-100 rounded-xl">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Company Info */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6 space-y-4">
          <h3 className="text-sm font-semibold text-slate-800">Company Information</h3>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Company Name *</label>
              <input type="text" required value={form.name} onChange={e => updateForm('name', e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-200" placeholder="Bright Smile Dental" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Industry *</label>
              <select value={form.industry} onChange={e => updateForm('industry', e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-200">
                {INDUSTRIES.map(i => <option key={i.value} value={i.value}>{i.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Brand Color</label>
              <div className="flex items-center gap-2">
                <input type="color" value={form.brand_color} onChange={e => updateForm('brand_color', e.target.value)}
                  className="w-10 h-10 rounded-lg border border-slate-100 cursor-pointer" />
                <input type="text" value={form.brand_color} onChange={e => updateForm('brand_color', e.target.value)}
                  className="flex-1 px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-200" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Email</label>
              <input type="email" value={form.email} onChange={e => updateForm('email', e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-200" placeholder="info@company.com" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Phone</label>
              <input type="tel" value={form.phone} onChange={e => updateForm('phone', e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-200" placeholder="+1 425-555-0100" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Address</label>
              <input type="text" value={form.address} onChange={e => updateForm('address', e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-200" placeholder="123 Main St, Suite 200" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Website</label>
              <input type="text" value={form.website} onChange={e => updateForm('website', e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-200" placeholder="www.company.com" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Business Hours</label>
              <input type="text" value={form.business_hours} onChange={e => updateForm('business_hours', e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-200" />
            </div>
          </div>
        </div>

        {/* AI Agent */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6 space-y-4">
          <h3 className="text-sm font-semibold text-slate-800">AI Agent Configuration</h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Agent Name</label>
              <input type="text" value={form.agent_name} onChange={e => updateForm('agent_name', e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-200" placeholder="Sarah" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Prompt Template</label>
              <select value={form.prompt_template_id} onChange={e => updateForm('prompt_template_id', e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-200">
                <option value="">Select template...</option>
                {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          </div>

          {selectedTemplate && (
            <div className="mt-3 px-4 py-3 bg-slate-50 rounded-xl">
              <p className="text-xs font-medium text-slate-500 mb-1">Prompt Preview</p>
              <pre className="text-xs text-slate-600 whitespace-pre-wrap font-sans leading-relaxed max-h-40 overflow-y-auto">
                {selectedTemplate.body.slice(0, 500)}{selectedTemplate.body.length > 500 ? '...' : ''}
              </pre>
            </div>
          )}
        </div>

        {/* Staff */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6 space-y-4">
          <h3 className="text-sm font-semibold text-slate-800">Staff Members</h3>
          <p className="text-xs text-slate-400">These names will appear in the AI agent's prompt.</p>

          {staffList.length > 0 && (
            <div className="space-y-2">
              {staffList.map((s, i) => (
                <div key={i} className="flex items-center justify-between px-4 py-2.5 bg-slate-50 rounded-xl">
                  <div>
                    <span className="text-sm font-medium text-slate-800">{s.name}</span>
                    {s.specialization && <span className="text-xs text-slate-400 ml-2">({s.specialization})</span>}
                  </div>
                  <button type="button" onClick={() => removeStaff(i)} className="p-1 text-slate-400 hover:text-red-500 transition-colors">
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2">
            <input type="text" placeholder="Name" value={newStaff.name} onChange={e => setNewStaff(p => ({ ...p, name: e.target.value }))}
              className="flex-1 px-3 py-2 text-sm bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-200 placeholder:text-slate-300"
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addStaff())} />
            <input type="text" placeholder="Specialization" value={newStaff.specialization} onChange={e => setNewStaff(p => ({ ...p, specialization: e.target.value }))}
              className="flex-1 px-3 py-2 text-sm bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-200 placeholder:text-slate-300"
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addStaff())} />
            <button type="button" onClick={addStaff} className="px-3 py-2 bg-slate-900 text-white text-xs font-medium rounded-xl hover:bg-slate-800 transition-colors">
              <Plus size={14} />
            </button>
          </div>
        </div>

        {/* Admin Login */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6 space-y-4">
          <h3 className="text-sm font-semibold text-slate-800">Client Admin Login</h3>
          <p className="text-xs text-slate-400">Create a login account for this client to access their dashboard.</p>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Admin Email</label>
              <input type="email" value={form.admin_email} onChange={e => updateForm('admin_email', e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-200" placeholder="admin@company.com" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Admin Name</label>
              <input type="text" value={form.admin_name} onChange={e => updateForm('admin_name', e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-200" placeholder="Dr. Chen" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Password</label>
              <input type="password" value={form.admin_password} onChange={e => updateForm('admin_password', e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-200" placeholder="Minimum 6 characters" />
            </div>
          </div>
        </div>

        {/* Plan Selection */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Plan</h3>
            <p className="text-xs text-slate-400 mt-0.5">Select the plan this client is on</p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {PLANS.map(plan => {
              const Icon = plan.icon;
              const selected = form.plan === plan.id;
              const colorMap = {
                blue:   { ring: 'ring-blue-500 border-blue-300', bg: 'bg-blue-600', badge: 'bg-blue-50 text-blue-600', icon: 'text-blue-500' },
                violet: { ring: 'ring-violet-500 border-violet-300', bg: 'bg-violet-600', badge: 'bg-violet-50 text-violet-600', icon: 'text-violet-500' },
                amber:  { ring: 'ring-amber-500 border-amber-300', bg: 'bg-amber-500', badge: 'bg-amber-50 text-amber-600', icon: 'text-amber-500' },
              };
              const c = colorMap[plan.color];
              return (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => updateForm('plan', plan.id)}
                  className={`relative text-left rounded-xl border-2 p-4 transition-all ${
                    selected ? `${c.ring} ring-2 bg-slate-50` : 'border-slate-100 hover:border-slate-200'
                  }`}
                >
                  {plan.popular && (
                    <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2.5 py-0.5 bg-violet-600 text-white text-[10px] font-bold rounded-full whitespace-nowrap">
                      Most Popular
                    </span>
                  )}
                  <div className="flex items-center justify-between mb-3">
                    <Icon size={16} className={c.icon} />
                    {selected && (
                      <div className={`w-5 h-5 rounded-full ${c.bg} flex items-center justify-center`}>
                        <Check size={11} className="text-white" />
                      </div>
                    )}
                  </div>
                  <p className="text-sm font-bold text-slate-900">{plan.label}</p>
                  <p className="text-base font-bold text-slate-900 mt-0.5">
                    {plan.price}
                    {plan.price !== 'Custom' && <span className="text-xs font-normal text-slate-400">/mo</span>}
                  </p>
                  <ul className="mt-3 space-y-1.5">
                    {plan.features.slice(0, 4).map((f, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <Check size={11} className={`${c.icon} mt-0.5 shrink-0`} />
                        <span className="text-[11px] text-slate-500 leading-tight">{f}</span>
                      </li>
                    ))}
                    {plan.features.length > 4 && (
                      <li className="text-[11px] text-slate-400 pl-4">+{plan.features.length - 4} more</li>
                    )}
                  </ul>
                </button>
              );
            })}
          </div>
        </div>

        {/* Submit */}
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={form.deploy_agent} onChange={e => updateForm('deploy_agent', e.target.checked)}
              className="rounded border-slate-300" />
            Deploy Retell agent now
          </label>
          <button type="submit" disabled={saving}
            className="inline-flex items-center gap-2 px-6 py-3 bg-slate-900 text-white text-sm font-medium rounded-xl hover:bg-slate-800 transition-colors disabled:opacity-50">
            <Rocket size={16} />
            {saving ? 'Creating...' : 'Create Client'}
          </button>
        </div>
      </form>
    </div>
  );
}
