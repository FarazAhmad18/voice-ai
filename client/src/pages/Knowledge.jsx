import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { fetchKnowledge, createKnowledge, updateKnowledge, deleteKnowledge } from '../services/api';
import { toast } from 'sonner';
import {
  Brain, Plus, Search, Edit3, Trash2, GripVertical,
  ToggleLeft, ToggleRight, MessageCircleQuestion, Sparkles,
  X, ChevronDown, Loader2, BookOpen, Hash, CheckCircle,
} from 'lucide-react';

/* ─── Inject keyframe styles once ─── */
const STYLE_ID = '__knowledge-premium-styles';
if (typeof document !== 'undefined' && !document.getElementById(STYLE_ID)) {
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    @keyframes knowledgeFadeInUp {
      from { opacity: 0; transform: translateY(16px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes knowledgeShimmer {
      0%   { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }
    @keyframes knowledgeSlideIn {
      from { opacity: 0; transform: translateY(-8px) scale(0.98); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }
    @keyframes knowledgePopIn {
      from { opacity: 0; transform: scale(0.95); }
      to   { opacity: 1; transform: scale(1); }
    }
    .knowledge-fade-in-up {
      animation: knowledgeFadeInUp 0.4s ease forwards;
      opacity: 0;
    }
    .knowledge-shimmer {
      background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%);
      background-size: 200% 100%;
      animation: knowledgeShimmer 1.5s ease-in-out infinite;
    }
    .knowledge-slide-in {
      animation: knowledgeSlideIn 0.3s ease forwards;
    }
    .knowledge-pop-in {
      animation: knowledgePopIn 0.25s ease forwards;
    }
  `;
  document.head.appendChild(style);
}

const CATEGORIES = [
  { value: 'all', label: 'All' },
  { value: 'general', label: 'General' },
  { value: 'services', label: 'Services' },
  { value: 'pricing', label: 'Pricing' },
  { value: 'location', label: 'Location' },
  { value: 'hours', label: 'Hours' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'policies', label: 'Policies' },
  { value: 'other', label: 'Other' },
];

const CATEGORY_COLORS = {
  general: { bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-l-slate-400', ring: 'ring-slate-100', dot: 'bg-slate-400' },
  services: { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-l-violet-500', ring: 'ring-violet-100', dot: 'bg-violet-500' },
  pricing: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-l-emerald-500', ring: 'ring-emerald-100', dot: 'bg-emerald-500' },
  location: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-l-blue-500', ring: 'ring-blue-100', dot: 'bg-blue-500' },
  hours: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-l-amber-500', ring: 'ring-amber-100', dot: 'bg-amber-500' },
  insurance: { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-l-teal-500', ring: 'ring-teal-100', dot: 'bg-teal-500' },
  policies: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-l-rose-500', ring: 'ring-rose-100', dot: 'bg-rose-500' },
  other: { bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-l-slate-300', ring: 'ring-slate-100', dot: 'bg-slate-400' },
};

function getCategoryColor(cat) {
  return CATEGORY_COLORS[cat] || CATEGORY_COLORS.other;
}

const EMPTY_FORM = { question: '', answer: '', category: 'general' };

export default function Knowledge() {
  const { user } = useAuth();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [togglingId, setTogglingId] = useState(null);
  const answerRef = useRef(null);

  useEffect(() => {
    loadEntries();
  }, []);

  async function loadEntries() {
    try {
      const data = await fetchKnowledge();
      setEntries(Array.isArray(data) ? data : []);
    } catch (err) {
      toast.error('Failed to load knowledge base');
    } finally {
      setLoading(false);
    }
  }

  function openAddForm() {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    setShowForm(true);
  }

  function openEditForm(entry) {
    setEditingId(entry.id);
    setForm({
      question: entry.question || '',
      answer: entry.answer || '',
      category: entry.category || 'general',
    });
    setShowForm(true);
  }

  function cancelForm() {
    setShowForm(false);
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.question.trim() || !form.answer.trim()) {
      toast.error('Question and answer are required');
      return;
    }
    setSubmitting(true);
    try {
      if (editingId) {
        const updated = await updateKnowledge(editingId, form);
        setEntries(prev => prev.map(e => e.id === editingId ? { ...e, ...updated } : e));
        toast.success('Entry updated');
      } else {
        const created = await createKnowledge(form);
        setEntries(prev => [created, ...prev]);
        toast.success('Entry added');
      }
      cancelForm();
    } catch (err) {
      toast.error(err.message || 'Failed to save entry');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id) {
    setDeletingId(id);
    try {
      await deleteKnowledge(id);
      setEntries(prev => prev.filter(e => e.id !== id));
      toast.success('Entry deleted');
      if (editingId === id) cancelForm();
    } catch (err) {
      toast.error('Failed to delete entry');
    } finally {
      setDeletingId(null);
    }
  }

  async function handleToggle(entry) {
    setTogglingId(entry.id);
    try {
      const updated = await updateKnowledge(entry.id, { is_active: !entry.is_active });
      setEntries(prev => prev.map(e => e.id === entry.id ? { ...e, ...updated, is_active: !entry.is_active } : e));
      toast.success(entry.is_active ? 'Entry deactivated' : 'Entry activated');
    } catch (err) {
      toast.error('Failed to update entry');
    } finally {
      setTogglingId(null);
    }
  }

  // Auto-grow textarea
  function handleAnswerChange(e) {
    setForm(p => ({ ...p, answer: e.target.value }));
    if (answerRef.current) {
      answerRef.current.style.height = 'auto';
      answerRef.current.style.height = answerRef.current.scrollHeight + 'px';
    }
  }

  // Filtered entries
  const filtered = entries.filter(e => {
    if (activeCategory !== 'all' && e.category !== activeCategory) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (e.question || '').toLowerCase().includes(q) || (e.answer || '').toLowerCase().includes(q);
    }
    return true;
  });

  // Stats
  const totalEntries = entries.length;
  const activeEntries = entries.filter(e => e.is_active !== false).length;
  const categoriesUsed = new Set(entries.map(e => e.category || 'general')).size;

  // Skeleton loading
  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header skeleton */}
        <div className="knowledge-shimmer h-32 rounded-2xl" />
        {/* Stats skeleton */}
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="knowledge-shimmer h-20 rounded-xl" />
          ))}
        </div>
        {/* Filter skeleton */}
        <div className="knowledge-shimmer h-12 rounded-xl" />
        {/* Cards skeleton */}
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="knowledge-shimmer h-28 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="knowledge-fade-in-up" style={{ animationDelay: '0ms' }}>
        <div className="bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 rounded-2xl shadow-lg shadow-violet-200/50 px-8 py-7 relative overflow-hidden">
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/4" />

          <div className="relative flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-white/15 rounded-xl flex items-center justify-center backdrop-blur-sm">
                  <Brain size={20} className="text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-white">AI Knowledge Base</h1>
                  <p className="text-sm text-white/60">Teach your AI assistant about your business</p>
                </div>
              </div>
            </div>
            <button
              onClick={openAddForm}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-white/15 hover:bg-white/25 backdrop-blur-sm text-white text-sm font-semibold rounded-xl border border-white/20 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
            >
              <Plus size={16} />
              Add Entry
            </button>
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div className="knowledge-fade-in-up grid grid-cols-3 gap-4" style={{ animationDelay: '50ms' }}>
        <div className="bg-white rounded-xl border border-slate-200/60 shadow-sm px-5 py-4 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-violet-50 rounded-lg flex items-center justify-center">
              <BookOpen size={16} className="text-violet-500" />
            </div>
            <div>
              <p className="text-xl font-bold text-slate-900">{totalEntries}</p>
              <p className="text-xs text-slate-400">Total Entries</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200/60 shadow-sm px-5 py-4 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-emerald-50 rounded-lg flex items-center justify-center">
              <CheckCircle size={16} className="text-emerald-500" />
            </div>
            <div>
              <p className="text-xl font-bold text-slate-900">{activeEntries}</p>
              <p className="text-xs text-slate-400">Active Entries</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200/60 shadow-sm px-5 py-4 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center">
              <Hash size={16} className="text-blue-500" />
            </div>
            <div>
              <p className="text-xl font-bold text-slate-900">{categoriesUsed}</p>
              <p className="text-xs text-slate-400">Categories Used</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search + Category Filter */}
      <div className="knowledge-fade-in-up space-y-3" style={{ animationDelay: '100ms' }}>
        {/* Search */}
        <div className="relative">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" />
          <input
            type="text"
            placeholder="Search questions and answers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-11 pr-4 py-3 text-sm bg-white border border-slate-200/60 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-300 placeholder:text-slate-300 transition-all"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-300 hover:text-slate-500 transition-colors"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Category tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
          {CATEGORIES.map(cat => {
            const active = activeCategory === cat.value;
            const colors = cat.value !== 'all' ? getCategoryColor(cat.value) : null;
            return (
              <button
                key={cat.value}
                onClick={() => setActiveCategory(cat.value)}
                className={`flex-shrink-0 px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-200 ${
                  active
                    ? cat.value === 'all'
                      ? 'bg-slate-900 text-white shadow-sm'
                      : `${colors.bg} ${colors.text} ring-1 ${colors.ring}`
                    : 'bg-white text-slate-400 hover:text-slate-600 hover:bg-slate-50 border border-slate-100'
                }`}
              >
                {cat.label}
                {cat.value !== 'all' && (
                  <span className="ml-1.5 opacity-60">
                    {entries.filter(e => (e.category || 'general') === cat.value).length}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <div className="knowledge-slide-in bg-white rounded-2xl border border-violet-200/60 shadow-lg shadow-violet-100/30 overflow-hidden">
          <div className="bg-gradient-to-r from-violet-500 to-purple-500 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 bg-white/15 rounded-lg flex items-center justify-center">
                <Sparkles size={14} className="text-white" />
              </div>
              <h3 className="text-sm font-bold text-white">
                {editingId ? 'Edit Entry' : 'Add New Entry'}
              </h3>
            </div>
            <button
              onClick={cancelForm}
              className="p-1.5 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X size={14} className="text-white" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Question
              </label>
              <div className="relative">
                <MessageCircleQuestion size={14} className="absolute left-3.5 top-3.5 text-slate-300" />
                <input
                  type="text"
                  value={form.question}
                  onChange={(e) => setForm(p => ({ ...p, question: e.target.value }))}
                  placeholder="e.g., What are your office hours?"
                  autoFocus
                  className="w-full pl-10 pr-4 py-3 text-sm bg-slate-50/80 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-300 focus:bg-white placeholder:text-slate-300 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Answer
              </label>
              <textarea
                ref={answerRef}
                value={form.answer}
                onChange={handleAnswerChange}
                placeholder="e.g., We are open Monday through Friday, 9 AM to 5 PM."
                rows={3}
                className="w-full px-4 py-3 text-sm bg-slate-50/80 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-300 focus:bg-white placeholder:text-slate-300 transition-all resize-none"
                style={{ minHeight: '80px' }}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Category
              </label>
              <div className="relative">
                <select
                  value={form.category}
                  onChange={(e) => setForm(p => ({ ...p, category: e.target.value }))}
                  className="w-full px-4 py-3 text-sm bg-slate-50/80 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-300 focus:bg-white transition-all appearance-none cursor-pointer"
                >
                  {CATEGORIES.filter(c => c.value !== 'all').map(c => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={cancelForm}
                className="px-5 py-2.5 text-sm font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-xl transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !form.question.trim() || !form.answer.trim()}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600 text-white text-sm font-semibold rounded-xl shadow-sm shadow-violet-300/30 transition-all duration-200 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Saving...
                  </>
                ) : editingId ? 'Update Entry' : 'Add Entry'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Entry list */}
      {filtered.length === 0 ? (
        <div className="knowledge-fade-in-up bg-white rounded-2xl border border-slate-200/60 shadow-sm px-8 py-16 text-center" style={{ animationDelay: '150ms' }}>
          <div className="w-16 h-16 bg-gradient-to-br from-violet-50 to-purple-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Brain size={28} className="text-violet-300" />
          </div>
          {entries.length === 0 ? (
            <>
              <h3 className="text-base font-semibold text-slate-700 mb-2">No knowledge entries yet</h3>
              <p className="text-sm text-slate-400 max-w-md mx-auto mb-6">
                Add questions and answers to help your AI assistant respond to callers with accurate information about your business.
              </p>
              <button
                onClick={openAddForm}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-violet-500 to-purple-500 text-white text-sm font-semibold rounded-xl shadow-sm shadow-violet-200/50 hover:shadow-md hover:from-violet-600 hover:to-purple-600 transition-all duration-200"
              >
                <Plus size={16} />
                Add Your First Entry
              </button>
            </>
          ) : (
            <>
              <h3 className="text-base font-semibold text-slate-700 mb-2">No matches found</h3>
              <p className="text-sm text-slate-400">
                Try adjusting your search or category filter.
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((entry, index) => {
            const colors = getCategoryColor(entry.category || 'general');
            const isInactive = entry.is_active === false;
            return (
              <div
                key={entry.id}
                className={`knowledge-fade-in-up group bg-white rounded-xl border border-slate-200/60 shadow-sm overflow-hidden transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 border-l-[3px] ${colors.border} ${isInactive ? 'opacity-60' : ''}`}
                style={{ animationDelay: `${150 + index * 40}ms` }}
              >
                <div className="flex items-start gap-3 px-5 py-4">
                  {/* Drag handle (cosmetic) */}
                  <div className="flex-shrink-0 pt-1 opacity-0 group-hover:opacity-40 transition-opacity cursor-grab">
                    <GripVertical size={14} className="text-slate-400" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold text-slate-800 ${isInactive ? 'line-through' : ''}`}>
                          {entry.question}
                        </p>
                        <p className="text-sm text-slate-500 mt-1 leading-relaxed whitespace-pre-wrap">
                          {entry.answer}
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => openEditForm(entry)}
                          className="p-2 text-slate-400 hover:text-violet-500 hover:bg-violet-50 rounded-lg transition-all"
                          title="Edit"
                        >
                          <Edit3 size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(entry.id)}
                          disabled={deletingId === entry.id}
                          className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all disabled:opacity-50"
                          title="Delete"
                        >
                          {deletingId === entry.id ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <Trash2 size={14} />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Bottom: category badge + toggle */}
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold capitalize ${colors.bg} ${colors.text} ring-1 ${colors.ring}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
                        {entry.category || 'general'}
                      </span>

                      <button
                        onClick={() => handleToggle(entry)}
                        disabled={togglingId === entry.id}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all duration-200 ${
                          isInactive
                            ? 'text-slate-400 bg-slate-50 hover:bg-slate-100'
                            : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                        } disabled:opacity-50`}
                      >
                        {togglingId === entry.id ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : isInactive ? (
                          <ToggleLeft size={14} />
                        ) : (
                          <ToggleRight size={14} />
                        )}
                        {isInactive ? 'Inactive' : 'Active'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Result count */}
      {filtered.length > 0 && (
        <div className="knowledge-fade-in-up text-center pb-4" style={{ animationDelay: '200ms' }}>
          <p className="text-xs text-slate-400">
            Showing {filtered.length} of {totalEntries} entries
          </p>
        </div>
      )}
    </div>
  );
}
