import type { ExtensionSettings, MatchedField, SearchItem } from './types.js';

export function collectMatchedFields(item: SearchItem, settings: ExtensionSettings): MatchedField[] {
  const matched: MatchedField[] = [];

  if (settings.matchDefaultUrl) {
    const defaultUrl = normalizeValue(item.URL);
    if (defaultUrl) {
      matched.push({ source: 'URL', key: 'URL', value: defaultUrl });
    }
  }

  const keywords = normalizeKeywords(settings.customFieldKeywords);
  if (keywords.length === 0) {
    return matched;
  }

  const customFields = item.CustomFields ?? {};
  for (const [key, rawValue] of Object.entries(customFields)) {
    const value = normalizeValue(rawValue);
    if (!value) continue;

    const normalizedKey = key.trim().toLowerCase();
    if (!normalizedKey) continue;

    if (keywords.some((keyword) => normalizedKey.includes(keyword))) {
      matched.push({ source: 'CustomFields', key, value });
    }
  }

  return matched;
}

function normalizeKeywords(keywords: string[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const keyword of keywords) {
    const value = String(keyword ?? '').trim().toLowerCase();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    normalized.push(value);
  }
  return normalized;
}

function normalizeValue(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim();
}
