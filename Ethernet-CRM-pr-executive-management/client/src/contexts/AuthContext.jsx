import React, { useEffect, useRef, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { loginStart, loginSuccess, loginFailure, logout as logoutAction } from '../redux/slices/authSlice';
import { api } from '@/lib/api';
import { resolveUserAccessControl } from '@/lib/accessControlStore';
import AuthContext from './authContextBase';

export const AuthProvider = ({ children }) => {
  const dispatch = useDispatch();
  const { user, isAuthenticated, loading, error } = useSelector((state) => state.auth);
  const refreshInFlightRef = useRef(false);
  const lastAccessFetchUserIdRef = useRef(null);
  const authToken = user?.token || user?.access_token || user?.accessToken || user?.jwt || user?.id_token;

  useEffect(() => {
    if (!user) return;
    const resolvedUser = resolveUserAccessControl(user);
    if (JSON.stringify(resolvedUser) !== JSON.stringify(user)) {
      dispatch(loginSuccess(resolvedUser));
    }
  }, [user, dispatch]);

  const refreshUser = useCallback(async ({ force = false } = {}) => {
    if (!authToken) return;
    const userId = user.user_id || user.id || user.uid;
    if (!userId || refreshInFlightRef.current) return;
    if (!force && lastAccessFetchUserIdRef.current === String(userId)) return;
    refreshInFlightRef.current = true;
    try {
      const [userResult, accessResult] = await Promise.all([
        api.getUserById(userId),
        api.getAccessUser(userId),
      ]);
      if (userResult.success && userResult.data) {
        const nextUser = resolveUserAccessControl(
          {
            ...userResult.data,
            token: authToken,
          },
          accessResult?.success ? accessResult.data : null
        );
        dispatch(loginSuccess(nextUser));
        lastAccessFetchUserIdRef.current = String(userId);
      }
    } catch {
      // Silent fail; keep current user state.
    } finally {
      refreshInFlightRef.current = false;
    }
  }, [authToken, user, dispatch]);

  useEffect(() => {
    if (!authToken) {
      lastAccessFetchUserIdRef.current = null;
      return;
    }

    const hasAccessControl =
      user?.role === 'admin' ||
      (user?.access_control?.pages && user?.access_control?.functions);
    if (!hasAccessControl) {
      refreshUser();
    }
  }, [authToken, user?.user_id, user?.id, user?.uid, user?.role, user?.access_control, refreshUser]);

  // We rely on Redux initial state for checking localStorage on mount
  // But if we wanted to sync or re-validate token on mount, we could do it here.

  const login = async (email, password) => {
    dispatch(loginStart());
    try {
      // Try to login via API
      const result = await api.login(email, password);

      if (result.success) {
        const data = result.data || {};
        const token = data.token || data.access_token || data.jwt;
        if (!token) {
          dispatch(loginFailure(data.message || 'Login failed'));
          return false;
        }
        const userPayload = (data.user && typeof data.user === 'object') ? data.user : data;
        let userData = resolveUserAccessControl({
          ...userPayload,
          token,
        });
        dispatch(loginSuccess(userData));

        const userId = userData.user_id || userData.id || userData.uid;
        if (userId) {
          const accessResult = await api.getAccessUser(userId);
          if (accessResult.success && accessResult.data) {
            userData = resolveUserAccessControl(
              {
                ...userData,
              },
              accessResult.data
            );
            dispatch(loginSuccess(userData));
            lastAccessFetchUserIdRef.current = String(userId);
          }
        }
        return true;
      } else {
        dispatch(loginFailure(result.error || 'Login failed'));
        return false;
      }
    } catch (error) {
      console.warn("API Login failed", error);
      dispatch(loginFailure(error.message || 'Login error'));
      return false;
    }
  };

  const logout = async () => {
    try {
      await api.logout();
    } catch (error) {
      console.error("Logout failed", error);
    }
    dispatch(logoutAction());
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, login, logout, loading, error }}>
      {children}
    </AuthContext.Provider>
  );
};
