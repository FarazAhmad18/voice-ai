import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useFirm } from '../context/FirmContext';
import { fetchStaff, createStaff, updateStaff, deleteStaff } from '../services/api';
import { toast } from 'sonner';
import {
  Plus, X, Pencil, Trash2, UserCheck, UserX, Search,
  Mail, Phone, Briefcase, Shield, Users, Sparkles,
} from 'lucide-react';

/* ─── Inject keyframe styles once ─── */
const STYLE_ID = '__staff-premium-styles';
if (typeof document !== 'undefined' && !document.getElementById(STYLE_ID)) {
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    @keyframes staffFadeInUp {
      from { opacity: 0; transform: translateY(16px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes staffModalIn {
      from { opacity: 0; transform: scale(0.95) translateY(10px); }
      to   { opacity: 1; transform: scale(1) translateY(0); }
    }
    @keyframes staffBackdropIn {
      from { opacity: 0; }
      to   { opacity: 1; }
    }
    @keyframes staffShimmer {
      0%   { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }
    .staff-fade-in-up {
      animation: staffFadeInUp 0.4s ease forwards;
      opacity: 0;
    }
    .staff-modal-in {
      animation: staffModalIn 0.3s ease forwards;
    }
    .staff-backdrop-in {
      animation: staffBackdropIn 0.2s ease forwards;
    }
    .staff-shimmer {
      background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%);
      background-size: 200% 100%;
      animation: staffShimmer 1.5s ease-in-out infinite;
    }
    .staff-card-lift {
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    }
    .staff-card-lift:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 25px -5px rgba(0,0,0,0.08), 0 4px 10px -6px rgba(0,0,0,0.04);
    }
  `;
  document.head.appendChild(style);
}

const EMPTY_FORM = { name: '', role: '', specialization: '', email: '', phone: '' };

const AVATAR_GRADIENTS = [
  'from-violet-500 to-purple-600',
  'from-blue-500 to-indigo-600',
  'from-emerald-500 to-teal-600',
  'from-amber-500 to-orange-600',
  'from-rose-500 to-pink-600',
  'from-cyan-500 to-blue-600',
];

function getGradient(name) {
  if (!name) return AVATAR_GRADIENTS[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length];
}

export default function Staff() {
  const { user } = useAuth();
  const { labels } = useFirm();
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    loadStaff();
  }, []);

  async function loadStaff() {
    try {
      const data = await fetchStaff();
      setStaff(data);
    } catch (err) {
      toast.error('Failed to load staff');
    } finally {
      setLoading(false);
    }
  }

  function openAddForm() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  }

  function openEditForm(member) {
    setEditingId(member.id);
    setForm({
      name: member.name || '',
      role: member.role || '',
      specialization: member.specialization || '',
      email: member.email || '',
      phone: member.phone || '',
    });
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (editingId) {
        const updated = await updateStaff(editingId, form);
        setStaff(prev => prev.map(s => s.id === editingId ? { ...s, ...updated } : s));
        toast.success(`${labels.staff} updated`);
      } else {
        const created = await createStaff(form);
        setStaff(prev => [...prev, created]);
        toast.success(`${labels.staff} added`);
      }
      closeForm();
    } catch (err) {
      toast.error(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(member) {
    try {
      const updated = await updateStaff(member.id, { is_active: !member.is_active });
      setStaff(prev => prev.map(s => s.id === member.id ? { ...s, ...updated } : s));
      toast.success(`${member.name} ${member.is_active ? 'deactivated' : 'activated'}`);
    } catch (err) {
      toast.error('Failed to update status');
    }
  }

  async function handleDelete(member) {
    if (!window.confirm(`Remove ${member.name} from the team?`)) return;
    try {
      await deleteStaff(member.id);
      setStaff(prev => prev.filter(s => s.id !== member.id));
      toast.success(`${member.name} removed`);
    } catch (err) {
      toast.error(err.message || 'Failed to remove staff member');
    }
  }

  const filtered = staff.filter(s =>
    !search ||
    s.name?.toLowerCase().includes(search.toLowerCase()) ||
    s.specialization?.toLowerCase().includes(search.toLowerCase()) ||
    s.email?.toLowerCase().includes(search.toLowerCase())
  );

  const activeCount = staff.filter(s => s.is_active).length;
  const inactiveCount = staff.filter(s => !s.is_active).length;

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Skeleton header */}
        <div className="flex items-end justify-between">
          <div>
            <div className="h-9 w-36 bg-slate-100 rounded-lg animate-pulse" />
            <div className="flex gap-3 mt-3">
              <div className="h-8 w-20 bg-slate-50 rounded-full animate-pulse" />
              <div className="h-8 w-24 bg-slate-50 rounded-full animate-pulse" />
            </div>
          </div>
          <div className="h-11 w-32 bg-slate-100 rounded-xl animate-pulse" />
        </div>
        {/* Skeleton search */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          <div className="h-11 bg-slate-50 rounded-xl animate-pulse max-w-md" />
        </div>
        {/* Skeleton cards */}
        <div className="space-y-3">
          {[1,2,3,4].map(i => (
            <div key={i} className="bg-white rounded-2xl border border-slate-100 p-5">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 staff-shimmer rounded-xl" />
                <div className="flex-1">
                  <div className="h-4 w-36 bg-slate-100 rounded animate-pulse" />
                  <div className="h-3 w-56 bg-slate-50 rounded animate-pulse mt-2" />
                </div>
                <div className="flex gap-2">
                  <div className="h-9 w-9 bg-slate-50 rounded-lg animate-pulse" />
                  <div className="h-9 w-9 bg-slate-50 rounded-lg animate-pulse" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">{labels.staff}</h1>
          <div className="flex items-center gap-2.5 mt-3 flex-wrap">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-full">
              <Users size={12} />
              {staff.length} total
            </span>
            {activeCount > 0 && (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 bg-emerald-50 border border-emerald-100 px-3 py-1.5 rounded-full">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                {activeCount} active
              </span>
            )}
            {inactiveCount > 0 && (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-full">
                {inactiveCount} inactive
              </span>
            )}
          </div>
        </div>
        {isAdmin && (
          <button
            onClick={openAddForm}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl hover:from-violet-700 hover:to-purple-700 transition-all shadow-lg shadow-violet-200/50"
          >
            <Plus size={15} />
            Add {labels.staff}
          </button>
        )}
      </div>

      {/* Search */}
      {staff.length > 0 && (
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-slate-200/60 shadow-sm shadow-slate-100/50 p-5">
          <div className="relative max-w-md group">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-violet-400 transition-colors" />
            <input
              type="text"
              placeholder={`Search ${labels.staff.toLowerCase()}...`}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full pl-11 pr-4 py-3 text-sm bg-slate-50/80 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-300 focus:bg-white placeholder:text-slate-300 transition-all"
            />
          </div>
        </div>
      )}

      {/* Staff List */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm py-20 text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-violet-100 to-purple-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <UserCheck size={24} className="text-violet-300" />
          </div>
          <p className="text-sm font-semibold text-slate-600">
            {search ? 'No results found' : `No ${labels.staff.toLowerCase()} yet`}
          </p>
          <p className="text-xs text-slate-400 mt-1.5">
            {search ? 'Try a different search term' : `Add your first ${labels.staff.toLowerCase()} to get started`}
          </p>
          {!search && isAdmin && (
            <button
              onClick={openAddForm}
              className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-violet-700 bg-gradient-to-r from-violet-50 to-purple-50 border border-violet-200/60 rounded-xl hover:from-violet-100 hover:to-purple-100 transition-all"
            >
              <Plus size={14} />
              Add {labels.staff}
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((member, index) => {
            const initials = ((member.name || 'U').split(' ').map(n => n?.[0] || '').join('').slice(0, 2).toUpperCase()) || '?';
            const gradient = getGradient(member.name);
            return (
              <div
                key={member.id}
                className={`staff-fade-in-up bg-white rounded-2xl border shadow-sm staff-card-lift overflow-hidden ${
                  member.is_active
                    ? 'border-slate-100'
                    : 'border-slate-100 opacity-60'
                }`}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="flex items-center gap-4 px-5 py-4">
                  {/* Avatar */}
                  <div className="relative flex-shrink-0">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-sm font-bold shadow-sm ${
                      member.is_active
                        ? `bg-gradient-to-br ${gradient} text-white`
                        : 'bg-slate-200 text-slate-400'
                    }`}>
                      {initials}
                    </div>
                    {member.is_active && (
                      <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-white" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2.5">
                      <p className="text-sm font-semibold text-slate-900">{member.name}</p>
                      <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${
                        member.is_active
                          ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100'
                          : 'bg-slate-100 text-slate-400'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${member.is_active ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                        {member.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-400 flex-wrap">
                      {member.role && (
                        <span className="inline-flex items-center gap-1 capitalize font-medium text-slate-500">
                          <Briefcase size={10} className="text-violet-400" />
                          {member.role}
                        </span>
                      )}
                      {member.specialization && (
                        <>
                          <span className="text-slate-200">|</span>
                          <span className="inline-flex items-center gap-1">
                            <Sparkles size={10} className="text-amber-400" />
                            {member.specialization}
                          </span>
                        </>
                      )}
                      {member.email && (
                        <>
                          <span className="text-slate-200">|</span>
                          <span className="inline-flex items-center gap-1">
                            <Mail size={10} className="text-slate-300" />
                            {member.email}
                          </span>
                        </>
                      )}
                      {member.phone && (
                        <>
                          <span className="text-slate-200">|</span>
                          <span className="inline-flex items-center gap-1">
                            <Phone size={10} className="text-slate-300" />
                            {member.phone}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  {isAdmin && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => handleToggleActive(member)}
                        className={`p-2.5 rounded-xl transition-all ${
                          member.is_active
                            ? 'text-amber-500 hover:bg-amber-50 hover:shadow-sm'
                            : 'text-emerald-500 hover:bg-emerald-50 hover:shadow-sm'
                        }`}
                        title={member.is_active ? 'Deactivate' : 'Activate'}
                      >
                        {member.is_active ? <UserX size={15} /> : <UserCheck size={15} />}
                      </button>
                      <button
                        onClick={() => openEditForm(member)}
                        className="p-2.5 rounded-xl text-slate-400 hover:text-violet-600 hover:bg-violet-50 hover:shadow-sm transition-all"
                        title="Edit"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => handleDelete(member)}
                        className="p-2.5 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 hover:shadow-sm transition-all"
                        title="Remove"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm staff-backdrop-in" onClick={closeForm} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md border border-slate-200/60 overflow-hidden staff-modal-in">
            {/* Gradient header */}
            <div className="bg-gradient-to-r from-violet-600 to-purple-600 px-6 py-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-white">
                    {editingId ? `Edit ${labels.staff}` : `Add ${labels.staff}`}
                  </h3>
                  <p className="text-xs text-white/60 mt-0.5">
                    {editingId ? 'Update team member details' : 'Add a new team member'}
                  </p>
                </div>
                <button onClick={closeForm} className="p-2 rounded-xl hover:bg-white/10 transition-colors">
                  <X size={18} className="text-white/80" />
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="Full name"
                  required
                  className="w-full px-4 py-3 text-sm bg-slate-50/80 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-300 focus:bg-white placeholder:text-slate-300 transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Role</label>
                  <input
                    type="text"
                    value={form.role}
                    onChange={(e) => setForm(p => ({ ...p, role: e.target.value }))}
                    placeholder="e.g. Attorney, Doctor"
                    className="w-full px-4 py-3 text-sm bg-slate-50/80 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-300 focus:bg-white placeholder:text-slate-300 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Specialization</label>
                  <input
                    type="text"
                    value={form.specialization}
                    onChange={(e) => setForm(p => ({ ...p, specialization: e.target.value }))}
                    placeholder="e.g. Family Law"
                    className="w-full px-4 py-3 text-sm bg-slate-50/80 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-300 focus:bg-white placeholder:text-slate-300 transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Email</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm(p => ({ ...p, email: e.target.value }))}
                    placeholder="email@example.com"
                    className="w-full px-4 py-3 text-sm bg-slate-50/80 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-300 focus:bg-white placeholder:text-slate-300 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Phone</label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm(p => ({ ...p, phone: e.target.value }))}
                    placeholder="+1 (555) 000-0000"
                    className="w-full px-4 py-3 text-sm bg-slate-50/80 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-300 focus:bg-white placeholder:text-slate-300 transition-all"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={closeForm}
                  className="px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !form.name.trim()}
                  className="px-6 py-2.5 text-sm font-semibold bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl hover:from-violet-700 hover:to-purple-700 transition-all disabled:opacity-50 shadow-lg shadow-violet-200/50"
                >
                  {saving ? (
                    <span className="inline-flex items-center gap-2">
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Saving...
                    </span>
                  ) : editingId ? 'Save Changes' : `Add ${labels.staff}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
