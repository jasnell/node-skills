// @node-skills {"added":["v26.9.0"],"flags":["--experimental-vfs","--no-warnings"]}
// Test fs-touching code against an in-memory tree. The code under test must take a root
// directory: VFS cannot stand in for fixed real paths such as /etc/app.json (unlike mock-fs).
import vfs from 'node:vfs';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { test } from 'node:test';

// Code under test: plain node:fs, no VFS awareness.
async function loadConfigs(root) {
  const out = {};
  for (const name of await fs.readdir(path.join(root, 'conf.d'))) {
    if (name.endsWith('.json')) out[name] = JSON.parse(await fs.readFile(path.join(root, 'conf.d', name), 'utf8'));
  }
  await fs.writeFile(path.join(root, 'loaded.txt'), Object.keys(out).join(','));
  return out;
}

test('loadConfigs reads every .json and writes a marker', async () => {
  using fixture = vfs.create();
  // Seed BEFORE mounting: unprefixed paths only work while unmounted.
  fixture.mkdirSync('/conf.d', { recursive: true });
  fixture.writeFileSync('/conf.d/a.json', '{"a":1}');
  fixture.writeFileSync('/conf.d/b.json', '{"b":2}');
  fixture.writeFileSync('/conf.d/notes.txt', 'ignored');
  const root = fixture.mount();

  assert.deepEqual(await loadConfigs(root), { 'a.json': { a: 1 }, 'b.json': { b: 2 } });
  assert.equal(await fs.readFile(path.join(root, 'loaded.txt'), 'utf8'), 'a.json,b.json');
});

test('a missing directory surfaces as ENOENT', async () => {
  using empty = vfs.create();
  const root = empty.mount();
  await assert.rejects(loadConfigs(root), { code: 'ENOENT' });
});

test('fs.glob and fs.cp do not route into a mount (verified on v26.13 and main)', async () => {
  using v = vfs.create();
  v.writeFileSync('/x.txt', 'x');
  const root = v.mount();
  assert.deepEqual(await Array.fromAsync(fs.glob(`${root}/*.txt`)), []);
  await assert.rejects(fs.cp(root, `${root}-copy`, { recursive: true }));
});
