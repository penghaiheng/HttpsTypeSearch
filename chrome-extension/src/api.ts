import type { SearchItem, SearchResponse } from './types.js';

const LOCAL_ENDPOINT_HOSTS = new Set(['localhost', '127.0.0.1']);
const FETCH_TIMEOUT_MS = 8000;

export function validateEndpoint(baseEndpoint: string): string {
  const rawValue = baseEndpoint.trim();
  if (!rawValue) {
    throw new Error('Endpoint is required.');
  }

  let parsed: URL;
  try {
    parsed = new URL(rawValue);
  } catch {
    throw new Error('Endpoint must be a valid http:// or https:// URL.');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Endpoint protocol must be http:// or https://.');
  }

  if (!LOCAL_ENDPOINT_HOSTS.has(parsed.hostname)) {
    throw new Error('Endpoint host must be localhost or 127.0.0.1 so the extension host permissions can reach it.');
  }

  parsed.hash = '';
  parsed.search = '';

  const pathname = parsed.pathname.replace(/\/+$/, '');
  return `${parsed.origin}${pathname}`;
}

export function getEndpointGuidance(baseEndpoint: string): string {
  try {
    const parsed = new URL(baseEndpoint.trim());
    if (parsed.protocol === 'https:' && LOCAL_ENDPOINT_HOSTS.has(parsed.hostname)) {
      return 'Using HTTPS on localhost requires a certificate trusted by Chrome/your OS. The extension cannot ignore self-signed certificate errors. Trust the certificate or switch to http://localhost / http://127.0.0.1. 中文提示：扩展无法忽略 HTTPS 证书错误；请先信任证书，或改用本地 http 地址。';
    }
    if (parsed.protocol === 'http:' && LOCAL_ENDPOINT_HOSTS.has(parsed.hostname)) {
      return 'HTTP on localhost avoids certificate trust problems. Only use it for a local machine service that you trust. 中文提示：HTTP 可绕过证书问题，但仅建议本机可信服务使用。';
    }
  } catch {
    // Fall through to the generic guidance below.
  }

  return 'Use a local endpoint such as https://127.0.0.1:19456 or http://localhost:19456. Non-local hosts are not allowed by this extension manifest. 中文提示：请使用 localhost/127.0.0.1，本扩展不支持非本机地址。';
}

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
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
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
  } catch (error) {
    throw toApiError(error, url);
  } finally {
    clearTimeout(timer);
  }
}

function endpoint(base: string, path: string): string {
  return `${validateEndpoint(base)}${path}`;
}

function toApiError(error: unknown, requestUrl: string): Error {
  const parsedUrl = safeParseUrl(requestUrl);
  const target = parsedUrl ? parsedUrl.origin : requestUrl;

  if (error instanceof DOMException && error.name === 'AbortError') {
    return new Error(`Request to ${target} timed out after ${Math.floor(FETCH_TIMEOUT_MS / 1000)} seconds. Make sure the local API service is running and reachable.`);
  }

  if (error instanceof TypeError) {
    const reasons = [
      'the local API service is not running',
      'the endpoint URL/port is incorrect'
    ];

    if (parsedUrl && parsedUrl.protocol === 'https:' && LOCAL_ENDPOINT_HOSTS.has(parsedUrl.hostname)) {
      reasons.push('Chrome does not trust the local HTTPS certificate');
    }

    reasons.push('Chrome blocked the request because of host permission or network/CORS mismatch');

    return new Error(
      `Failed to reach ${target}. Possible causes: ${reasons.join('; ')}. ` +
      'Chrome extensions cannot ignore HTTPS certificate errors. If you use a self-signed local certificate, trust it in the OS/Chrome, or switch the endpoint to http://localhost / http://127.0.0.1. ' +
      '中文提示：扩展无法忽略 HTTPS 证书错误。请先在系统/Chrome 信任证书，或改用 http://localhost / http://127.0.0.1。'
    );
  }

  return error instanceof Error ? error : new Error('Unexpected request failure.');
}

function safeParseUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
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
