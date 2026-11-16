// @node-skills {"added":["v25.9.0","v24.20.0"],"flags":["--experimental-stream-iter"]}
// Push streams and backpressure, duplex channels, broadcast and share (multi-consumer).
// Budgets stay >= 16384: v24.x (checked on v24.22.3) rejects smaller ones with ERR_OUT_OF_RANGE.
import { push, duplex, broadcast, share, from, text, ondrain } from 'node:stream/iter';
import assert from 'node:assert/strict';

// push(): producer and consumer must run concurrently; await every write.
{
  const { writer, readable } = push(); // budget 16384
  const consuming = text(readable);
  for (const word of ['a', 'b', 'c']) await writer.write(word);
  await writer.end();
  assert.equal(await consuming, 'abc');
}

// 'strict' (default) rejects fire-and-forget writes once the single pending slot is taken.
{
  const { writer } = push({ budget: 16384 });
  const full = new Uint8Array(16384);
  const p1 = writer.write(full); // fills the buffer
  const p2 = writer.write(full); // the one allowed pending write
  const p3 = writer.write(full); // over the limit
  await assert.rejects(p3, { code: 'ERR_INVALID_STATE', message: /Backpressure violation/ });
  writer.fail(new Error('done'));
  const settled = await Promise.allSettled([p1, p2]);
  assert.deepEqual(settled.map((r) => r.status), ['fulfilled', 'rejected']);
}

// Sync fast path with async fallback.
{
  const { writer, readable } = push({ budget: 16384 });
  assert.equal(writer.writeSync(new Uint8Array(16384).fill(0x31)), true);
  assert.equal(writer.writeSync('5'), false);      // buffer full: fall back to the async path
  assert.equal(writer.canWrite, false);
  const consuming = text(readable);                // start the consumer so the buffer can drain
  assert.equal(await ondrain(writer), true);       // resolves once there is capacity again
  if (!writer.writeSync('5')) await writer.write('5');
  if (writer.endSync() < 0) await writer.end();
  assert.equal(await consuming, '1'.repeat(16384) + '5');
}

// 'drop-oldest' never blocks; old data is evicted.
{
  const { writer, readable } = push({ budget: 16384, backpressure: 'drop-oldest' });
  writer.writeSync(new Uint8Array(16384).fill(0x61)); // fills the budget
  assert.equal(writer.writeSync('b'), true);           // accepted: the oldest chunk is evicted
  writer.endSync();
  assert.equal(await text(readable), 'b');
}

// duplex(): a connected pair, like socketpair().
{
  const [client, server] = duplex();
  const echo = (async () => {
    for await (const chunks of server.readable) await server.writer.writev(chunks);
    await server.writer.end();
  })();
  await client.writer.write('ping');
  await client.writer.end();
  assert.equal(await text(client.readable), 'ping');
  await echo;
}

// broadcast(): one writer, many consumers (create consumers before writing).
{
  const { writer, broadcast: bc } = broadcast();
  const c1 = bc.push();
  const c2 = bc.push();
  assert.equal(bc.consumerCount, 2);
  const producing = (async () => { await writer.write('hi'); await writer.end(); })();
  assert.deepEqual(await Promise.all([text(c1), text(c2)]), ['hi', 'hi']);
  await producing;
}

// share(): pull-model fan-out of one source; consume concurrently.
{
  const shared = share(from('shared'));
  assert.deepEqual(await Promise.all([text(shared.pull()), text(shared.pull())]), ['shared', 'shared']);
  shared.cancel();
}
