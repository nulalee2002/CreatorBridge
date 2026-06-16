import { createContext, useContext, useEffect, useState } from 'react';
import { supabase, supabaseConfigured } from '../lib/supabase.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabaseConfigured) { setLoading(false); return; }

    // Get initial session
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        setUser(session?.user ?? null);
        if (session?.user) fetchProfile(session.user.id);
        else setLoading(false);
      })
      .catch(error => {
        console.warn('CreatorBridge auth session load failed:', error?.message || error);
        setUser(null);
        setProfile(null);
        setLoading(false);
      });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      else { setProfile(null); setLoading(false); }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function recordSignupAudit() {
    if (!supabaseConfigured) return;
    try {
      await supabase.functions.invoke('record-signup-audit', { body: {} });
    } catch {
      // Best-effort audit trail only; auth should never fail because this call did.
    }
  }

  async function fetchProfile(userId) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      if (error) throw error;
      setProfile(data);
    } catch (error) {
      console.warn('CreatorBridge profile load failed:', error?.message || error);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }

  async function signUp({ email, password, fullName, role, captchaToken }) {
    let referralCode = null;
    try {
      referralCode = sessionStorage.getItem('cm-referral-code');
    } catch {}

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        captchaToken: captchaToken || undefined,
        data: { full_name: fullName, role, referral_code: referralCode || undefined },
      },
    });
    if (!error && referralCode) {
      try { sessionStorage.removeItem('cm-referral-code'); } catch {}
    }
    if (!error) recordSignupAudit();
    return { data, error };
  }

  async function signIn({ email, password }) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error) recordSignupAudit();
    return { data, error };
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) return { error };
    setUser(null);
    setProfile(null);
    setLoading(false);
    return { error: null };
  }

  async function signInWithGoogle() {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { queryParams: { access_type: 'offline', prompt: 'consent' } },
    });
    return { data, error };
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signUp, signIn, signOut, signInWithGoogle, fetchProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
