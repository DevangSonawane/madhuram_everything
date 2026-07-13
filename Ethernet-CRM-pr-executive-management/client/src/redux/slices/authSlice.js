import { createSlice } from '@reduxjs/toolkit';

const normalizeUserToken = (user) => {
  if (!user || typeof user !== 'object') return user;
  const token =
    user.token ||
    user.access_token ||
    user.accessToken ||
    user.jwt ||
    user.id_token ||
    user?.data?.token ||
    user?.data?.access_token ||
    user?.data?.accessToken ||
    null;
  if (!token) return user;
  if (user.token === token) return user;
  return { ...user, token };
};

// Helper to check for existing session
const loadUserFromStorage = () => {
  try {
    const serializedUser = localStorage.getItem('inventory_user');
    if (serializedUser === null) {
      return null;
    }
    return normalizeUserToken(JSON.parse(serializedUser));
  } catch {
    return null;
  }
};

const initialState = {
  user: loadUserFromStorage(),
  isAuthenticated: !!loadUserFromStorage(),
  loading: false,
  error: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    loginStart: (state) => {
      state.loading = true;
      state.error = null;
    },
    loginSuccess: (state, action) => {
      state.loading = false;
      state.isAuthenticated = true;
      state.user = normalizeUserToken(action.payload);
      state.error = null;
      localStorage.setItem('inventory_user', JSON.stringify(state.user));
    },
    loginFailure: (state, action) => {
      state.loading = false;
      state.isAuthenticated = false;
      state.user = null;
      state.error = action.payload;
    },
    logout: (state) => {
      state.user = null;
      state.isAuthenticated = false;
      state.loading = false;
      state.error = null;
      localStorage.removeItem('inventory_user');
    },
  },
});

export const { loginStart, loginSuccess, loginFailure, logout } = authSlice.actions;
export default authSlice.reducer;
