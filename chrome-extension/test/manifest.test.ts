import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

test('manifest injects the content script into all frames including about:blank iframes', async () => {
  const manifestPath = path.resolve(process.cwd(), 'manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as {
    content_scripts?: Array<{ js?: string[]; all_frames?: boolean; match_about_blank?: boolean }>;
  };

  const contentScript = manifest.content_scripts?.find((entry) => entry.js?.includes('src/content.js'));
  assert.ok(contentScript, 'expected manifest content script entry for src/content.js');
  assert.equal(contentScript?.all_frames, true);
  assert.equal(contentScript?.match_about_blank, true);
});
