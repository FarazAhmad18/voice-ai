import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useFirm } from '../context/FirmContext';
import { fetchStaff, createStaff, updateStaff, deleteStaff } from '../services/api';
import { toast } from 'sonner';
import {
  Plus, X, Pencil, Trash2, UserCheck, UserX, Search,
  Mail, Phone, Briefcase, Shield,
} from 'lucide-react';

const EMPTY_FORM = { name: '', role: '', specialization: '', email: '', phone: '' };

export default function Staff() {
  const { user } = useAuth();
  const { labels } = useFirm();
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

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
    if (!confirm(`Remove ${member.name}? This will deactivate them.`)) return;
    try {
      await deleteStaff(member.id);
      setStaff(prev => prev.map(s => s.id === member.id ? { ...s, is_active: false } : s));
      toast.success(`${member.name} removed`);
    } catch (err) {
      toast.error('Failed to remove staff member');
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
      <div className="flex items-center justify-center h-96">
        <div className="w-8 h-8 border-[3px] border-slate-200 border-t-slate-900 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{labels.staff}</h1>
          <div className="flex items-center gap-4 mt-2">
            <span className="text-sm text-slate-400">{staff.length} total</span>
            {activeCount > 0 && (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                {activeCount} active
              </span>
            )}
            {inactiveCount > 0 && (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 bg-slate-50 px-2.5 py-1 rounded-full">
                {inactiveCount} inactive
              </span>
            )}
          </div>
        </div>
        {isAdmin && (
          <button
            onClick={openAddForm}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-colors shadow-sm shadow-slate-900/20"
          >
            <Plus size={15} />
            Add {labels.staff}
          </button>
        )}
      </div>

      {/* Search */}
      {staff.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm shadow-slate-100/50 p-4">
          <div className="relative max-w-sm">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300" />
            <input
              type="text"
              placeholder={`Search ${labels.staff.toLowerCase()}...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-3 py-2.5 text-sm bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-200 focus:border-slate-200 placeholder:text-slate-300 transition-all"
            />
          </div>
        </div>
      )}

      {/* Staff List */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm py-16 text-center">
          <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <UserCheck size={22} className="text-slate-300" />
          </div>
          <p className="text-sm font-medium text-slate-600">
            {search ? 'No results found' : `No ${labels.staff.toLowerCase()} yet`}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {search ? 'Try a different search term' : `Add your first ${labels.staff.toLowerCase()} to get started`}
          </p>
          {!search && isAdmin && (
            <button
              onClick={openAddForm}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors"
            >
              <Plus size={14} />
              Add {labels.staff}
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((member) => {
            const initials = member.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
            return (
              <div
                key={member.id}
                className={`bg-white rounded-xl border shadow-sm transition-all ${
                  member.is_active
                    ? 'border-slate-100 hover:shadow-md hover:border-slate-200'
                    : 'border-slate-100 opacity-60'
                }`}
              >
                <div className="flex items-center gap-4 px-5 py-4">
                  {/* Avatar */}
                  <div className={`w-11 h-11 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0 ${
                    member.is_active
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-200 text-slate-400'
                  }`}>
                    {initials}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-slate-900">{member.name}</p>
                      <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full ${
                        member.is_active
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-slate-100 text-slate-400'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${member.is_active ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                        {member.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-400 flex-wrap">
                      {member.role && (
                        <span className="inline-flex items-center gap-1 capitalize">
                          <Briefcase size={10} />
                          {member.role}
                        </span>
                      )}
                      {member.specialization && (
                        <>
                          <span className="text-slate-200">|</span>
                          <span>{member.specialization}</span>
                        </>
                      )}
                      {member.email && (
                        <>
                          <span className="text-slate-200">|</span>
                          <span className="inline-flex items-center gap-1">
                            <Mail size={10} />
                            {member.email}
                          </span>
                        </>
                      )}
                      {member.phone && (
                        <>
                          <span className="text-slate-200">|</span>
                          <span className="inline-flex items-center gap-1">
                            <Phone size={10} />
                            {member.phone}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  {isAdmin && (
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => handleToggleActive(member)}
                        className={`p-2 rounded-lg transition-colors ${
                          member.is_active
                            ? 'text-amber-500 hover:bg-amber-50'
                            : 'text-emerald-500 hover:bg-emerald-50'
                        }`}
                        title={member.is_active ? 'Deactivate' : 'Activate'}
                      >
                        {member.is_active ? <UserX size={15} /> : <UserCheck size={15} />}
                      </button>
                      <button
                        onClick={() => openEditForm(member)}
                        className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors"
                        title="Edit"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => handleDelete(member)}
                        className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
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
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={closeForm} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md border border-slate-100">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="text-sm font-semibold text-slate-900">
                {editingId ? `Edit ${labels.staff}` : `Add ${labels.staff}`}
              </h3>
              <button onClick={closeForm} className="p-1.5 rounded-lg hover:bg-slate-50 transition-colors">
                <X size={16} className="text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="Full name"
                  required
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-200 placeholder:text-slate-300"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Role</label>
                  <input
                    type="text"
                    value={form.role}
                    onChange={(e) => setForm(p => ({ ...p, role: e.target.value }))}
                    placeholder="e.g. Attorney, Doctor"
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-200 placeholder:text-slate-300"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Specialization</label>
                  <input
                    type="text"
                    value={form.specialization}
                    onChange={(e) => setForm(p => ({ ...p, specialization: e.target.value }))}
                    placeholder="e.g. Family Law"
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-200 placeholder:text-slate-300"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Email</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm(p => ({ ...p, email: e.target.value }))}
                    placeholder="email@example.com"
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-200 placeholder:text-slate-300"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Phone</label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm(p => ({ ...p, phone: e.target.value }))}
                    placeholder="+1 (555) 000-0000"
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-200 placeholder:text-slate-300"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeForm}
                  className="px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !form.name.trim()}
                  className="px-5 py-2.5 text-sm font-medium bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-colors disabled:opacity-50 shadow-sm shadow-slate-900/20"
                >
                  {saving ? 'Saving...' : editingId ? 'Save Changes' : `Add ${labels.staff}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
