import { useState, useEffect } from 'react';
import { fetchTemplates, createTemplate, updateTemplate, deleteTemplate, fetchFirms, previewTemplate as renderTemplatePreview } from '../../services/api';
import { FileText, Plus, Edit3, Trash2, X, Save, ChevronDown, ChevronUp, Eye, Copy, Check, AlertCircle } from 'lucide-react';
import ConfirmModal from '../../components/ConfirmModal';

export default function TemplateList() {
  const [templates, setTemplates] = useState([]);
  const [firms, setFirms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [error, setError] = useState('');
  const [confirmDeleteTemplate, setConfirmDeleteTemplate] = useState(null); // template to delete
  const [deletingTemplate, setDeletingTemplate] = useState(false);

  // Preview state
  const [previewTemplateData, setPreviewTemplateState] = useState(null); // template being previewed
  const [previewFirmId, setPreviewFirmId] = useState('');
  const [previewResult, setPreviewResult] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [copied, setCopied] = useState(false);

  const [form, setForm] = useState({ name: '', industry: 'legal', body: '', case_types: '' });

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    try {
      const [tmplData, firmData] = await Promise.all([fetchTemplates(), fetchFirms()]);
      setTemplates(tmplData);
      setFirms(firmData);
      if (firmData.length > 0) setPreviewFirmId(firmData[0].id);
    } catch {
      // errors shown via UI state
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
      await loadAll();
    } catch (err) {
      setError(err.message || 'Failed to save template');
    }
  }

  async function handleDelete(tmpl) {
    setDeletingTemplate(true);
    setConfirmDeleteTemplate(null);
    setError('');
    try {
      await deleteTemplate(tmpl.id);
      await loadAll();
    } catch (err) {
      setError(err.message || 'Failed to delete template');
    } finally {
      setDeletingTemplate(false);
    }
  }

  function openPreview(tmpl) {
    setPreviewTemplateState(tmpl);
    setPreviewResult(null);
    setPreviewError('');
    setCopied(false);
    if (firms.length > 0 && !previewFirmId) setPreviewFirmId(firms[0].id);
  }

  function closePreview() {
    setPreviewTemplateState(null);
    setPreviewResult(null);
    setPreviewError('');
  }

  async function runPreview() {
    if (!previewFirmId) return;
    setPreviewLoading(true);
    setPreviewError('');
    setPreviewResult(null);
    try {
      const result = await renderTemplatePreview(previewTemplateData.id, previewFirmId);
      setPreviewResult(result);
    } catch (err) {
      setPreviewError(err.message || 'Preview failed');
    } finally {
      setPreviewLoading(false);
    }
  }

  function copyPrompt() {
    if (!previewResult?.rendered) return;
    navigator.clipboard.writeText(previewResult.rendered).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-6 h-6 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <>
      <ConfirmModal
        open={!!confirmDeleteTemplate}
        onCancel={() => setConfirmDeleteTemplate(null)}
        onConfirm={() => handleDelete(confirmDeleteTemplate)}
        loading={deletingTemplate}
        danger
        title={`Delete "${confirmDeleteTemplate?.name}"?`}
        message="This prompt template will be permanently deleted. Clients using it will not be affected until their next prompt re-render."
        confirmLabel="Delete Template"
      />

      <div className="max-w-4xl mx-auto space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-zinc-100 tracking-tight">Prompt Templates</h2>
            <p className="text-sm text-slate-400 dark:text-zinc-500 mt-1">Manage AI agent prompts by industry</p>
          </div>
          <button onClick={startCreate}
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors">
            <Plus size={15} /> New Template
          </button>
        </div>

        {error && (
          <div className="px-4 py-3 bg-red-50 dark:bg-red-900/30 border border-red-100 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Create/Edit Form */}
        {(creating || editing) && (
          <div className="bg-white dark:bg-zinc-900 rounded-lg border border-slate-100 dark:border-zinc-800 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-800 dark:text-zinc-200">{creating ? 'New Template' : 'Edit Template'}</h3>
              <button onClick={cancel} className="p-1 text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-400"><X size={16} /></button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 dark:text-zinc-500 mb-1.5">Name</label>
                <input type="text" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-200 dark:focus:ring-zinc-700" placeholder="Legal - Family Law" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 dark:text-zinc-500 mb-1.5">Industry</label>
                <select value={form.industry} onChange={e => setForm(p => ({ ...p, industry: e.target.value }))}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-200 dark:focus:ring-zinc-700">
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
              <label className="block text-xs font-medium text-slate-400 dark:text-zinc-500 mb-1.5">Case Types (comma-separated)</label>
              <input type="text" value={form.case_types} onChange={e => setForm(p => ({ ...p, case_types: e.target.value }))}
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-200 dark:focus:ring-zinc-700"
                placeholder="divorce, custody, support, other" />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 dark:text-zinc-500 mb-1.5">
                Prompt Body
                <span className="text-slate-300 dark:text-zinc-600 ml-2">Use {'{{agent_name}}'}, {'{{company_name}}'}, {'{{active_staff}}'}, {'{{business_hours}}'}, {'{{services}}'}</span>
              </label>
              <textarea value={form.body} onChange={e => setForm(p => ({ ...p, body: e.target.value }))}
                rows={14}
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-200 dark:focus:ring-zinc-700 font-mono leading-relaxed"
                placeholder="You are {{agent_name}}, a professional AI assistant for {{company_name}}..." />
            </div>

            <div className="flex justify-end">
              <button onClick={handleSave}
                className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-xs font-medium rounded-lg hover:bg-slate-800 transition-colors">
                <Save size={14} /> {creating ? 'Create Template' : 'Save Changes'}
              </button>
            </div>
          </div>
        )}

        {/* Template List */}
        {templates.length === 0 && !creating ? (
          <div className="bg-white dark:bg-zinc-900 rounded-lg border border-slate-100 dark:border-zinc-800 py-16 text-center">
            <FileText size={28} className="text-slate-300 dark:text-zinc-600 mx-auto mb-3" />
            <p className="text-sm text-slate-400 dark:text-zinc-500">No templates yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {templates.map((t) => (
              <div key={t.id} className="bg-white dark:bg-zinc-900 rounded-lg border border-slate-100 dark:border-zinc-800 overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-colors"
                  onClick={() => setExpanded(expanded === t.id ? null : t.id)}>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-violet-50 dark:bg-violet-900/30 rounded-lg flex items-center justify-center">
                      <FileText size={16} className="text-violet-600 dark:text-violet-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-800 dark:text-zinc-200">{t.name}</p>
                      <p className="text-xs text-slate-400 dark:text-zinc-500 capitalize">{t.industry} · {t.variables?.length || 0} variables · {t.body?.length || 0} chars</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={(e) => { e.stopPropagation(); openPreview(t); }}
                      className="p-2 text-slate-400 dark:text-zinc-500 hover:text-violet-600 dark:hover:text-violet-400 transition-colors" title="Preview rendered output">
                      <Eye size={14} />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); startEdit(t); }}
                      className="p-2 text-slate-400 dark:text-zinc-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                      <Edit3 size={14} />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); setConfirmDeleteTemplate(t); }}
                      className="p-2 text-slate-400 dark:text-zinc-500 hover:text-red-500 transition-colors">
                      <Trash2 size={14} />
                    </button>
                    {expanded === t.id ? <ChevronUp size={14} className="text-slate-400 dark:text-zinc-500" /> : <ChevronDown size={14} className="text-slate-400 dark:text-zinc-500" />}
                  </div>
                </div>
                {expanded === t.id && (
                  <div className="px-5 pb-4 border-t border-slate-50 dark:border-zinc-800/50">
                    <pre className="mt-3 text-xs text-slate-600 dark:text-zinc-500 whitespace-pre-wrap font-sans leading-relaxed bg-slate-50 dark:bg-zinc-900 rounded-lg p-4 max-h-64 overflow-y-auto">
                      {t.body}
                    </pre>
                    {t.case_types && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {(Array.isArray(t.case_types) ? t.case_types : []).map(ct => (
                          <span key={ct} className="px-2.5 py-1 bg-slate-50 dark:bg-zinc-900 rounded-lg text-xs text-slate-500 dark:text-zinc-500 capitalize">{ct}</span>
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

      {/* Preview Modal */}
      {previewTemplateData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closePreview} />
          <div className="relative bg-white dark:bg-zinc-900 rounded-lg shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-zinc-800">
              <div>
                <h3 className="text-sm font-semibold text-slate-800 dark:text-zinc-200">Prompt Preview</h3>
                <p className="text-xs text-slate-400 dark:text-zinc-500 mt-0.5">{previewTemplateData.name}</p>
              </div>
              <button onClick={closePreview} className="p-1.5 text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-400 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800/50 transition-colors">
                <X size={16} />
              </button>
            </div>

            {/* Firm Selector */}
            <div className="px-6 py-4 border-b border-slate-100 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50">
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-slate-500 dark:text-zinc-500 mb-1.5">Render for client</label>
                  {firms.length === 0 ? (
                    <p className="text-xs text-slate-400 dark:text-zinc-500 italic">No clients yet — create a client first to preview</p>
                  ) : (
                    <select
                      value={previewFirmId}
                      onChange={e => { setPreviewFirmId(e.target.value); setPreviewResult(null); }}
                      className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-200 dark:focus:ring-zinc-700">
                      {firms.map(f => (
                        <option key={f.id} value={f.id}>{f.name} ({f.industry})</option>
                      ))}
                    </select>
                  )}
                </div>
                <button
                  onClick={runPreview}
                  disabled={!previewFirmId || previewLoading || firms.length === 0}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap">
                  {previewLoading ? (
                    <><div className="w-4 h-4 border-2 border-white dark:border-zinc-900 border-t-transparent rounded-full animate-spin" /> Rendering...</>
                  ) : (
                    <><Eye size={14} /> Render Preview</>
                  )}
                </button>
              </div>
            </div>

            {/* Result */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {previewError && (
                <div className="flex items-start gap-2 px-4 py-3 bg-red-50 dark:bg-red-900/30 border border-red-100 dark:border-red-800 rounded-lg mb-4">
                  <AlertCircle size={15} className="text-red-500 mt-0.5 shrink-0" />
                  <p className="text-sm text-red-600 dark:text-red-400">{previewError}</p>
                </div>
              )}

              {!previewResult && !previewError && !previewLoading && (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Eye size={28} className="text-slate-200 dark:text-zinc-700 mb-3" />
                  <p className="text-sm text-slate-400 dark:text-zinc-500">Select a client and click Render Preview</p>
                  <p className="text-xs text-slate-300 dark:text-zinc-600 mt-1">Shows exactly what gets pushed to Retell on sync</p>
                </div>
              )}

              {previewResult && (
                <div className="space-y-4">
                  {/* Stats row */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="bg-slate-50 dark:bg-zinc-900 rounded-lg px-4 py-3 text-center">
                      <p className="text-lg font-semibold text-slate-800 dark:text-zinc-200">{previewResult.prompt_length.toLocaleString()}</p>
                      <p className="text-xs text-slate-400 dark:text-zinc-500 mt-0.5">characters</p>
                    </div>
                    <div className="bg-slate-50 dark:bg-zinc-900 rounded-lg px-4 py-3 text-center">
                      <p className="text-lg font-semibold text-slate-800 dark:text-zinc-200">{previewResult.staff_count}</p>
                      <p className="text-xs text-slate-400 dark:text-zinc-500 mt-0.5">staff injected</p>
                    </div>
                    <div className="bg-slate-50 dark:bg-zinc-900 rounded-lg px-4 py-3 text-center">
                      <p className="text-lg font-semibold text-slate-800 dark:text-zinc-200">{previewResult.knowledge_count}</p>
                      <p className="text-xs text-slate-400 dark:text-zinc-500 mt-0.5">FAQ entries</p>
                    </div>
                  </div>

                  {/* Rendered prompt */}
                  <div className="relative">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-medium text-slate-500 dark:text-zinc-500">Rendered for <span className="text-slate-700 dark:text-zinc-300">{previewResult.firm_name}</span></p>
                      <button
                        onClick={copyPrompt}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-500 dark:text-zinc-500 hover:text-slate-700 dark:hover:text-zinc-300 bg-slate-100 dark:bg-zinc-800/50 hover:bg-slate-200 dark:hover:bg-zinc-700 rounded-lg transition-colors">
                        {copied ? <><Check size={12} className="text-green-500" /> Copied</> : <><Copy size={12} /> Copy</>}
                      </button>
                    </div>
                    <pre className="text-xs text-slate-700 dark:text-zinc-300 whitespace-pre-wrap font-sans leading-relaxed bg-slate-50 dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 rounded-lg p-4 max-h-96 overflow-y-auto">
                      {previewResult.rendered}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
