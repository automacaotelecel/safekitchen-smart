import type { ApiResponse } from '../types';

const API_URL = String(import.meta.env.VITE_API_URL || 'http://localhost:3333').replace(/\/$/, '');

const RETRYABLE_METHODS = new Set(['GET', 'HEAD']);
const REQUEST_TIMEOUT_MS = 30_000;

class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

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
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const headers = new Headers(options.headers);

      if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
      }

      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }

      const response = await fetch(`${API_URL}${path}`, {
        ...options,
        headers,
        signal: options.signal || controller.signal,
      });

      const json = (await response.json().catch(() => null)) as ApiResponse<T> | null;

      if (response.status === 401 && path !== '/api/auth/login') {
        clearToken();

        if (window.location.pathname !== '/login') {
          window.location.assign('/login');
        }
      }

      if (
        response.status === 402 &&
        !path.startsWith('/api/billing') &&
        window.location.pathname !== '/assinatura'
      ) {
        window.location.assign('/assinatura?expired=1');
      }

      if (!response.ok || !json?.ok) {
        throw new ApiError(
          json?.message || `Erro na comunicação com o servidor (HTTP ${response.status}).`,
          response.status
        );
      }

      return json.data;
    } catch (error) {
      lastError =
        error instanceof DOMException && error.name === 'AbortError'
          ? new Error('O servidor demorou demais para responder.')
          : error;

      if (error instanceof ApiError || !shouldRetry || attempt === attempts) break;
      await sleep(700 * attempt);
    } finally {
      window.clearTimeout(timeout);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('Erro na comunicação com o servidor.');
}

export async function uploadToSignedUrl(
  uploadUrl: string,
  file: File,
  headers: Record<string, string> = {}
) {
  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers,
    body: file,
  });

  if (!response.ok) {
    throw new Error('Não foi possível enviar o arquivo para o armazenamento.');
  }
}

export { API_URL };
