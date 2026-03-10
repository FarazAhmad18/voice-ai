import { Building2, Mail, Phone, Bot, Mic, Cpu, Activity, Crown, Zap, Lock } from 'lucide-react';

export default function Settings() {
  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Settings</h1>
        <p className="text-sm text-slate-400 mt-1">Manage your firm's account and AI assistant configuration.</p>
      </div>

      <div className="space-y-5">
        {/* Firm Info */}
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
              <Building2 size={16} className="text-blue-600" />
            </div>
            <h3 className="font-semibold text-slate-900">Firm Information</h3>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Firm Name</label>
              <div className="flex items-center gap-2.5">
                <div className="flex-1 flex items-center gap-2 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                  <Building2 size={14} className="text-slate-400" />
                  <span className="text-sm font-medium text-slate-700">Mitchell Family Law</span>
                </div>
                <Lock size={14} className="text-slate-300" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Email</label>
              <div className="flex items-center gap-2.5">
                <div className="flex-1 flex items-center gap-2 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                  <Mail size={14} className="text-slate-400" />
                  <span className="text-sm font-medium text-slate-700">contact@mitchellfamilylaw.com</span>
                </div>
                <Lock size={14} className="text-slate-300" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Phone</label>
              <div className="flex items-center gap-2.5">
                <div className="flex-1 flex items-center gap-2 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                  <Phone size={14} className="text-slate-400" />
                  <span className="text-sm font-medium text-slate-700">(425) 762-3355</span>
                </div>
                <Lock size={14} className="text-slate-300" />
              </div>
            </div>
          </div>
          <p className="text-[11px] text-slate-400 mt-4 flex items-center gap-1">
            <Lock size={10} /> Settings are read-only in the current plan. Contact support to make changes.
          </p>
        </div>

        {/* AI Assistant */}
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center">
              <Bot size={16} className="text-emerald-600" />
            </div>
            <h3 className="font-semibold text-slate-900">AI Assistant</h3>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2.5 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <Bot size={14} className="text-slate-400" />
                <span className="text-sm text-slate-500">Assistant Name</span>
              </div>
              <span className="text-sm font-semibold text-slate-900">Sarah</span>
            </div>
            <div className="flex items-center justify-between py-2.5 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <Mic size={14} className="text-slate-400" />
                <span className="text-sm text-slate-500">Voice Provider</span>
              </div>
              <span className="text-sm font-semibold text-slate-900">ElevenLabs - Sarah</span>
            </div>
            <div className="flex items-center justify-between py-2.5 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <Cpu size={14} className="text-slate-400" />
                <span className="text-sm text-slate-500">AI Model</span>
              </div>
              <span className="text-sm font-semibold text-slate-900">GPT 4.1</span>
            </div>
            <div className="flex items-center justify-between py-2.5">
              <div className="flex items-center gap-2.5">
                <Activity size={14} className="text-slate-400" />
                <span className="text-sm text-slate-500">Status</span>
              </div>
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-600">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                Active
              </span>
            </div>
          </div>
        </div>

        {/* Plan */}
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center">
              <Crown size={16} className="text-amber-600" />
            </div>
            <h3 className="font-semibold text-slate-900">Plan & Usage</h3>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-base font-bold text-slate-900">Free Trial</p>
                <span className="px-2 py-0.5 bg-amber-50 text-amber-700 text-[10px] font-bold uppercase tracking-wider rounded-md border border-amber-200">Trial</span>
              </div>
              <p className="text-sm text-slate-400 mt-1 flex items-center gap-1">
                <Zap size={12} className="text-amber-500" />
                Includes 50 AI call minutes
              </p>
            </div>
            <button className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 shadow-lg shadow-blue-500/20 transition-all duration-200 disabled:opacity-50" disabled>
              Upgrade Plan
            </button>
          </div>
          {/* Usage Bar */}
          <div className="mt-5 pt-4 border-t border-slate-100">
            <div className="flex justify-between text-xs mb-2">
              <span className="text-slate-400 font-medium">Minutes Used</span>
              <span className="text-slate-600 font-semibold">0 / 50 min</span>
            </div>
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full" style={{ width: '0%' }}></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
