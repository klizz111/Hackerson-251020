const DEFAULT_API_BASE = 'http://localhost:5000';

const rawBaseUrl = typeof import.meta !== 'undefined' && import.meta.env && typeof import.meta.env.VITE_API_BASE_URL === 'string'
  ? import.meta.env.VITE_API_BASE_URL
  : DEFAULT_API_BASE;

const sanitizedBaseUrl = rawBaseUrl.trim().replace(/\/$/, '');

export const API_BASE_URL = sanitizedBaseUrl;

export const resolveApiUrl = (path = '/') => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return API_BASE_URL ? `${API_BASE_URL}${normalizedPath}` : normalizedPath;
};

export const DASHBOARD_URL = resolveApiUrl('/dashboard');
