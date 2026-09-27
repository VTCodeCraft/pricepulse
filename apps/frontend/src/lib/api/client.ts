import axios, { isAxiosError } from 'axios';
import type { ApiErrorBody } from '../../types/api';

// One error type for every failed call: HTTP status plus the API's own error code and message.
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

// A free Render instance can take about a minute to wake up, so the first request may be slow.
export const api = axios.create({ baseURL: import.meta.env.VITE_API_URL, timeout: 90_000 });

api.interceptors.request.use(request => {
  if (!request.baseURL) throw new ApiError(0, 'not_configured', 'VITE_API_URL is not set');
  return request;
});

api.interceptors.response.use(undefined, (error: unknown) => {
  if (error instanceof ApiError) throw error;
  if (isAxiosError<ApiErrorBody>(error) && error.response?.data?.error) {
    const { code, message, details } = error.response.data.error;
    throw new ApiError(error.response.status, code, message, details);
  }
  if (isAxiosError(error) && error.code === 'ECONNABORTED') throw new ApiError(0, 'timeout', 'The API took too long to answer');
  throw new ApiError(0, 'network', 'The API could not be reached');
});
