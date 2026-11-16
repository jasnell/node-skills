// @node-skills {"added":["v26.5.0","v24.19.0"],"flags":["--no-warnings","--experimental-import-text"]}
// --experimental-import-text: `with { type: 'text' }` gives the file as a string
// default export. The attribute is mandatory.
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = mkdtempSync(join(tmpdir(), 'text-'));
try {
  const url = pathToFileURL(join(dir, 'message.txt')).href;
  writeFileSync(join(dir, 'message.txt'), 'héllo\nworld\n');
  const ns = await import(url, { with: { type: 'text' } });
  assert.equal(ns.default, 'héllo\nworld\n');
  assert.deepEqual(Object.keys(ns), ['default']);
  await assert.rejects(import(`${url}?no-attr`), { code: 'ERR_UNKNOWN_FILE_EXTENSION' });
} finally {
  rmSync(dir, { recursive: true, force: true });
}
