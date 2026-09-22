import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import api from '../api/client';
import { loginWithPasskeyIfAvailable } from '../utils/webauthn';

const TOKEN_KEY = 'passkey_poc_token';
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [initializing, setInitializing] = useState(true);
  // Tracks how the current session was established, so the UI can skip
  // re-probing this device when we already know it just used a passkey.
  const [loginMethod, setLoginMethod] = useState(null);

  const applySession = useCallback((token, user, method) => {
    localStorage.setItem(TOKEN_KEY, token);
    setUser(user);
    setLoginMethod(method);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
    setLoginMethod(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const { data } = await api.get('/auth/me');
    setUser(data.user);
    return data.user;
  }, []);

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setInitializing(false);
      return;
    }
    refreshUser()
      .catch(() => logout())
      .finally(() => setInitializing(false));
  }, [refreshUser, logout]);

  // Single combined flow: logs the user in if the email is already registered,
  // otherwise creates a new account with the submitted password.
  const continueWithPassword = useCallback(
    async (email, password) => {
      const { data } = await api.post('/auth/continue', { email, password });
      applySession(data.token, data.user, 'password');
      return { user: data.user, isNewUser: data.isNewUser };
    },
    [applySession],
  );

  const loginPasskey = useCallback(
    async () => {
      const data = await loginWithPasskeyIfAvailable();
      if (!data) return null;
      applySession(data.token, data.user, 'passkey');
      return data.user;
    },
    [applySession],
  );

  const value = {
    user,
    initializing,
    loginMethod,
    continueWithPassword,
    loginPasskey,
    logout,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
