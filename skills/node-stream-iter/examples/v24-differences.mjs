// @node-skills {"added":["v25.9.0","v24.20.0"],"flags":["--experimental-stream-iter"]}
// Behavior that changed in v26.12.0 (#66483) and is NOT on v24.x (checked on v24.22.3) or v26.1-v26.11.
import { push, pull, from, text, pipeToSync, fromSync, shareSync } from 'node:stream/iter';
import assert from 'node:assert/strict';

// Detect the newer behavior by trying a budget below 16384.
let modern = true;
try {
  push({ budget: 1 });
} catch (err) {
  assert.equal(err.code, 'ERR_OUT_OF_RANGE'); // older: budget must be >= 16384 (push, duplex, broadcast, share, shareSync)
  modern = false;
}

// 1. pull() with an already-aborted signal: newer returns an iterable that rejects; older throws synchronously.
const ac = new AbortController();
ac.abort(new Error('stop'));
if (modern) {
  await assert.rejects(text(pull(from('x'), { signal: ac.signal })), /stop/);
} else {
  assert.throws(() => pull(from('x'), { signal: ac.signal }), /stop/);
}

// 2. pipeToSync() into a writer that cannot close synchronously: newer throws ERR_INVALID_STATE,
//    older returns the byte count and leaves end() pending (failOnIncompleteClose is not recognized).
{
  const { writer, readable } = push();
  if (modern) {
    assert.throws(() => pipeToSync(fromSync('abc'), writer), { code: 'ERR_INVALID_STATE' });
    writer.end(); // the data was accepted; finish closing asynchronously
  } else {
    assert.equal(pipeToSync(fromSync('abc'), writer), 3); // the close completes once the data is read
  }
  assert.equal(await text(readable), 'abc');
}

// 3. shareSync() with 'unbounded'/'drop-newest': newer throws ERR_INVALID_ARG_VALUE, older accepts.
if (modern) {
  assert.throws(() => shareSync(fromSync('x'), { backpressure: 'unbounded' }), { code: 'ERR_INVALID_ARG_VALUE' });
} else {
  shareSync(fromSync('x'), { backpressure: 'unbounded' }).cancel();
}

// Portable code: budgets >= 16384, abort signals on consumers, and only 'strict'/'drop-oldest' for shareSync.
const { writer, readable } = push({ budget: 16384 });
const consuming = text(readable);
await writer.write('portable');
await writer.end();
assert.equal(await consuming, 'portable');
