// @node-skills {"added":["v19.9.0","v18.19.0"]}
// APM pattern: library publishes on a TracingChannel; the APM binds a span store and subscribes.
import assert from 'node:assert/strict';
import { tracingChannel } from 'node:diagnostics_channel';
import { AsyncLocalStorage } from 'node:async_hooks';

// --- library side: create once at module top level, guard with hasSubscribers.
const queryChannel = tracingChannel('mylib.db.query');
async function query(sql) {
  if (!queryChannel.hasSubscribers) return run(sql);
  return queryChannel.tracePromise(run, { sql }, null, sql);
}
async function run(sql) {
  await new Promise((r) => setTimeout(r, 1));
  if (sql === 'bad') throw new Error('syntax');
  return [{ ok: 1 }];
}

// --- APM side.
const spans = new AsyncLocalStorage();
queryChannel.start.bindStore(spans, (ctx) => ({ name: ctx.sql, parent: spans.getStore()?.name }));
const log = [];
queryChannel.subscribe({
  start: (ctx) => log.push(['start', ctx.sql]),
  end: () => {},
  asyncStart: () => {},
  asyncEnd: (ctx) => log.push(['done', ctx.sql, spans.getStore()?.name, ctx.result?.length]),
  error: (ctx) => log.push(['error', ctx.sql, ctx.error.message]),
});

assert.deepEqual(await query('select 1'), [{ ok: 1 }]);
await assert.rejects(query('bad'), /syntax/);
assert.deepEqual(log, [
  ['start', 'select 1'], ['done', 'select 1', 'select 1', 1],
  ['start', 'bad'], ['error', 'bad', 'syntax'], ['done', 'bad', 'bad', undefined],
]);
