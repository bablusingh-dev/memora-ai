import axios, { AxiosInstance, AxiosResponse, AxiosError } from 'axios';
import { ApiResponse, ApiErrorResponse } from '../types/api';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || '/api/v1';

export const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

/**
 * Set or clear Bearer authentication token for outgoing requests
 */
export function setAuthToken(token: string | null) {
  if (token) {
    apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete apiClient.defaults.headers.common['Authorization'];
  }
}

// Response Interceptor: Automatically unwraps standard ApiResponse data envelope
apiClient.interceptors.response.use(
  (response: AxiosResponse<ApiResponse>) => {
    if (response.data && response.data.success !== undefined) {
      return response.data.data;
    }
    return response.data;
  },
  (error: AxiosError<ApiErrorResponse>) => {
    if (error.response && error.response.data) {
      const apiError = error.response.data.error;
      const customError = new Error(apiError?.message || 'An API error occurred');
      (customError as any).code = apiError?.code;
      (customError as any).statusCode = error.response.data.statusCode;
      (customError as any).details = apiError?.details;
      return Promise.reject(customError);
    }
    return Promise.reject(error);
  }
);
