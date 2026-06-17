import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_SETTINGS } from '../src/settings.js';
import type { ExtensionSettings } from '../src/types.js';
import { buildSearchTerms, extractSearchTerm, parseNativeUrlParams } from '../src/urlMatching.js';

test('parseNativeUrlParams extracts key URL parts', () => {
  const parsed = parseNativeUrlParams('https://sub.example.com:8443/path/a?tenant=t1&x=1');
  assert.ok(parsed);
  assert.equal(parsed?.scheme, 'https');
  assert.equal(parsed?.hostname, 'sub.example.com');
  assert.equal(parsed?.port, '8443');
  assert.equal(parsed?.path, '/path/a');
  assert.equal(parsed?.query, 'tenant=t1&x=1');
});

test('extractSearchTerm returns hostname only', () => {
  const term = extractSearchTerm('https://qq.com:1234/path?a=1#hash', false);
  assert.equal(term.term, 'qq.com');
});

test('extractSearchTerm returns hostname:port when enabled', () => {
  const term = extractSearchTerm('https://qq.com:1234/path?a=1#hash', true);
  assert.equal(term.term, 'qq.com:1234');
});

test('extractSearchTerm keeps hostname when URL has no explicit port', () => {
  const term = extractSearchTerm('https://qq.com/path?a=1#hash', true);
  assert.equal(term.term, 'qq.com');
});

test('buildSearchTerms ignores path/query/hash', () => {
  const settings: ExtensionSettings = { ...DEFAULT_SETTINGS, termSource: 'hostnameWithPort' };
  const result = buildSearchTerms('https://example.com:9443/team/admin/login?tenant=acme#top', settings);
  assert.deepEqual(result.terms, ['example.com:9443']);
});

test('buildSearchTerms returns error for unsupported scheme', () => {
  const result = buildSearchTerms('chrome://settings', DEFAULT_SETTINGS);
  assert.deepEqual(result.terms, []);
  assert.match(result.error ?? '', /Unsupported URL scheme/);
});
