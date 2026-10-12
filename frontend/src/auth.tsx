import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, setToken, setStoredUser, getStoredUser, clearAuth, getToken, emitAuth, authEvents } from './api';

export interface UserInfo {
  id: number;
  username: string;
  display_name: string;
  role: string;
  role_label: string;
  skills: string[];
  permissions: string[];
}

interface AuthCtx {
  user: UserInfo | null;
  token: string | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  hasPerm: (perm: string) => boolean;
  isRole: (...roles: string[]) => boolean;
}

const Ctx = createContext<AuthCtx>(null as any);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserInfo | null>(getStoredUser());
  const [token, setTokenState] = useState<string | null>(getToken());
  const [loading, setLoading] = useState(false);

  const applyUser = useCallback((u: UserInfo | null, t: string | null) => {
    setUser(u);
    setTokenState(t);
  }, []);

  useEffect(() => {
    const onAuth = () => {
      setUser(getStoredUser());
      setTokenState(getToken());
    };
    authEvents.addEventListener('change', onAuth);
    return () => authEvents.removeEventListener('change', onAuth);
  }, []);

  const login = async (username: string, password: string) => {
    setLoading(true);
    try {
      const data = await api('/auth/login', { method: 'POST', body: { username, password } });
      setToken(data.token);
      setStoredUser(data);
      applyUser(data, data.token);
      emitAuth();
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await api('/auth/logout', { method: 'POST' });
    } catch {
      /* ignore */
    }
    clearAuth();
    applyUser(null, null);
    emitAuth();
  };

  const hasPerm = (perm: string) => !!user?.permissions?.includes(perm);
  const isRole = (...roles: string[]) => !!user && roles.includes(user.role);

  return (
    <Ctx.Provider value={{ user, token, loading, login, logout, hasPerm, isRole }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);