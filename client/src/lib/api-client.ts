import axios, { AxiosInstance, AxiosResponse, AxiosError } from 'axios';
import { ApiResponse, ApiErrorResponse } from '../types/api';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000/api/v1';

export const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

// Response Interceptor: Automatically unwraps standard ApiResponse data envelope
apiClient.interceptors.response.use(
  (response: AxiosResponse<ApiResponse>) => {
    // If backend returned our standard JSON envelope with success: true, return response.data.data
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
