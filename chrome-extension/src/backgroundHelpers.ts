import type { TabState } from './types.js';

export const INTERACTION_REFRESH_MS = 1500;

export function resolveSearchUrl(tabUrl: string | undefined, messageUrl: unknown): string {
  if (typeof tabUrl === 'string' && tabUrl.trim()) return tabUrl;
  if (typeof messageUrl === 'string') return messageUrl;
  return '';
}

export function shouldRefreshSearchState(
  existingState: Pick<TabState, 'url' | 'updatedAt'> | undefined,
  url: string,
  now = Date.now(),
  maxAgeMs = INTERACTION_REFRESH_MS
): boolean {
  if (!existingState) return true;
  if (existingState.url !== url) return true;
  return now - existingState.updatedAt > maxAgeMs;
}
