import axios, { AxiosInstance, AxiosResponse, AxiosError, InternalAxiosRequestConfig } from 'axios';
import { ApiResponse, ApiErrorResponse } from '../types/api';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || '/api/v1';

export const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

// Dedicated client for file uploads. Hits the backend directly instead of
// going through the Next.js dev-server rewrite proxy, which buffers/streams
// multipart bodies slowly in dev and can abort large uploads well before
// they finish. Backend CORS already allows the client origin + Authorization
// header, so this is safe cross-origin. Also gets a longer timeout since
// large files legitimately take longer than a typical JSON request.
const UPLOAD_BASE_URL = `${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'}/api/v1`;

export const uploadClient: AxiosInstance = axios.create({
  baseURL: UPLOAD_BASE_URL,
  timeout: 300000, // 5 minutes
});

export type TokenGetter = (options?: { skipCache?: boolean }) => Promise<string | null>;

let activeTokenGetter: TokenGetter | null = null;
let currentAuthToken: string | null = null;

/**
 * Register dynamic token provider function (e.g. from Clerk's useAuth)
 */
export function setTokenGetter(getter: TokenGetter | null) {
  activeTokenGetter = getter;
}

/**
 * Set or clear fallback Bearer authentication token for outgoing requests
 */
export function setAuthToken(token: string | null) {
  currentAuthToken = token ? `Bearer ${token}` : null;
  if (token) {
    apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete apiClient.defaults.headers.common['Authorization'];
  }
}

/**
 * Get active Bearer authorization header value
 */
export function getAuthToken(): string | null {
  return currentAuthToken || (apiClient.defaults.headers.common['Authorization'] as string) || null;
}

// Request Interceptor: Dynamically injects fresh Clerk JWT token before EVERY request
const authRequestInterceptor = async (config: InternalAxiosRequestConfig) => {
  let token: string | null = null;

  // 1. Try active token getter from React context / useAuth
  if (activeTokenGetter) {
    try {
      token = await activeTokenGetter();
    } catch {
      token = null;
    }
  }

  // 2. Fallback to Clerk global instance if available in window
  if (!token && typeof window !== 'undefined' && (window as any).Clerk?.session) {
    try {
      token = await (window as any).Clerk.session.getToken();
    } catch {
      token = null;
    }
  }

  // 3. Fallback to manually set auth token
  if (!token && currentAuthToken) {
    token = currentAuthToken;
  }

  if (token) {
    const bearer = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
    config.headers.set('Authorization', bearer);
  }

  return config;
};

// Response Interceptor: Unwraps ApiResponse envelope & handles 401 automatic token refresh retry
function makeAuthResponseInterceptor(client: AxiosInstance) {
  return async (error: AxiosError<ApiErrorResponse>) => {
    const originalRequest = error.config as any;

    // If 401 Unauthorized and request has not been retried yet, force fresh token and retry once
    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;

      let freshToken: string | null = null;
      if (activeTokenGetter) {
        try {
          freshToken = await activeTokenGetter({ skipCache: true });
        } catch {
          freshToken = null;
        }
      } else if (typeof window !== 'undefined' && (window as any).Clerk?.session) {
        try {
          freshToken = await (window as any).Clerk.session.getToken({ skipCache: true });
        } catch {
          freshToken = null;
        }
      }

      if (freshToken) {
        const bearer = freshToken.startsWith('Bearer ') ? freshToken : `Bearer ${freshToken}`;
        setAuthToken(freshToken);
        if (originalRequest.headers?.set) {
          originalRequest.headers.set('Authorization', bearer);
        } else {
          originalRequest.headers = originalRequest.headers || {};
          originalRequest.headers['Authorization'] = bearer;
        }
        return client(originalRequest);
      }
    }

    if (error.response && error.response.data) {
      const apiError = error.response.data.error;
      const customError = new Error(apiError?.message || 'An API error occurred');
      (customError as any).code = apiError?.code;
      (customError as any).statusCode = error.response.data.statusCode;
      (customError as any).details = apiError?.details;
      return Promise.reject(customError);
    }
    return Promise.reject(error);
  };
}

apiClient.interceptors.request.use(authRequestInterceptor, (error) => Promise.reject(error));
apiClient.interceptors.response.use(
  (response: AxiosResponse<ApiResponse>) => {
    if (response.data && response.data.success !== undefined) {
      return response.data.data;
    }
    return response.data;
  },
  makeAuthResponseInterceptor(apiClient)
);

uploadClient.interceptors.request.use(authRequestInterceptor, (error) => Promise.reject(error));
uploadClient.interceptors.response.use(
  (response: AxiosResponse<ApiResponse>) => {
    if (response.data && response.data.success !== undefined) {
      return response.data.data;
    }
    return response.data;
  },
  makeAuthResponseInterceptor(uploadClient)
);

