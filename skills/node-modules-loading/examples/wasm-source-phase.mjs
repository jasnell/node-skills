// @node-skills {"added":["v24.5.0","v22.19.0"]}
// Wasm source-phase imports: `import source m from './x.wasm'` and
// `import.source(url)` yield an uninstantiated WebAssembly.Module, so you can
// instantiate it many times with your own import objects. No flag since v24.5.0.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// (module (import "env" "base" (func (result i32)))
//         (func (export "answer") (result i32) call 0 i32.const 1 i32.add))
const wasm = Uint8Array.from([
  0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00,
  0x01, 0x05, 0x01, 0x60, 0x00, 0x01, 0x7f,
  0x02, 0x0c, 0x01, 0x03, 0x65, 0x6e, 0x76, 0x04, 0x62, 0x61, 0x73, 0x65, 0x00, 0x00,
  0x03, 0x02, 0x01, 0x00,
  0x07, 0x0a, 0x01, 0x06, 0x61, 0x6e, 0x73, 0x77, 0x65, 0x72, 0x00, 0x01,
  0x0a, 0x09, 0x01, 0x07, 0x00, 0x10, 0x00, 0x41, 0x01, 0x6a, 0x0b,
]);

const dir = mkdtempSync(join(tmpdir(), 'wasm-'));
try {
  writeFileSync(join(dir, 'lib.wasm'), wasm);
  // Static `import source` is syntax, so it lives in its own module.
  writeFileSync(join(dir, 'main.mjs'), `
    import source lib from './lib.wasm';
    const again = await import.source('./lib.wasm');
    const a = await WebAssembly.instantiate(lib, { env: { base: () => 41 } });
    const b = await WebAssembly.instantiate(lib, { env: { base: () => 99 } });
    console.log(JSON.stringify({ isModule: lib instanceof WebAssembly.Module, same: again === lib,
      a: a.exports.answer(), b: b.exports.answer() }));`);
  const r = spawnSync(process.execPath, [join(dir, 'main.mjs')], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(JSON.parse(r.stdout), { isModule: true, same: true, a: 42, b: 100 });
} finally {
  rmSync(dir, { recursive: true, force: true });
}
