'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { supabase } from './supabase';
import type { User, Session } from '@supabase/supabase-js';

export interface Profile {
  id: string;
  role: 'admin' | 'supervisor';
  full_name: string;
  phone: string | null;
  email: string | null;
  is_active: boolean;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  session: null,
  loading: true,
  signIn: async () => ({ error: null }),
  signOut: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (!error && data) {
      setProfile(data as Profile);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        fetchProfile(s.user.id);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        fetchProfile(s.user.id);
      } else {
        setProfile(null);
      }
      if (event === 'SIGNED_OUT') {
        setProfile(null);
      }
      setLoading(false);
    });

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        supabase.auth.getSession().then(({ data: { session: s } }) => {
          if (!s) {
            setUser(null);
            setProfile(null);
            setSession(null);
          }
        });
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      subscription.unsubscribe();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes('invalid login')) return { error: 'Incorrect email or password.' };
      if (msg.includes('email not confirmed')) return { error: 'Please verify your email before signing in.' };
      if (msg.includes('too many requests')) return { error: 'Too many login attempts. Please wait a moment.' };
      return { error: 'Unable to sign in. Please try again.' };
    }
    return { error: null };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setSession(null);
  }, []);

  useEffect(() => {
    if (!user) return;

    const IDLE_TIMEOUT = 60 * 60 * 1000;
    let timer: ReturnType<typeof setTimeout>;

    function resetTimer() {
      clearTimeout(timer);
      timer = setTimeout(() => {
        signOut();
        window.location.href = '/login';
      }, IDLE_TIMEOUT);
    }

    const events = ['mousedown', 'keydown', 'touchstart', 'scroll'];
    events.forEach(e => window.addEventListener(e, resetTimer, { passive: true }));
    resetTimer();

    return () => {
      clearTimeout(timer);
      events.forEach(e => window.removeEventListener(e, resetTimer));
    };
  }, [user, signOut]);

  return (
    <AuthContext.Provider value={{ user, profile, session, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
