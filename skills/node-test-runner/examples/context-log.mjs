// @node-skills {"added":["v26.6.0","v24.20.0"]}
// context.log(message, data) emits 'test:log' immediately with a structured payload.
import { mkdtempDisposableSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { run } from 'node:test';
import assert from 'node:assert/strict';

using dir = mkdtempDisposableSync(join(tmpdir(), 'nsk-log-'));
const file = join(dir.path, 'log.test.mjs');
writeFileSync(file, `
import { describe, test } from 'node:test';
describe('suite', (s) => {
  s.log('suite ready');
  test('t1', (t) => {
    t.log('fetched user', { userId: 42 });
    t.diagnostic('buffered until the test reports');
  });
});
`);
const logs = [];
for await (const e of run({ files: [file] })) {
  if (e.type === 'test:log') logs.push([e.data.name, e.data.message, e.data.data]);
}
assert.deepEqual(logs, [
  ['suite', 'suite ready', undefined],
  ['t1', 'fetched user', { userId: 42 }], // payload is structured-cloned across the process boundary
]);
