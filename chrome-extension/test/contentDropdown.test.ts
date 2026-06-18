import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

test('compiled content script includes inline dropdown show/hide logic', async () => {
  const contentPath = path.resolve(process.cwd(), 'dist/src/content.js');
  const content = await readFile(contentPath, 'utf8');

  assert.match(content, /data-kp-dropdown/, 'dropdown marker attribute must be present');
  assert.match(content, /INLINE_FILL_REQUEST/, 'INLINE_FILL_REQUEST message type must be present');
  assert.match(content, /hideDropdown|currentDropdown/, 'dropdown hide logic must be present');
  assert.match(content, /positionDropdownNear|getBoundingClientRect/, 'dropdown positioning must be present');
  assert.match(content, /Escape/, 'Escape key dismissal must be present');
});
