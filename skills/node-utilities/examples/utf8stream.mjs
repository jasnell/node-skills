// @node-skills {"added":["v24.6.0"]}
// fs.Utf8Stream: buffered UTF-8 file writer with flush/flushSync, reopen (log rotation), drop.
import fs from 'node:fs';
import { once } from 'node:events';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';

using dir = fs.mkdtempDisposableSync(join(tmpdir(), 'nsk-'));
const dest = join(dir.path, 'logs', 'app.log');
const log = new fs.Utf8Stream({ dest, mkdir: true, minLength: 4096 }); // buffer until 4 KiB
await once(log, 'ready');
log.write('line 1\n');
log.write('line 2\n');
assert.equal(fs.readFileSync(dest, 'utf8'), '');             // still buffered
log.flushSync();                                             // e.g. in an exit handler
assert.equal(fs.readFileSync(dest, 'utf8'), 'line 1\nline 2\n');
assert.throws(() => log.write(Buffer.from('x')), { code: 'ERR_INVALID_ARG_TYPE' }); // contentMode 'utf8'

// Rotation: rename the file, then reopen() the same path.
fs.renameSync(dest, `${dest}.1`);
log.reopen(dest);
await once(log, 'ready');
log.write('after rotate\n');
log.end();                                                   // end() flushes; destroy() does not
await once(log, 'finish');
assert.equal(fs.readFileSync(dest, 'utf8'), 'after rotate\n');

// maxLength: writes that would overflow the buffer are dropped and reported.
const small = new fs.Utf8Stream({ dest: join(dir.path, 'small.log'), maxLength: 10, minLength: 100 });
await once(small, 'ready');
const dropped = [];
small.on('drop', (d) => dropped.push(d));
small.write('12345');
small.write('6789012');
small.end();
await once(small, 'close');
assert.deepEqual(dropped, ['6789012']);

// Pitfall: `using` calls destroy(), which discards unflushed data.
const lossy = join(dir.path, 'lossy.log');
{
  using s = new fs.Utf8Stream({ dest: lossy, minLength: 4096 });
  await once(s, 'ready');
  s.write('lost\n');
}
await new Promise((r) => setTimeout(r, 20));
assert.equal(fs.readFileSync(lossy, 'utf8'), '');
