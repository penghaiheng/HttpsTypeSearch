import assert from 'node:assert/strict';
import test from 'node:test';
import { INTERACTION_REFRESH_MS, resolveSearchUrl, shouldRefreshSearchState } from '../src/backgroundHelpers.js';

test('resolveSearchUrl prefers the tab URL so iframe/about:blank frames still search the page URL', () => {
  assert.equal(resolveSearchUrl('https://parent.example.com/login', 'about:blank'), 'https://parent.example.com/login');
  assert.equal(resolveSearchUrl(undefined, 'https://fallback.example.com'), 'https://fallback.example.com');
});

test('shouldRefreshSearchState only refreshes recent tab state when needed', () => {
  const now = 10_000;
  const recentState = { url: 'https://example.com/login', updatedAt: now - 100 };
  const staleState = { url: 'https://example.com/login', updatedAt: now - INTERACTION_REFRESH_MS - 1 };

  assert.equal(shouldRefreshSearchState(undefined, 'https://example.com/login', now), true);
  assert.equal(shouldRefreshSearchState(recentState, 'https://example.com/login', now), false);
  assert.equal(shouldRefreshSearchState(staleState, 'https://example.com/login', now), true);
  assert.equal(shouldRefreshSearchState(recentState, 'https://other.example.com/login', now), true);
});
