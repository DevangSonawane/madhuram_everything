import axios from "axios";

// ✅ APIs that don't require token
const noAuthEndpoints = [
  "/api/v1/auth/login",
  "/api/v1/auth/register",
  "/api/v1/auth/refresh"
];

let accessToken: string | null = null;
let refreshToken: string | null = null;

// ✅ Create axios instance
export const api = axios.create({
  baseURL: "http://localhost:3000", // Replace with your backend URL
  timeout: 10000,
});

// ✅ Function to set tokens
export const setTokens = (tokens: { accessToken: string | null; refreshToken: string | null }) => {
  accessToken = tokens.accessToken;
  refreshToken = tokens.refreshToken;
  
  // Also sync with localStorage
  if (tokens.accessToken && tokens.refreshToken) {
    localStorage.setItem('accessToken', tokens.accessToken);
    localStorage.setItem('refreshToken', tokens.refreshToken);
  }
};

// ✅ Function to get tokens from localStorage if not in memory
const getAccessToken = () => {
  if (!accessToken) {
    accessToken = localStorage.getItem('accessToken');
  }
  return accessToken;
};

const getRefreshToken = () => {
  if (!refreshToken) {
    refreshToken = localStorage.getItem('refreshToken');
  }
  return refreshToken;
};

// ✅ Function to refresh token
const refreshAccessToken = async () => {
  try {
    const currentRefreshToken = getRefreshToken();
    if (!currentRefreshToken) {
      throw new Error('No refresh token available');
    }
    
    const response = await api.post("/api/v1/auth/refresh", { refreshToken: currentRefreshToken });
    const newAccessToken = response.data.data.accessToken;
    const newRefreshToken = response.data.data.refreshToken;
    
    // Update both memory and localStorage
    accessToken = newAccessToken;
    refreshToken = newRefreshToken;
    localStorage.setItem('accessToken', newAccessToken);
    localStorage.setItem('refreshToken', newRefreshToken);
    
    return newAccessToken;
  } catch (error) {
    console.error("Token refresh failed", error);
    // Clear tokens on refresh failure
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    accessToken = null;
    refreshToken = null;
    // Redirect to login
    window.location.href = '/login';
    throw error;
  }
};

// ✅ Request Interceptor: Attach token to every request except noAuthEndpoints
api.interceptors.request.use(
  async (config) => {
    const requiresAuth = !noAuthEndpoints.some(endpoint =>
      config.url?.includes(endpoint)
    );

    if (requiresAuth) {
      const token = getAccessToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// ✅ Response Interceptor: Handle expired token and retry request
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Don't retry if this is already a refresh token request or if we've already retried
    const isRefreshRequest = originalRequest.url?.includes('/api/v1/auth/refresh');
    
    // If 401 error & we haven't retried yet & it's not a refresh request → refresh token
    if (error.response?.status === 401 && !originalRequest._retry && !isRefreshRequest) {
      originalRequest._retry = true;
      try {
        const newToken = await refreshAccessToken();
        api.defaults.headers.common["Authorization"] = `Bearer ${newToken}`;
        originalRequest.headers["Authorization"] = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        console.error("Token refresh failed, logging out...");
        // optionally redirect to login
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// ✅ Main apiClient function to use in your app
export const apiClient = async (
  method: string,
  url: string,
  data: any = {},
  config: any = {}
): Promise<any> => {
  try {
    const response = await api.request({
      method,
      url,
      data,
      ...config,
    });
    return response.data;
  } catch (error: any) {
    throw error.response?.data || error;
  }
};

export default apiClient;
