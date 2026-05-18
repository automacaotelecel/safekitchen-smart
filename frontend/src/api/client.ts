import type { ApiResponse } from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3333';

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
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined)
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
}

export function pdfUrl(labelId: string) {
  const token = getToken();
  return `${API_URL}/api/labels/${labelId}/pdf?token=${token || ''}`;
}

export { API_URL };
