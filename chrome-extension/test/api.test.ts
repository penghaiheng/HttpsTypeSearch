import assert from 'node:assert/strict';
import test from 'node:test';
import { searchByTerm, validateEndpoint } from '../src/api.js';

test('validateEndpoint accepts only localhost and 127.0.0.1 http/https URLs', () => {
  assert.equal(validateEndpoint('https://127.0.0.1:19456/'), 'https://127.0.0.1:19456');
  assert.equal(validateEndpoint('http://localhost:19456/api/'), 'http://localhost:19456/api');
  assert.throws(() => validateEndpoint('https://example.com:19456'), /localhost or 127\.0\.0\.1/);
});

test('searchByTerm surfaces helpful local HTTPS certificate guidance on fetch failures', async () => {
  const originalFetch = globalThis.fetch;

  try {
    globalThis.fetch = async () => {
      throw new TypeError('Failed to fetch');
    };

    await assert.rejects(
      () => searchByTerm('https://127.0.0.1:19456', '', 'login', 5),
      /cannot ignore HTTPS certificate errors[\s\S]*trust it in the OS\/Chrome[\s\S]*http:\/\/localhost[\s\S]*中文提示：扩展无法忽略 HTTPS 证书错误/
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
