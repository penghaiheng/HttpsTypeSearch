import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

test('compiled content script automatically listens for field activation events', async () => {
  const contentPath = path.resolve(process.cwd(), 'dist/src/content.js');
  const content = await readFile(contentPath, 'utf8');

  assert.match(content, /addEventListener\((['"])focusin\1/);
  assert.match(content, /addEventListener\((['"])click\1/);
  assert.match(content, /addEventListener\((['"])input\1/);
  assert.match(content, /addEventListener\((['"])keydown\1/);
  assert.match(content, /new MutationObserver\(/);
  assert.match(content, /type:\s*['"]FIELD_INTERACTION['"]/);
});
