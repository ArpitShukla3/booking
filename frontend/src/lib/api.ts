import axios from 'axios';
export class ApiError extends Error {
  status: number;
  fields: Record<string, string>;
  constructor(message: string, status: number, fields: Record<string, string> = {}) { super(message); this.name = 'ApiError'; this.status = status; this.fields = fields; }
}
export const apiClient = axios.create({ baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4000', timeout: 10000, headers: { 'Content-Type': 'application/json' } });
apiClient.interceptors.response.use(response => response, error => {
  const status = error.response?.status || 0;
  const message = status === 404 ? error.response?.data?.error?.message || 'Traveller ID not found' : error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT' ? 'The request timed out. Please try again.' : !status ? 'Cannot reach the backend. Check your connection and try again.' : error.response?.data?.error?.message || 'The request could not be completed. Please try again.';
  return Promise.reject(new ApiError(message, status, error.response?.data?.error?.fields || {}));
});
