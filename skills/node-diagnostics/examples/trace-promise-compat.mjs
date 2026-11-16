// @node-skills {"added":["v24.0.0"]}
// tracePromise return value differs by line: v24 wraps everything in a native Promise; v26 does not.
import assert from 'node:assert/strict';
import { tracingChannel } from 'node:diagnostics_channel';

const tc = tracingChannel('mylib.compat');
tc.subscribe({ start() {}, end() {}, asyncStart() {}, asyncEnd() {}, error() {} });
const thenable = { then: (ok) => ok(1) };
const [major, minor] = process.versions.node.split('.').map(Number);

const a = tc.tracePromise(() => thenable, {});
const b = tc.tracePromise(() => 7, {});
if (major < 26) {
  assert.ok(a instanceof Promise && b instanceof Promise);
  assert.equal(await b, 7);
} else {
  assert.equal(b, 7); // v26.0+: non-thenables as-is, plus a process warning
  if (major > 26 || minor >= 5) assert.equal(a, thenable); // v26.5+: thenables as-is
}
