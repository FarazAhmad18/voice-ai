import { useState } from 'react';

export default function Settings() {
  const [firmName, setFirmName] = useState('Mitchell Family Law');
  const [firmEmail, setFirmEmail] = useState('contact@mitchellfamilylaw.com');
  const [firmPhone, setFirmPhone] = useState('(425) 762-3355');
  const [firmAddress, setFirmAddress] = useState('');
  const [businessHours, setBusinessHours] = useState('9:00 AM - 5:00 PM');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    await new Promise((r) => setTimeout(r, 500));
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Firm Info */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-sm font-semibold text-slate-800">Firm Information</h3>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-xs font-medium bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : saved ? 'Saved' : 'Save Changes'}
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Firm Name</label>
            <input
              type="text"
              value={firmName}
              onChange={(e) => setFirmName(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-200 focus:border-slate-200"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Email</label>
              <input
                type="email"
                value={firmEmail}
                onChange={(e) => setFirmEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-200 focus:border-slate-200"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Phone</label>
              <input
                type="tel"
                value={firmPhone}
                onChange={(e) => setFirmPhone(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-200 focus:border-slate-200"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Office Address</label>
            <input
              type="text"
              value={firmAddress}
              onChange={(e) => setFirmAddress(e.target.value)}
              placeholder="123 Main St, Suite 100, City, State"
              className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-200 focus:border-slate-200 placeholder:text-slate-300"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Business Hours</label>
            <input
              type="text"
              value={businessHours}
              onChange={(e) => setBusinessHours(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-200 focus:border-slate-200"
            />
          </div>
        </div>
      </div>

      {/* AI Assistant */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6">
        <h3 className="text-sm font-semibold text-slate-800 mb-4">AI Assistant</h3>
        <div className="divide-y divide-slate-50">
          {[
            { label: 'Name', value: 'Sarah' },
            { label: 'Voice', value: 'ElevenLabs — Grace' },
            { label: 'Model', value: 'GPT 4.1' },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between py-3">
              <span className="text-sm text-slate-400">{label}</span>
              <span className="text-sm font-medium text-slate-800">{value}</span>
            </div>
          ))}
          <div className="flex items-center justify-between py-3">
            <span className="text-sm text-slate-400">Status</span>
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-800">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
              Active
            </span>
          </div>
        </div>
      </div>

      {/* Plan */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6">
        <h3 className="text-sm font-semibold text-slate-800 mb-4">Plan & Usage</h3>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-900">Free Trial</p>
            <p className="text-xs text-slate-400 mt-0.5">50 AI call minutes included</p>
          </div>
          <button className="px-4 py-2 bg-slate-100 text-slate-400 text-xs font-medium rounded-xl cursor-not-allowed" disabled>
            Upgrade
          </button>
        </div>
        <div className="mt-5 pt-4 border-t border-slate-50">
          <div className="flex justify-between text-xs mb-2">
            <span className="text-slate-400">Minutes Used</span>
            <span className="text-slate-600 font-medium">0 / 50</span>
          </div>
          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-slate-900 rounded-full" style={{ width: '0%' }} />
          </div>
        </div>
      </div>
    </div>
  );
}
