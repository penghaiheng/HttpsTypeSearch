import type { SearchItem, SearchResponse } from './types.js';

function buildAuthHeaders(token: string): Headers {
  const headers = new Headers();
  headers.set('Accept', 'application/json');
  if (token.trim()) {
    headers.set('Authorization', 'Bearer ' + token.trim());
    headers.set('X-Api-Token', token.trim());
  }
  return headers;
}

async function fetchJson<T>(url: string, token: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: buildAuthHeaders(token),
      signal: controller.signal,
      cache: 'no-store'
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`HTTP ${response.status}: ${body || response.statusText}`);
    }
    return (await response.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

function endpoint(base: string, path: string): string {
  return `${base.replace(/\/$/, '')}${path}`;
}

export async function searchByTerm(baseEndpoint: string, token: string, term: string, maxResults: number): Promise<SearchItem[]> {
  const query = new URLSearchParams({ term, limit: String(maxResults) });
  const response = await fetchJson<SearchResponse>(endpoint(baseEndpoint, `/search?${query.toString()}`), token);
  return Array.isArray(response.items) ? response.items : [];
}

export async function fetchPassword(baseEndpoint: string, token: string, uuid: string): Promise<string | undefined> {
  const payload = await fetchJson<{ password?: string }>(endpoint(baseEndpoint, `/entries/${encodeURIComponent(uuid)}/password`), token);
  return payload.password;
}

export async function fetchOtp(baseEndpoint: string, token: string, uuid: string): Promise<string | undefined> {
  const payload = await fetchJson<{ otpCurrent?: string }>(endpoint(baseEndpoint, `/entries/${encodeURIComponent(uuid)}/otp`), token);
  return payload.otpCurrent;
}
