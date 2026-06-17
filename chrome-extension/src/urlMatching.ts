import type { ExtensionSettings, NativeUrlParams } from './types.js';

export function parseNativeUrlParams(rawUrl: string): NativeUrlParams | null {
  try {
    const url = new URL(rawUrl);
    return {
      scheme: url.protocol.replace(/:$/, ''),
      host: url.host,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      pathname: url.pathname,
      query: url.search.startsWith('?') ? url.search.slice(1) : url.search,
      origin: url.origin,
      fullUrl: url.href
    };
  } catch {
    return null;
  }
}

export function buildSearchTerms(rawUrl: string, settings: ExtensionSettings): { terms: string[]; native: Record<string, string>; custom: Record<string, string>; error?: string } {
  const extracted = extractSearchTerm(rawUrl, settings.termSource === 'hostnameWithPort');
  if (!extracted.term) {
    return { terms: [], native: {}, custom: {}, error: extracted.error };
  }

  return {
    terms: [extracted.term],
    native: { hostname: extracted.hostname, host: extracted.host },
    custom: {}
  };
}

export function extractSearchTerm(rawUrl: string, includePort: boolean): { term: string; hostname: string; host: string; error?: undefined } | { term?: undefined; hostname?: undefined; host?: undefined; error: string } {
  if (!rawUrl || !rawUrl.trim()) {
    return { error: 'Current tab URL is empty.' };
  }

  const nativeParams = parseNativeUrlParams(rawUrl);
  if (!nativeParams) {
    return { error: 'Current tab URL cannot be parsed.' };
  }

  if (!/^https?$/i.test(nativeParams.scheme)) {
    return { error: `Unsupported URL scheme: ${nativeParams.scheme}.` };
  }

  if (!nativeParams.hostname) {
    return { error: 'Current tab URL has no hostname.' };
  }

  const hostname = nativeParams.hostname.trim();
  const host = nativeParams.host.trim();
  if (!hostname) {
    return { error: 'Current tab URL has no hostname.' };
  }

  const term = includePort && nativeParams.port ? host : hostname;
  if (!term) {
    return { error: 'Cannot derive search term from current URL.' };
  }

  return { term, hostname, host };
}
