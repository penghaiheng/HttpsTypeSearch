import type { CustomUrlRule, ExtensionSettings, NativeUrlKey, NativeUrlParams } from './types.js';

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

export function buildSearchTerms(rawUrl: string, settings: ExtensionSettings): { terms: string[]; native: Record<string, string>; custom: Record<string, string> } {
  const nativeParams = parseNativeUrlParams(rawUrl);
  if (!nativeParams) return { terms: [], native: {}, custom: {} };

  const nativeValues: Record<string, string> = {};
  for (const key of settings.nativeUrlKeys) {
    const value = nativeParams[key];
    if (value && value.trim().length > 0) {
      nativeValues[key] = value.trim();
    }
  }

  const customValues: Record<string, string> = {};
  for (const rule of settings.customUrlRules) {
    const value = evaluateCustomRule(nativeParams, rule);
    if (value && value.trim().length > 0) {
      customValues[rule.name] = value.trim();
    }
  }

  const terms = dedupeTerms([...Object.values(nativeValues), ...Object.values(customValues)]);
  return { terms, native: nativeValues, custom: customValues };
}

function evaluateCustomRule(params: NativeUrlParams, rule: CustomUrlRule): string {
  switch (rule.mode) {
    case 'fixed':
      return rule.value ?? '';
    case 'query': {
      const key = (rule.value ?? rule.name).trim();
      if (!key) return '';
      const searchParams = new URLSearchParams(params.query);
      return searchParams.get(key) ?? '';
    }
    case 'template':
      return applyTemplate(rule.value ?? '', params);
    case 'hostVariant':
      return toRootDomain(params.hostname);
    case 'pathSegment': {
      const segments = params.pathname.split('/').filter(Boolean);
      const idx = Number.parseInt(rule.value ?? '0', 10);
      if (!Number.isInteger(idx) || idx < 0 || idx >= segments.length) return '';
      return segments[idx];
    }
    case 'regex': {
      const sourceKey: NativeUrlKey = rule.source ?? 'fullUrl';
      const sourceValue = params[sourceKey] ?? '';
      const pattern = rule.pattern ?? '';
      if (!pattern) return '';
      try {
        const regex = new RegExp(pattern, rule.flags ?? '');
        const match = sourceValue.match(regex);
        if (!match) return '';
        const group = typeof rule.group === 'number' ? rule.group : 1;
        return match[group] ?? match[0] ?? '';
      } catch {
        return '';
      }
    }
    default:
      return '';
  }
}

function applyTemplate(template: string, params: NativeUrlParams): string {
  const nativeReplaced = template.replace(/\{\{(scheme|host|hostname|port|path|pathname|query|origin|fullUrl)\}\}/g, (_m, key: NativeUrlKey) => params[key] ?? '');
  const pathSegments = params.pathname.split('/').filter(Boolean);

  return nativeReplaced.replace(/URL(?:\((\d+)\)|（(\d+)）)/g, (_match, asciiIndex: string | undefined, fullWidthIndex: string | undefined) => {
    const rawIndex = asciiIndex ?? fullWidthIndex ?? '';
    const index = Number.parseInt(rawIndex, 10);
    if (Number.isNaN(index) || index < 1) {
      return '';
    }
    return pathSegments[index - 1] ?? '';
  });
}

function toRootDomain(hostname: string): string {
  const parts = hostname.split('.').filter(Boolean);
  if (parts.length <= 2) return hostname;
  return parts.slice(-2).join('.');
}

function dedupeTerms(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const normalized = normalizeTerm(value);
    if (!normalized) continue;
    if (!seen.has(normalized)) {
      seen.add(normalized);
      result.push(normalized);
    }
  }
  return result;
}

function normalizeTerm(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (trimmed.length === 1) return '';
  return trimmed;
}
