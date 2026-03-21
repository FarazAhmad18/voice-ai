import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { clearAll as clearApiCache } from '../services/cache.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [firm, setFirm] = useState(null);
  const [industryConfig, setIndustryConfig] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for existing session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setSession(session);
        fetchProfile(session.access_token);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        fetchProfile(session.access_token);
      } else {
        setUser(null);
        setFirm(null);
        setIndustryConfig(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchProfile(token) {
    try {
      const API_BASE = import.meta.env.VITE_API_URL || '/api';
      const url = `${API_BASE}/auth/me`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        setFirm(data.firm);
        setIndustryConfig(data.industry_config);
      } else {
        await res.json().catch(() => ({}));
        await supabase.auth.signOut();
      }
    } catch (err) {
      // Profile fetch failed silently — user will be redirected to login
    } finally {
      setLoading(false);
    }
  }

  async function login(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    return data;
  }

  async function logout() {
    clearApiCache();
    await supabase.auth.signOut();
    setUser(null);
    setFirm(null);
    setSession(null);
  }

  async function refreshProfile() {
    if (session?.access_token) {
      await fetchProfile(session.access_token);
    }
  }

  const value = {
    user,
    firm,
    industryConfig,
    session,
    loading,
    login,
    logout,
    refreshProfile,
    isAuthenticated: !!user,
    isSuperAdmin: user?.role === 'super_admin',
    isAdmin: user?.role === 'admin',
    isStaff: user?.role === 'staff',
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
