import { useState, useEffect } from 'react';
import { fetchTemplates, createTemplate, updateTemplate, deleteTemplate } from '../../services/api';
import { FileText, Plus, Edit3, Trash2, X, Save, ChevronDown, ChevronUp } from 'lucide-react';

export default function TemplateList() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // template id being edited
  const [creating, setCreating] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [error, setError] = useState('');

  const [form, setForm] = useState({ name: '', industry: 'legal', body: '', case_types: '' });

  useEffect(() => {
    loadTemplates();
  }, []);

  async function loadTemplates() {
    try {
      const data = await fetchTemplates();
      setTemplates(data);
    } catch (err) {
      console.error('Failed to fetch templates:', err);
    } finally {
      setLoading(false);
    }
  }

  function startEdit(template) {
    setEditing(template.id);
    setCreating(false);
    setForm({
      name: template.name,
      industry: template.industry,
      body: template.body,
      case_types: Array.isArray(template.case_types) ? template.case_types.join(', ') : '',
    });
  }

  function startCreate() {
    setCreating(true);
    setEditing(null);
    setForm({ name: '', industry: 'legal', body: '', case_types: '' });
  }

  function cancel() {
    setEditing(null);
    setCreating(false);
  }

  async function handleSave() {
    setError('');
    const payload = {
      name: form.name,
      industry: form.industry,
      body: form.body,
      case_types: form.case_types.split(',').map(s => s.trim()).filter(Boolean),
    };

    try {
      if (creating) {
        await createTemplate(payload);
      } else {
        await updateTemplate(editing, payload);
      }
      cancel();
      await loadTemplates();
    } catch (err) {
      setError(err.message || 'Failed to save template');
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this template?')) return;
    setError('');
    try {
      await deleteTemplate(id);
      await loadTemplates();
    } catch (err) {
      setError(err.message || 'Failed to delete template');
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-6 h-6 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 tracking-tight">Prompt Templates</h2>
          <p className="text-sm text-slate-400 mt-1">Manage AI agent prompts by industry</p>
        </div>
        <button onClick={startCreate}
          className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-xl hover:bg-slate-800 transition-colors">
          <Plus size={15} /> New Template
        </button>
      </div>

      {error && (
        <div className="px-4 py-3 bg-red-50 border border-red-100 rounded-xl">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Create/Edit Form */}
      {(creating || editing) && (
        <div className="bg-white rounded-2xl border border-slate-100 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-800">{creating ? 'New Template' : 'Edit Template'}</h3>
            <button onClick={cancel} className="p-1 text-slate-400 hover:text-slate-600"><X size={16} /></button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Name</label>
              <input type="text" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-200" placeholder="Legal - Family Law" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Industry</label>
              <select value={form.industry} onChange={e => setForm(p => ({ ...p, industry: e.target.value }))}
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-200">
                <option value="legal">Legal</option>
                <option value="dental">Dental</option>
                <option value="plumbing">Plumbing</option>
                <option value="real_estate">Real Estate</option>
                <option value="medical">Medical</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Case Types (comma-separated)</label>
            <input type="text" value={form.case_types} onChange={e => setForm(p => ({ ...p, case_types: e.target.value }))}
              className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-200"
              placeholder="divorce, custody, support, other" />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Prompt Body
              <span className="text-slate-300 ml-2">Use {'{{agent_name}}'}, {'{{company_name}}'}, {'{{active_staff}}'}, {'{{business_hours}}'}, {'{{services}}'}</span>
            </label>
            <textarea value={form.body} onChange={e => setForm(p => ({ ...p, body: e.target.value }))}
              rows={14}
              className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-200 font-mono leading-relaxed"
              placeholder="You are {{agent_name}}, a professional AI assistant for {{company_name}}..." />
          </div>

          <div className="flex justify-end">
            <button onClick={handleSave}
              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-xs font-medium rounded-xl hover:bg-slate-800 transition-colors">
              <Save size={14} /> {creating ? 'Create Template' : 'Save Changes'}
            </button>
          </div>
        </div>
      )}

      {/* Template List */}
      {templates.length === 0 && !creating ? (
        <div className="bg-white rounded-2xl border border-slate-100 py-16 text-center">
          <FileText size={28} className="text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-400">No templates yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map((t) => (
            <div key={t.id} className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-slate-50/50 transition-colors"
                onClick={() => setExpanded(expanded === t.id ? null : t.id)}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-violet-50 rounded-xl flex items-center justify-center">
                    <FileText size={16} className="text-violet-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-800">{t.name}</p>
                    <p className="text-xs text-slate-400 capitalize">{t.industry} · {t.variables?.length || 0} variables</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={(e) => { e.stopPropagation(); startEdit(t); }}
                    className="p-2 text-slate-400 hover:text-blue-600 transition-colors">
                    <Edit3 size={14} />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); handleDelete(t.id); }}
                    className="p-2 text-slate-400 hover:text-red-500 transition-colors">
                    <Trash2 size={14} />
                  </button>
                  {expanded === t.id ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
                </div>
              </div>
              {expanded === t.id && (
                <div className="px-5 pb-4 border-t border-slate-50">
                  <pre className="mt-3 text-xs text-slate-600 whitespace-pre-wrap font-sans leading-relaxed bg-slate-50 rounded-xl p-4 max-h-64 overflow-y-auto">
                    {t.body}
                  </pre>
                  {t.case_types && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {(Array.isArray(t.case_types) ? t.case_types : []).map(ct => (
                        <span key={ct} className="px-2.5 py-1 bg-slate-50 rounded-lg text-xs text-slate-500 capitalize">{ct}</span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
