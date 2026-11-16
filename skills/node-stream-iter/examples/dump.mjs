// @node-skills {"added":["v26.12.0"],"flags":["--experimental-stream-iter"]}
// dump(): drain a source to completion while retaining nothing (v26.12.0+, not on v24).
import { dump, dumpSync, from, fromSync, pull, tap } from 'node:stream/iter';
import assert from 'node:assert/strict';

let seen = 0;
await dump(pull(from('hello world'), tap((chunks) => { if (chunks) for (const c of chunks) seen += c.byteLength; })));
assert.equal(seen, 11);
await assert.rejects(dump(from('0123456789'), { limit: 3 }), { code: 'ERR_OUT_OF_RANGE' });
assert.equal(dumpSync(fromSync('abc')), undefined);
