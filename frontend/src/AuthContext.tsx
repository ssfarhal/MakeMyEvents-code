import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { api, getToken, setToken } from './api';

WebBrowser.maybeCompleteAuthSession();

type User = { user_id: string; email: string; name?: string; picture?: string; hallName?: string; hallAddress?: string; ownerPhone?: string };

type Ctx = {
  user: User | null;
  loading: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (data: { hallName?: string; hallAddress?: string; ownerPhone?: string }) => Promise<void>;
};

const AuthContext = createContext<Ctx>({ user: null, loading: true, signIn: async () => {}, signOut: async () => {}, updateProfile: async () => {} });

export const useAuth = () => useContext(AuthContext);

function extractSessionId(url: string): string | null {
  if (!url) return null;
  const m = url.match(/[?#&]session_id=([^&#]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const processed = useRef<Set<string>>(new Set());
  const capturedUrl = useRef<string | null>(null);

  const exchange = useCallback(async (session_id: string) => {
    if (processed.current.has(session_id)) return;
    processed.current.add(session_id);
    try {
      const res: any = await api.exchangeSession(session_id);
      await setToken(res.session_token);
      setUser(res.user);
    } catch (e) {
      console.warn('session exchange failed', e);
    }
  }, []);

  // Boot: check existing token + handle deep link (mobile) / URL fragment (web)
  useEffect(() => {
    let unsub: any;
    (async () => {
      try {
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          const sid = extractSessionId(window.location.href);
          if (sid) {
            await exchange(sid);
            const url = new URL(window.location.href);
            url.hash = '';
            url.searchParams.delete('session_id');
            window.history.replaceState(window.history.state, '', url.toString());
          }
        } else {
          const initial = await Linking.getInitialURL();
          const sid = initial ? extractSessionId(initial) : null;
          if (sid) await exchange(sid);
          unsub = Linking.addEventListener('url', ({ url }) => {
            capturedUrl.current = url;
            const s = extractSessionId(url);
            if (s) exchange(s);
          });
        }
        const token = await getToken();
        if (token) {
          try {
            const u = await api.me();
            setUser(u);
          } catch {
            await setToken(null);
          }
        }
      } finally {
        setLoading(false);
      }
    })();
    return () => { try { unsub?.remove?.(); } catch {} };
  }, [exchange]);

  const signIn = useCallback(async () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const redirect = window.location.origin + '/';
      window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirect)}`;
      return;
    }
    const redirect = Linking.createURL('');
    const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirect)}`;
    const result = await WebBrowser.openAuthSessionAsync(authUrl, redirect);
    let url: string | null = (result as any)?.url || null;
    if (!url) url = capturedUrl.current;
    if (!url) url = await Linking.getInitialURL();
    const sid = url ? extractSessionId(url) : null;
    if (sid) await exchange(sid);
  }, [exchange]);

  const signOut = useCallback(async () => {
    try { await api.logout(); } catch {}
    await setToken(null);
    setUser(null);
  }, []);

  const updateProfile = useCallback(async (data: { hallName?: string; hallAddress?: string; ownerPhone?: string }) => {
    const updated = await api.updateMe(data);
    setUser(updated);
  }, []);

  const value = useMemo(() => ({ user, loading, signIn, signOut, updateProfile }), [user, loading, signIn, signOut, updateProfile]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
