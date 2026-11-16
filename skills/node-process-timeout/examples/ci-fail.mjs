// @node-skills {"added":["v26.11.0"],"timeout":20000}
// --process-timeout: exit 124 plus a "what kept me alive" summary on stderr.
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';

const node = (args, opts) => spawnSync(process.execPath, args, { encoding: 'utf8', timeout: 15_000, ...opts });

// A leaked server + interval: the classic "CI job hangs forever".
const hang = node(['--process-timeout=500ms', '-e', `
  process.on('exit', () => console.log('exit event'));
  process.exitCode = 3;
  require('node:net').createServer().listen(0);
  setInterval(() => {}, 1000);
`]);
assert.equal(hang.status, 124); // like timeout(1); overrides process.exitCode
assert.equal(hang.stdout, ''); // 'exit' and 'beforeExit' are not emitted
assert.match(hang.stderr, /Process timed out after 500ms \(--process-timeout\)\. Exiting with code 124\./);
assert.match(hang.stderr, /Main thread was not executing JavaScript\./);
assert.match(hang.stderr, /Resources keeping the event loop alive:/);
assert.match(hang.stderr, /TCPServerWrap \(listening on .*\)/);
assert.match(hang.stderr, /Timeout \(next due in \d+ms\)/);

// A busy loop: the JavaScript stack is printed instead.
const busy = node(['--process-timeout=300ms', '-e', 'function spinForever() { for (;;); } spinForever();']);
assert.equal(busy.status, 124);
assert.match(busy.stderr, /Main thread was executing JavaScript:\n\s+at spinForever/);

// A process that finishes in time is unaffected.
assert.equal(node(['--process-timeout=30s', '-e', 'setTimeout(() => {}, 10)']).status, 0);

// Duration syntax: positive integer + ms|s|m|h. Anything else exits 9.
for (const bad of ['5', '0s', '1.5s', '-1s', '1d']) {
  const r = node([`--process-timeout=${bad}`, '-e', '0']);
  assert.equal(r.status, 9, bad);
  assert.match(r.stderr, /invalid value for --process-timeout/);
}

// Not allowed in NODE_OPTIONS; incompatible with the inspector and --run.
const env = node(['-e', '0'], { env: { ...process.env, NODE_OPTIONS: '--process-timeout=1s' } });
assert.equal(env.status, 9);
assert.match(env.stderr, /--process-timeout= is not allowed in NODE_OPTIONS/);
assert.match(node(['--process-timeout=1s', '--inspect=0', '-e', '0']).stderr, /either --process-timeout or --inspect can be used, not both/);
assert.equal(node(['--process-timeout=1s', '-e', 'require("node:inspector").open(0)']).status, 1); // ERR_INSPECTOR_NOT_AVAILABLE
assert.match(node(['--report-on-process-timeout', '-e', '0']).stderr, /must be used with --process-timeout/);
