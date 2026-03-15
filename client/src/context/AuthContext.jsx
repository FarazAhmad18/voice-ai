import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../services/supabase';

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
      console.log('[Auth] Fetching profile from:', url);
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log('[Auth] Profile response:', res.status);
      if (res.ok) {
        const data = await res.json();
        console.log('[Auth] Profile loaded:', data.user?.name, data.user?.role);
        setUser(data.user);
        setFirm(data.firm);
        setIndustryConfig(data.industry_config);
      } else {
        const errData = await res.json().catch(() => ({}));
        console.error('[Auth] Profile failed:', res.status, errData);
        await supabase.auth.signOut();
      }
    } catch (err) {
      console.error('[Auth] Failed to fetch profile:', err);
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
    await supabase.auth.signOut();
    setUser(null);
    setFirm(null);
    setSession(null);
  }

  const value = {
    user,
    firm,
    industryConfig,
    session,
    loading,
    login,
    logout,
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
