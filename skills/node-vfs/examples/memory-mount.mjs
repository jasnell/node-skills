// @node-skills {"added":["v26.9.0"],"flags":["--experimental-vfs","--no-warnings"]}
// In-memory VFS: seed, mount, reach it through node:fs, require() and import(), then unmount.
import vfs from 'node:vfs';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';

const require = createRequire(import.meta.url);

const v = vfs.create();
v.mkdirSync('/lib', { recursive: true });
v.writeFileSync('/lib/greet.cjs', 'module.exports = () => "hi from " + __filename;');
v.writeFileSync('/mod.mjs', 'export const value = 42; export const url = import.meta.url;');

assert.equal(v.mounted, false);
assert.equal(v.mountPoint, null);
const mp = v.mount(); // e.g. '/dev/null/vfs/1' -- assigned at runtime, never hard-code it
assert.ok(mp.startsWith(vfs.vfsBase()));
assert.deepEqual(fs.readdirSync(vfs.vfsBase()), [path.basename(mp)]);

// node:fs, require() and import() all see it under the mount point.
assert.equal(require(`${mp}/lib/greet.cjs`)(), `hi from ${mp}/lib/greet.cjs`);
const mod = await import(`${v.mountPointURL}/mod.mjs`);
assert.equal(mod.value, 42);
assert.equal(mod.url, `${v.mountPointURL}/mod.mjs`);
fs.writeFileSync(`${mp}/out.txt`, 'written via node:fs');

// While mounted, the instance's own methods also take mount-prefixed paths.
assert.throws(() => v.readFileSync('/out.txt'), { code: 'ENOENT' });
assert.equal(v.readFileSync(`${mp}/out.txt`, 'utf8'), 'written via node:fs');

// The mount is in-process only: child processes and the OS cannot see it.
assert.throws(() => fs.copyFileSync(`${mp}/out.txt`, path.join(import.meta.dirname, 'x')), { code: 'EXDEV' });
assert.throws(() => fs.writeFileSync(`${vfs.vfsBase()}/new`, 'x'), { code: 'EROFS' });
assert.throws(() => v.mount(), { code: 'ERR_INVALID_STATE' });

v.unmount();
assert.equal(fs.existsSync(`${mp}/out.txt`), false);
assert.equal(v.readFileSync('/out.txt', 'utf8'), 'written via node:fs'); // un-prefixed again

// `using` unmounts at end of scope.
let mp2;
{
  using scoped = vfs.create();
  scoped.writeFileSync('/a', 'b');
  mp2 = scoped.mount();
  assert.equal(fs.readFileSync(`${mp2}/a`, 'utf8'), 'b');
}
assert.equal(fs.existsSync(`${mp2}/a`), false);

// Under the permission model, mount() needs --allow-fs-vfs.
const code = 'const v=require("node:vfs").create();try{v.mount();console.log("mounted")}catch(e){console.log(e.code)}';
const run = (...f) => spawnSync(process.execPath, [...process.execArgv, '--permission', '--allow-fs-read=*', ...f, '-e', code], { encoding: 'utf8' }).stdout.trim();
assert.equal(run(), 'ERR_INVALID_STATE');
assert.equal(run('--allow-fs-vfs'), 'mounted');
