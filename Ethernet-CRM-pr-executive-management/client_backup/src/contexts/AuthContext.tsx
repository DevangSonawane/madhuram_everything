import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { apiClient, setTokens as setApiTokens } from '../utils/apiClient.ts';

interface User {
  id: string;
  name: string;
  employeCode: string;
  email?: string;
  phoneNumber?: string;
  isActive: boolean;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (employeeCode: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUserProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize authentication state from localStorage
  useEffect(() => {
    const initAuth = async () => {
      const storedAccessToken = localStorage.getItem('accessToken');
      const storedRefreshToken = localStorage.getItem('refreshToken');
      const storedUser = localStorage.getItem('user');

      if (storedAccessToken && storedRefreshToken && storedUser) {
        try {
          // Set tokens in apiClient
          setApiTokens({
            accessToken: storedAccessToken,
            refreshToken: storedRefreshToken,
          });

          // Verify token by fetching user profile
          const response = await apiClient('GET', '/api/v1/auth/profile');
          setUser(response.data);
        } catch (error) {
          console.error('Failed to restore session:', error);
          // Clear invalid tokens
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          localStorage.removeItem('user');
        }
      }
      setIsLoading(false);
    };

    initAuth();
  }, []);

  const login = async (employeeCode: string, password: string) => {
    try {
      const response = await apiClient('POST', '/api/v1/auth/login', {
        identifier: employeeCode,
        password,
      });

      const { user: userData, accessToken, refreshToken, isAdmin } = response.data;

      // Check if user is admin
      if (!isAdmin) {
        throw new Error('Access denied. Admin privileges required.');
      }

      // Store tokens in localStorage
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);
      localStorage.setItem('user', JSON.stringify(userData));

      // Set tokens in apiClient
      setApiTokens({ accessToken, refreshToken });

      // Update user state
      setUser(userData);
    } catch (error) {
      throw error;
    }
  };

  const logout = async () => {
    try {
      // Call logout API to clear refresh token on server
      await apiClient('POST', '/api/v1/auth/logout');
    } catch (error) {
      console.error('Logout API call failed:', error);
    } finally {
      // Clear local storage and state
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      setApiTokens({ accessToken: null, refreshToken: null });
      setUser(null);
    }
  };

  const refreshUserProfile = async () => {
    try {
      const response = await apiClient('GET', '/api/v1/auth/profile');
      const userData = response.data;
      setUser(userData);
      localStorage.setItem('user', JSON.stringify(userData));
    } catch (error) {
      console.error('Failed to refresh user profile:', error);
    }
  };

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    logout,
    refreshUserProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

