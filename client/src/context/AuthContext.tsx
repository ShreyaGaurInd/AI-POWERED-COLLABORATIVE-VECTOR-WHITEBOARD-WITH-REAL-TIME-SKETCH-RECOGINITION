import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from '../types/auth';
import { api } from '../services/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('collab_token'));
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Validate existing token on mount
  useEffect(() => {
    async function initAuth() {
      const storedToken = localStorage.getItem('collab_token');
      if (!storedToken) {
        setIsLoading(false);
        return;
      }

      try {
        const response = await api.getMe();
        if (response.success && response.data.user) {
          setUser(response.data.user);
        } else {
          // Token invalid
          localStorage.removeItem('collab_token');
          setToken(null);
          setUser(null);
        }
      } catch (err) {
        console.error('Session validation error:', err);
        localStorage.removeItem('collab_token');
        setToken(null);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    }

    initAuth();
  }, []);

  const login = (newToken: string, newUser: User) => {
    localStorage.setItem('collab_token', newToken);
    setToken(newToken);
    setUser(newUser);
  };

  const logout = () => {
    localStorage.removeItem('collab_token');
    setToken(null);
    setUser(null);
  };

  const refreshUser = async () => {
    try {
      const response = await api.getMe();
      if (response.success && response.data.user) {
        setUser(response.data.user);
      }
    } catch (err) {
      console.error('Failed to refresh user:', err);
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
