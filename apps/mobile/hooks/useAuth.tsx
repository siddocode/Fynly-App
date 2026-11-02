import React, { createContext, useContext, useState, useEffect } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, setAuthToken, setRefreshToken, getRefreshToken, queryClient } from '../lib/api';

const TOKEN_KEY = '@fynly_auth_token';
const REFRESH_TOKEN_KEY = '@fynly_refresh_token';
const USER_KEY = '@fynly_auth_user';

interface UserProfile {
  id: string;
  email: string;
  name: string;
  currency: string;
  totalBalancePaise?: string;
  accounts?: Array<{
    id: string;
    name: string;
    type: string;
    balancePaise: string | number;
    currency: string;
  }>;
}

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  sendOtp: (email: string, purpose: 'REGISTER' | 'LOGIN') => Promise<any>;
  verifyOtp: (
    email: string,
    otp: string,
    purpose: 'REGISTER' | 'LOGIN',
    name?: string
  ) => Promise<void>;
  logout: () => void;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Synchronously read initial storage on web to prevent any flash of unauthenticated state
const getInitialStoredSession = (): { user: UserProfile | null; token: string | null } => {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
    try {
      const storedToken = window.localStorage.getItem(TOKEN_KEY);
      const storedUser = window.localStorage.getItem(USER_KEY);
      const storedRefresh = window.localStorage.getItem(REFRESH_TOKEN_KEY);

      if (storedToken && storedToken !== 'undefined' && storedToken !== 'null') {
        setAuthToken(storedToken);
      }
      if (storedRefresh && storedRefresh !== 'undefined' && storedRefresh !== 'null') {
        setRefreshToken(storedRefresh);
      }

      let parsedUser: UserProfile | null = null;
      if (storedUser && storedUser !== 'undefined' && storedUser !== 'null') {
        try {
          parsedUser = JSON.parse(storedUser) as UserProfile;
        } catch {}
      }

      if (storedToken && storedToken !== 'undefined' && storedToken !== 'null') {
        return {
          token: storedToken,
          user: parsedUser,
        };
      }
    } catch {}
  }
  return { user: null, token: null };
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const initial = getInitialStoredSession();
  const [user, setUser] = useState<UserProfile | null>(initial.user);
  const [token, setToken] = useState<string | null>(initial.token);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Restore and verify stored session on mount across platforms
  useEffect(() => {
    let isMounted = true;
    const restoreSession = async () => {
      try {
        const [storedToken, storedUser, storedRefresh] = await Promise.all([
          AsyncStorage.getItem(TOKEN_KEY),
          AsyncStorage.getItem(USER_KEY),
          AsyncStorage.getItem(REFRESH_TOKEN_KEY),
        ]);

        const activeToken = storedToken || token;
        const activeRefresh = storedRefresh || getRefreshToken();

        if (activeToken) {
          if (isMounted) {
            setToken(activeToken);
            setAuthToken(activeToken);
          }
          if (activeRefresh) {
            setRefreshToken(activeRefresh);
          }

          if (storedUser && storedUser !== 'undefined' && isMounted) {
            try {
              setUser(JSON.parse(storedUser));
            } catch {}
          }

          // Silent background refresh to verify session with backend
          try {
            const freshUser = await api.getMe();
            if (isMounted) {
              setUser(freshUser);
              AsyncStorage.setItem(USER_KEY, JSON.stringify(freshUser)).catch(() => {});
              if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
                window.localStorage.setItem(USER_KEY, JSON.stringify(freshUser));
              }
            }
          } catch (err: any) {
            // If getMe returned 401 or token expired, attempt silent token refresh
            if (
              err?.message?.includes('401') ||
              err?.message?.toLowerCase().includes('unauthorized') ||
              err?.message?.toLowerCase().includes('token') ||
              err?.message?.toLowerCase().includes('expired')
            ) {
              const currentRefresh = activeRefresh || (Platform.OS === 'web' && window.localStorage?.getItem(REFRESH_TOKEN_KEY));
              if (currentRefresh) {
                try {
                  const newTokens = await api.refreshSession(currentRefresh);
                  if (isMounted) {
                    setToken(newTokens.accessToken);
                    setAuthToken(newTokens.accessToken);
                  }
                  // Retry fetching user profile with refreshed token
                  const retryUser = await api.getMe();
                  if (isMounted) {
                    setUser(retryUser);
                    AsyncStorage.setItem(USER_KEY, JSON.stringify(retryUser)).catch(() => {});
                    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
                      window.localStorage.setItem(USER_KEY, JSON.stringify(retryUser));
                    }
                  }
                  return;
                } catch {
                  // Both token and refresh token expired
                  logout();
                }
              } else {
                logout();
              }
            }
          }
        }
      } catch (err) {
        console.warn('Session restoration notice:', err);
      }
    };

    restoreSession();
    return () => {
      isMounted = false;
    };
  }, []);

  const persistSession = async (
    accessToken: string,
    userProfile: UserProfile,
    refreshTokenVal?: string
  ) => {
    setToken(accessToken);
    setAuthToken(accessToken);
    if (refreshTokenVal) {
      setRefreshToken(refreshTokenVal);
    }
    setUser(userProfile);

    // Synchronously write to localStorage on Web for instant persistence without async lag
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(TOKEN_KEY, accessToken);
        window.localStorage.setItem(USER_KEY, JSON.stringify(userProfile));
        if (refreshTokenVal) {
          window.localStorage.setItem(REFRESH_TOKEN_KEY, refreshTokenVal);
        }
      } catch {}
    }

    try {
      const promises = [
        AsyncStorage.setItem(TOKEN_KEY, accessToken),
        AsyncStorage.setItem(USER_KEY, JSON.stringify(userProfile)),
      ];
      if (refreshTokenVal) {
        promises.push(AsyncStorage.setItem(REFRESH_TOKEN_KEY, refreshTokenVal));
      }
      await Promise.all(promises);
    } catch (err) {
      console.warn('Failed to persist session to storage:', err);
    }
  };

  const refreshProfile = async () => {
    try {
      const profile = await api.getMe();
      setUser(profile);
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(profile));
      if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(USER_KEY, JSON.stringify(profile));
      }
    } catch {
      logout();
    }
  };

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const data = await api.login({ email, password });
      await persistSession(data.tokens.accessToken, data.user, data.tokens.refreshToken);
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (name: string, email: string, password: string) => {
    setIsLoading(true);
    try {
      const data = await api.register({ name, email, password });
      await persistSession(data.tokens.accessToken, data.user, data.tokens.refreshToken);
    } finally {
      setIsLoading(false);
    }
  };

  const sendOtp = async (email: string, purpose: 'REGISTER' | 'LOGIN') => {
    setIsLoading(true);
    try {
      return await api.sendOtp({ email, purpose });
    } finally {
      setIsLoading(false);
    }
  };

  const verifyOtp = async (
    email: string,
    otp: string,
    purpose: 'REGISTER' | 'LOGIN',
    name?: string
  ) => {
    setIsLoading(true);
    try {
      const data = await api.verifyOtp({ email, otp, purpose, name });
      await persistSession(data.tokens.accessToken, data.user, data.tokens.refreshToken);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    setAuthToken(null);
    setRefreshToken(null);
    AsyncStorage.removeItem(TOKEN_KEY).catch(() => {});
    AsyncStorage.removeItem(USER_KEY).catch(() => {});
    AsyncStorage.removeItem(REFRESH_TOKEN_KEY).catch(() => {});
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.removeItem(TOKEN_KEY);
        window.localStorage.removeItem(USER_KEY);
        window.localStorage.removeItem(REFRESH_TOKEN_KEY);
      } catch {}
    }
    // Purge all cached query data immediately so no financial data persists after logout
    queryClient.clear();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated: !!token,
        login,
        register,
        sendOtp,
        verifyOtp,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
