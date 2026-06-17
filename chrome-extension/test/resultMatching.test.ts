import assert from 'node:assert/strict';
import test from 'node:test';
import { collectMatchedFields } from '../src/resultMatching.js';
import { DEFAULT_SETTINGS } from '../src/settings.js';

test('default key URL can be toggled on and off', () => {
  const item = { Uuid: '1', URL: 'https://a.example.com', CustomFields: {} };

  const enabled = collectMatchedFields(item, { ...DEFAULT_SETTINGS, matchDefaultUrl: true, customFieldKeywords: [] });
  assert.deepEqual(enabled, [{ source: 'URL', key: 'URL', value: 'https://a.example.com' }]);

  const disabled = collectMatchedFields(item, { ...DEFAULT_SETTINGS, matchDefaultUrl: false, customFieldKeywords: [] });
  assert.deepEqual(disabled, []);
});

test('CustomFields fuzzy matching supports keyword contains', () => {
  const item = {
    Uuid: '2',
    CustomFields: {
      '123_URL_': 'http://a',
      'URL_123': 'http://b',
      'URL-DD': 'http://c',
      '*URL*': 'http://d',
      'URL (2)': 'http://e',
      Other: 'http://x'
    }
  };

  const matched = collectMatchedFields(item, {
    ...DEFAULT_SETTINGS,
    matchDefaultUrl: false,
    customFieldKeywords: [' URL ']
  });

  assert.equal(matched.length, 5);
  assert.ok(matched.every((field) => field.key.toLowerCase().includes('url')));
});

test('unmatched keys are not shown', () => {
  const item = {
    Uuid: '3',
    URL: 'https://default.example.com',
    CustomFields: {
      Domain: 'https://domain.example.com',
      LoginPath: '/login'
    }
  };

  const matched = collectMatchedFields(item, {
    ...DEFAULT_SETTINGS,
    matchDefaultUrl: false,
    customFieldKeywords: ['url']
  });

  assert.deepEqual(matched, []);
});
