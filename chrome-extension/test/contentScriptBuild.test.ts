import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

test('compiled content script is emitted as classic script (no ESM syntax)', async () => {
  const contentPath = path.resolve(process.cwd(), 'dist/src/content.js');
  const content = await readFile(contentPath, 'utf8');

  assert.equal(/\bexport\s/.test(content), false, 'content.js must not contain export syntax');
  assert.equal(/\bimport\s/.test(content), false, 'content.js must not contain import syntax');
});
