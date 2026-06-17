import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_SETTINGS } from '../src/settings.js';
import type { ExtensionSettings } from '../src/types.js';
import { buildSearchTerms, parseNativeUrlParams } from '../src/urlMatching.js';

test('parseNativeUrlParams extracts key URL parts', () => {
  const parsed = parseNativeUrlParams('https://sub.example.com:8443/path/a?tenant=t1&x=1');
  assert.ok(parsed);
  assert.equal(parsed?.scheme, 'https');
  assert.equal(parsed?.hostname, 'sub.example.com');
  assert.equal(parsed?.port, '8443');
  assert.equal(parsed?.path, '/path/a');
  assert.equal(parsed?.query, 'tenant=t1&x=1');
});

test('buildSearchTerms includes native and custom terms', () => {
  const settings: ExtensionSettings = {
    ...DEFAULT_SETTINGS,
    nativeUrlKeys: ['hostname', 'path'],
    customUrlRules: [
      { name: 'tenant', mode: 'query', value: 'tenant' },
      { name: 'root', mode: 'hostVariant' },
      { name: 'prefix', mode: 'template', value: '{{scheme}}://{{hostname}}' },
      { name: 'captured', mode: 'regex', source: 'fullUrl', pattern: 'tenant=(\\w+)', group: 1 }
    ]
  };

  const result = buildSearchTerms('https://foo.bar.example.com/login?tenant=acme', settings);
  assert.equal(result.native.hostname, 'foo.bar.example.com');
  assert.equal(result.custom.tenant, 'acme');
  assert.equal(result.custom.root, 'example.com');
  assert.equal(result.custom.prefix, 'https://foo.bar.example.com');
  assert.ok(result.terms.includes('acme'));
  assert.ok(result.terms.includes('/login'));
});

test('template rules support URL(n) and URL（n） path placeholders', () => {
  const settings: ExtensionSettings = {
    ...DEFAULT_SETTINGS,
    nativeUrlKeys: [],
    customUrlRules: [
      { name: 'firstSegment', mode: 'template', value: 'URL(1)' },
      { name: 'combined', mode: 'template', value: 'URL(1)-URL（2）' }
    ]
  };

  const result = buildSearchTerms('https://example.com/team/admin/login', settings);
  assert.equal(result.custom.firstSegment, 'team');
  assert.equal(result.custom.combined, 'team-admin');
  assert.deepEqual(result.terms, ['team', 'team-admin']);
});
