import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { fetchKnowledge, createKnowledge, updateKnowledge, deleteKnowledge } from '../services/api';
import { toast } from 'sonner';
import ConfirmModal from '../components/ConfirmModal';
import {
  Brain, Plus, Search, Edit3, Trash2, GripVertical,
  ToggleLeft, ToggleRight, MessageCircleQuestion, Sparkles,
  X, ChevronDown, Loader2, BookOpen, Hash, CheckCircle,
} from 'lucide-react';


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
  general: { bg: 'bg-slate-50 dark:bg-zinc-900', text: 'text-slate-700 dark:text-zinc-300', border: 'border-l-slate-400', ring: 'ring-slate-100 dark:ring-zinc-800', dot: 'bg-slate-400' },
  services: { bg: 'bg-violet-50 dark:bg-violet-900/30', text: 'text-violet-700 dark:text-violet-400', border: 'border-l-violet-500', ring: 'ring-violet-100', dot: 'bg-violet-500' },
  pricing: { bg: 'bg-emerald-50 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400', border: 'border-l-emerald-500', ring: 'ring-emerald-100', dot: 'bg-emerald-500' },
  location: { bg: 'bg-blue-50 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400', border: 'border-l-blue-500', ring: 'ring-blue-100', dot: 'bg-blue-500' },
  hours: { bg: 'bg-amber-50 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400', border: 'border-l-amber-500', ring: 'ring-amber-100', dot: 'bg-amber-500' },
  insurance: { bg: 'bg-teal-50 dark:bg-teal-900/30', text: 'text-teal-700 dark:text-teal-400', border: 'border-l-teal-500', ring: 'ring-teal-100', dot: 'bg-teal-500' },
  policies: { bg: 'bg-rose-50 dark:bg-rose-900/30', text: 'text-rose-700 dark:text-rose-400', border: 'border-l-rose-500', ring: 'ring-rose-100', dot: 'bg-rose-500' },
  other: { bg: 'bg-slate-50 dark:bg-zinc-900', text: 'text-slate-600 dark:text-zinc-500', border: 'border-l-slate-300', ring: 'ring-slate-100 dark:ring-zinc-800', dot: 'bg-slate-400' },
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
  const [confirmDeleteEntry, setConfirmDeleteEntry] = useState(null); // entry to delete
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
        <div className="skeleton-shimmer h-32 rounded-lg" />
        {/* Stats skeleton */}
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="skeleton-shimmer h-20 rounded-lg" />
          ))}
        </div>
        {/* Filter skeleton */}
        <div className="skeleton-shimmer h-12 rounded-lg" />
        {/* Cards skeleton */}
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="skeleton-shimmer h-28 rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <ConfirmModal
        open={!!confirmDeleteEntry}
        onCancel={() => setConfirmDeleteEntry(null)}
        onConfirm={() => { handleDelete(confirmDeleteEntry.id); setConfirmDeleteEntry(null); }}
        loading={deletingId === confirmDeleteEntry?.id}
        danger
        title="Delete knowledge entry?"
        message="This entry will be permanently removed from the AI knowledge base."
        confirmLabel="Delete"
      />

      {/* Header */}
      <div>
        <div className="bg-violet-600 rounded-lg px-8 py-7 overflow-hidden">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-white/15 rounded-lg flex items-center justify-center">
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
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-white/15 hover:bg-white/25 text-white text-sm font-semibold rounded-lg border border-white/20 transition-all duration-200"
            >
              <Plus size={16} />
              Add Entry
            </button>
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white dark:bg-zinc-900 rounded-lg border border-slate-200/60 dark:border-zinc-700 shadow-sm px-5 py-4 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-violet-50 dark:bg-violet-900/30 rounded-lg flex items-center justify-center">
              <BookOpen size={16} className="text-violet-500" />
            </div>
            <div>
              <p className="text-xl font-bold text-slate-900 dark:text-zinc-100">{totalEntries}</p>
              <p className="text-xs text-slate-400 dark:text-zinc-500">Total Entries</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-zinc-900 rounded-lg border border-slate-200/60 dark:border-zinc-700 shadow-sm px-5 py-4 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-emerald-50 dark:bg-emerald-900/30 rounded-lg flex items-center justify-center">
              <CheckCircle size={16} className="text-emerald-500" />
            </div>
            <div>
              <p className="text-xl font-bold text-slate-900 dark:text-zinc-100">{activeEntries}</p>
              <p className="text-xs text-slate-400 dark:text-zinc-500">Active Entries</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-zinc-900 rounded-lg border border-slate-200/60 dark:border-zinc-700 shadow-sm px-5 py-4 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-50 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
              <Hash size={16} className="text-blue-500" />
            </div>
            <div>
              <p className="text-xl font-bold text-slate-900 dark:text-zinc-100">{categoriesUsed}</p>
              <p className="text-xs text-slate-400 dark:text-zinc-500">Categories Used</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search + Category Filter */}
      <div className="space-y-3">
        {/* Search */}
        <div className="relative">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 dark:text-zinc-600 pointer-events-none" />
          <input
            type="text"
            placeholder="Search questions and answers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-11 pr-4 py-3 text-sm bg-white dark:bg-zinc-900 border border-slate-200/60 dark:border-zinc-700 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-300 placeholder:text-slate-300 dark:placeholder:text-zinc-600 transition-all"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-300 dark:text-zinc-600 hover:text-slate-500 dark:hover:text-zinc-500 transition-colors"
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
                    : 'bg-white dark:bg-zinc-900 text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-900 border border-slate-100 dark:border-zinc-800'
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
        <div className="bg-white dark:bg-zinc-900 rounded-lg border border-violet-200/60 shadow-sm overflow-hidden">
          <div className="bg-violet-500 px-6 py-4 flex items-center justify-between">
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
              <label className="block text-xs font-semibold text-slate-600 dark:text-zinc-500 mb-1.5">
                Question
              </label>
              <div className="relative">
                <MessageCircleQuestion size={14} className="absolute left-3.5 top-3.5 text-slate-300 dark:text-zinc-600" />
                <input
                  type="text"
                  value={form.question}
                  onChange={(e) => setForm(p => ({ ...p, question: e.target.value }))}
                  placeholder="e.g., What are your office hours?"
                  autoFocus
                  className="w-full pl-10 pr-4 py-3 text-sm bg-slate-50/80 dark:bg-zinc-900/80 border border-slate-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-300 focus:bg-white dark:focus:bg-zinc-900 placeholder:text-slate-300 dark:placeholder:text-zinc-600 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-zinc-500 mb-1.5">
                Answer
              </label>
              <textarea
                ref={answerRef}
                value={form.answer}
                onChange={handleAnswerChange}
                placeholder="e.g., We are open Monday through Friday, 9 AM to 5 PM."
                rows={3}
                className="w-full px-4 py-3 text-sm bg-slate-50/80 dark:bg-zinc-900/80 border border-slate-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-300 focus:bg-white dark:focus:bg-zinc-900 placeholder:text-slate-300 dark:placeholder:text-zinc-600 transition-all resize-none"
                style={{ minHeight: '80px' }}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-zinc-500 mb-1.5">
                Category
              </label>
              <div className="relative">
                <select
                  value={form.category}
                  onChange={(e) => setForm(p => ({ ...p, category: e.target.value }))}
                  className="w-full px-4 py-3 text-sm bg-slate-50/80 dark:bg-zinc-900/80 border border-slate-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-300 focus:bg-white dark:focus:bg-zinc-900 transition-all appearance-none cursor-pointer"
                >
                  {CATEGORIES.filter(c => c.value !== 'all').map(c => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500 pointer-events-none" />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={cancelForm}
                className="px-5 py-2.5 text-sm font-medium text-slate-500 dark:text-zinc-500 hover:text-slate-700 dark:hover:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-900 rounded-lg transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !form.question.trim() || !form.answer.trim()}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-violet-500 hover:bg-violet-600 text-white text-sm font-semibold rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
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
        <div className="bg-white dark:bg-zinc-900 rounded-lg border border-slate-200/60 dark:border-zinc-700 shadow-sm px-8 py-16 text-center">
          <div className="w-16 h-16 bg-violet-50 dark:bg-violet-900/30 rounded-lg flex items-center justify-center mx-auto mb-4">
            <Brain size={28} className="text-violet-300" />
          </div>
          {entries.length === 0 ? (
            <>
              <h3 className="text-base font-semibold text-slate-700 dark:text-zinc-300 mb-2">No knowledge entries yet</h3>
              <p className="text-sm text-slate-400 dark:text-zinc-500 max-w-md mx-auto mb-6">
                Add questions and answers to help your AI assistant respond to callers with accurate information about your business.
              </p>
              <button
                onClick={openAddForm}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-violet-500 hover:bg-violet-600 text-white text-sm font-semibold rounded-lg transition-all duration-200"
              >
                <Plus size={16} />
                Add Your First Entry
              </button>
            </>
          ) : (
            <>
              <h3 className="text-base font-semibold text-slate-700 dark:text-zinc-300 mb-2">No matches found</h3>
              <p className="text-sm text-slate-400 dark:text-zinc-500">
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
                className={`group bg-white dark:bg-zinc-900 rounded-lg border border-slate-200/60 dark:border-zinc-700 shadow-sm overflow-hidden transition-all duration-200 hover:shadow-md border-l-[3px] ${colors.border} ${isInactive ? 'opacity-60' : ''}`}
              >
                <div className="flex items-start gap-3 px-5 py-4">
                  {/* Drag handle (cosmetic) */}
                  <div className="flex-shrink-0 pt-1 opacity-0 group-hover:opacity-40 transition-opacity cursor-grab">
                    <GripVertical size={14} className="text-slate-400 dark:text-zinc-500" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold text-slate-800 dark:text-zinc-200 ${isInactive ? 'line-through' : ''}`}>
                          {entry.question}
                        </p>
                        <p className="text-sm text-slate-500 dark:text-zinc-500 mt-1 leading-relaxed whitespace-pre-wrap">
                          {entry.answer}
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 flex-shrink-0 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => openEditForm(entry)}
                          className="p-2 text-slate-400 dark:text-zinc-500 hover:text-violet-500 hover:bg-violet-50 dark:hover:bg-violet-900/30 rounded-lg transition-all"
                          title="Edit"
                        >
                          <Edit3 size={14} />
                        </button>
                        <button
                          onClick={() => setConfirmDeleteEntry(entry)}
                          disabled={deletingId === entry.id}
                          className="p-2 text-slate-400 dark:text-zinc-500 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-all disabled:opacity-50"
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
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100 dark:border-zinc-800">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold capitalize ${colors.bg} ${colors.text} ring-1 ${colors.ring}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
                        {entry.category || 'general'}
                      </span>

                      <button
                        onClick={() => handleToggle(entry)}
                        disabled={togglingId === entry.id}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all duration-200 ${
                          isInactive
                            ? 'text-slate-400 dark:text-zinc-500 bg-slate-50 dark:bg-zinc-900 hover:bg-slate-100 dark:hover:bg-zinc-800/50'
                            : 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/40'
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
        <div className="text-center pb-4">
          <p className="text-xs text-slate-400 dark:text-zinc-500">
            Showing {filtered.length} of {totalEntries} entries
          </p>
        </div>
      )}
    </div>
  );
}
