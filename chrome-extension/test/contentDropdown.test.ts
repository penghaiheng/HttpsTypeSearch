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

  // typed-input filtering
  assert.match(content, /filterResults/, 'filterResults function must be present');
  assert.match(content, /filterAndUpdateDropdown/, 'filterAndUpdateDropdown function must be present');
  assert.match(content, /lastResults/, 'lastResults state variable must be present');

  // Alt+K enable/disable shortcut
  assert.match(content, /altKey/, 'Alt modifier key check must be present');
  assert.match(content, /inlineSuggestionsEnabled/, 'inlineSuggestionsEnabled toggle must be present');
  assert.match(content, /storage\.local\.set/, 'toggle must be persisted via chrome.storage.local.set');
  assert.match(content, /storage\.local\.get/, 'toggle must be loaded via chrome.storage.local.get');

  // improved styling: two-line structure
  assert.match(content, /fontWeight.*600|600.*fontWeight/, 'bold title style must be present');
  assert.match(content, /buildItemRow|renderDropdownItems/, 'item row builder must be present');
});
