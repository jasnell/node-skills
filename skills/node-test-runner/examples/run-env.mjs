// @node-skills {"added":["v25.6.0","v24.14.0"]}
// run({ env }) replaces (does not merge with) process.env for the test processes.
import { mkdtempDisposableSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { run } from 'node:test';
import assert from 'node:assert/strict';

using dir = mkdtempDisposableSync(join(tmpdir(), 'nsk-env-'));
const file = join(dir.path, 'env.test.mjs');
writeFileSync(file, `import { test } from 'node:test';
test('env', () => { console.log('FLAG=' + process.env.MY_FLAG + ' PATH=' + (process.env.PATH !== undefined)); });`);

const out = [];
for await (const e of run({ files: [file], env: { MY_FLAG: 'on' } })) {
  if (e.type === 'test:stdout') out.push(e.data.message.trim());
}
assert.deepEqual(out, ['FLAG=on PATH=false']); // spread process.env yourself if you need it
assert.throws(() => run({ files: [file], env: {}, isolation: 'none' }), { code: 'ERR_INVALID_ARG_VALUE' });
