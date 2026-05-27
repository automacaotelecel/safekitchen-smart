import type { ApiResponse } from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3333';

const RETRYABLE_METHODS = new Set(['GET', 'HEAD']);

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export function getToken() {
  return localStorage.getItem('safekitchen_token');
}

export function setToken(token: string) {
  localStorage.setItem('safekitchen_token', token);
}

export function clearToken() {
  localStorage.removeItem('safekitchen_token');
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const method = String(options.method || 'GET').toUpperCase();
  const shouldRetry = RETRYABLE_METHODS.has(method);
  const attempts = shouldRetry ? 3 : 1;

  let lastError: unknown = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string> | undefined),
      };

      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await fetch(`${API_URL}${path}`, { ...options, headers });
      const json = (await response.json().catch(() => null)) as ApiResponse<T> | null;

      if (!response.ok || !json?.ok) {
        throw new Error(json?.message || 'Erro na comunicação com o servidor.');
      }

      return json.data;
    } catch (error) {
      lastError = error;

      if (!shouldRetry || attempt === attempts) {
        break;
      }

      await sleep(700 * attempt);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('Erro na comunicação com o servidor.');
}

export function pdfUrl(labelId: string) {
  const token = getToken();
  return `${API_URL}/api/labels/${labelId}/pdf?token=${token || ''}`;
}

export { API_URL };
