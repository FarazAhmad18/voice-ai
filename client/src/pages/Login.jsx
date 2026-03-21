import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Loader2, Eye, EyeOff, ArrowRight, Zap, Shield, BarChart3, Phone } from 'lucide-react';

export default function Login() {
  const { login, isAuthenticated, isSuperAdmin, firm, loading: authLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // If already authenticated, redirect away from login
  if (isAuthenticated) {
    if (isSuperAdmin && !firm) {
      return <Navigate to="/admin" replace />;
    }
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
    } catch (err) {
      setError(err.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  }

  const features = [
    { icon: Phone, title: 'AI Voice Agents', desc: 'Deploy intelligent voice AI for every client' },
    { icon: BarChart3, title: 'Smart Lead Scoring', desc: 'Automatically qualify and prioritize leads' },
    { icon: Shield, title: 'Multi-Tenant CRM', desc: 'White-label dashboards for every client' },
    { icon: Zap, title: 'Instant Deployment', desc: 'Go live with a new client in minutes' },
  ];

  return (
    <div className="min-h-screen flex">
      {/* Left Panel — Brand */}
      <div className="hidden lg:flex lg:w-[52%] relative overflow-hidden bg-[#09090b]">
        {/* Animated gradient background */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-br from-violet-600/20 via-transparent to-blue-600/20" />
          <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-violet-500/10 rounded-full blur-[120px] animate-pulse" style={{ animationDuration: '8s' }} />
          <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-blue-500/10 rounded-full blur-[100px] animate-pulse" style={{ animationDuration: '12s', animationDelay: '2s' }} />
          <div className="absolute top-1/2 left-1/3 w-[300px] h-[300px] bg-indigo-500/8 rounded-full blur-[80px] animate-pulse" style={{ animationDuration: '10s', animationDelay: '4s' }} />
          {/* Grid pattern overlay */}
          <div className="absolute inset-0 opacity-[0.03]" style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)',
            backgroundSize: '60px 60px'
          }} />
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between w-full p-12 xl:p-16">
          {/* Top — Logo */}
          <div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/10 backdrop-blur-sm rounded-xl flex items-center justify-center border border-white/10">
                <span className="text-white text-lg font-bold">V</span>
              </div>
              <span className="text-xl font-semibold text-white tracking-tight">VoibixAI</span>
            </div>
          </div>

          {/* Center — Headline + Features */}
          <div className="space-y-12">
            <div className="space-y-4">
              <h1 className="text-4xl xl:text-5xl font-bold text-white leading-tight tracking-tight">
                AI-Powered<br />
                <span className="bg-gradient-to-r from-violet-400 to-blue-400 bg-clip-text text-transparent">Voice CRM</span>
              </h1>
              <p className="text-lg text-zinc-400 max-w-md leading-relaxed">
                Deploy intelligent voice agents, capture leads automatically, and manage every client from one platform.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {features.map((f, i) => (
                <div
                  key={f.title}
                  className={`group p-4 rounded-2xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.07] hover:border-white/[0.1] transition-all duration-500 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
                  style={{ transitionDelay: `${200 + i * 100}ms` }}
                >
                  <f.icon size={20} className="text-violet-400 mb-3" strokeWidth={1.5} />
                  <p className="text-sm font-medium text-white mb-1">{f.title}</p>
                  <p className="text-xs text-zinc-500 leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom — Social proof */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex -space-x-2">
                {['bg-violet-500', 'bg-blue-500', 'bg-emerald-500', 'bg-amber-500'].map((bg, i) => (
                  <div key={i} className={`w-8 h-8 ${bg} rounded-full border-2 border-[#09090b] flex items-center justify-center text-[10px] font-semibold text-white`}>
                    {['MF', 'BS', 'AP', 'RC'][i]}
                  </div>
                ))}
              </div>
              <p className="text-sm text-zinc-500">Trusted by growing businesses</p>
            </div>
            <div className="flex items-center gap-6 text-xs text-zinc-600">
              <span>SOC 2 Compliant</span>
              <span className="w-1 h-1 bg-zinc-700 rounded-full" />
              <span>99.9% Uptime</span>
              <span className="w-1 h-1 bg-zinc-700 rounded-full" />
              <span>Enterprise Ready</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel — Login Form */}
      <div className="flex-1 flex items-center justify-center bg-[#fafafa] px-6 py-12">
        <div className={`w-full max-w-[380px] transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
          {/* Mobile logo (shown on small screens) */}
          <div className="lg:hidden text-center mb-10">
            <div className="w-12 h-12 bg-[#09090b] rounded-2xl flex items-center justify-center mx-auto mb-4">
              <span className="text-white text-lg font-bold">V</span>
            </div>
            <h1 className="text-xl font-semibold text-zinc-900 tracking-tight">VoibixAI</h1>
            <p className="text-sm text-zinc-400 mt-1">AI-Powered Voice CRM</p>
          </div>

          {/* Welcome text */}
          <div className="mb-8">
            <h2 className="text-2xl font-semibold text-zinc-900 tracking-tight">Welcome back</h2>
            <p className="text-sm text-zinc-500 mt-2">Sign in to your account to continue</p>
          </div>

          {/* Error message */}
          {error && (
            <div className="mb-6 px-4 py-3 bg-red-50 border border-red-100 rounded-xl animate-[shake_0.5s_ease-in-out]">
              <p className="text-sm text-red-600 font-medium">{error}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-zinc-700">Email address</label>
              <div className={`relative rounded-xl transition-all duration-200 ${emailFocused ? 'ring-2 ring-zinc-900/10' : ''}`}>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onFocus={() => setEmailFocused(true)}
                  onBlur={() => setEmailFocused(false)}
                  required
                  autoFocus
                  autoComplete="email"
                  className="w-full px-4 py-3 text-sm bg-white border border-zinc-200 rounded-xl focus:outline-none focus:border-zinc-400 placeholder:text-zinc-300 transition-colors"
                  placeholder="you@company.com"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-zinc-700">Password</label>
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => {
                    const email = document.querySelector('input[type="email"]')?.value;
                    if (email) {
                      import('../services/supabase').then(({ supabase }) => {
                        supabase.auth.resetPasswordForEmail(email).then(() => {
                          alert('If an account exists with that email, a password reset link has been sent.');
                        });
                      });
                    } else {
                      alert('Please enter your email address first.');
                    }
                  }}
                  className="text-xs font-medium text-zinc-400 hover:text-zinc-600 transition-colors"
                >
                  Forgot password?
                </button>
              </div>
              <div className={`relative rounded-xl transition-all duration-200 ${passwordFocused ? 'ring-2 ring-zinc-900/10' : ''}`}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => setPasswordFocused(false)}
                  required
                  autoComplete="current-password"
                  className="w-full px-4 py-3 pr-11 text-sm bg-white border border-zinc-200 rounded-xl focus:outline-none focus:border-zinc-400 placeholder:text-zinc-300 transition-colors"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-zinc-300 hover:text-zinc-500 transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="group w-full flex items-center justify-center gap-2 py-3 bg-[#09090b] text-white text-sm font-medium rounded-xl hover:bg-[#18181b] active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none"
            >
              {loading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <>
                  Sign in
                  <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
                </>
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-8 pt-6 border-t border-zinc-100">
            <p className="text-center text-xs text-zinc-400">
              Protected by enterprise-grade encryption
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
