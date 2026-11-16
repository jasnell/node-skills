# Version differences: v24.x versus v26.12+

stream/iter landed on main as v25.9.0 and was backported to v24.20.0. A large
follow-up (#66483) shipped in **v26.12.0** and has **not** been backported to v24.x.
Checked on v24.22.3, v26.13.0 and main. The v26.1 to v26.11 rows come from
CHANGELOG_V26, because no binary for those versions was run. The docs (pinned at `ab476eccd03`) describe only the
v26.12+ behavior and have no `changes:` entries for these differences.

| Behavior | v24.x (v24.22.3), v26 before 26.12 | v26.12+ and main |
| --- | --- | --- |
| `budget` for `push`, `duplex`, `broadcast`, `share`, `shareSync` | must be **>= 16384**; smaller values throw `ERR_OUT_OF_RANGE` | any positive integer |
| `pull(src, { signal })` with an already-aborted signal | **throws `signal.reason` synchronously** from `pull()` | returns an iterable, and reading it rejects |
| `pipeToSync()` when `writer.endSync()` returns `-1` | returns the byte count; the close finishes once the data is read | throws `ERR_INVALID_STATE` |
| `pipeToSync({ failOnIncompleteClose })` | not recognized (ignored) | supported |
| `shareSync({ backpressure: 'unbounded' \| 'drop-newest' })` | accepted | throws `ERR_INVALID_ARG_VALUE` |
| `dump()`, `dumpSync()` | absent (`dump` is not exported) | v26.12.0+ |

These are the same on both lines: `node:zlib/iter` (present on v24.22.3), the classic stream adapters,
`Readable[Symbol.for('Stream.toAsyncStreamable')]` (present even without the flag), `filehandle.pull`/`writer`,
the strict-mode rejection of unawaited writes, `'drop-oldest'` eviction, and consumer `signal`/`limit`.

## Writing portable code

- Use the default budget (16384) or larger, for example `push({ budget: 65536 })`.
- To cancel before anything is read, pass the signal to the **consumer** (`text(src, { signal })`,
  `pipeTo(..., { signal })`). Both reject on every version. Alternatively, wrap `pull()` in `try`.
- With `pipeToSync()` into a writer that may not close synchronously, consume the readable side and
  be ready for either a return value or `ERR_INVALID_STATE`.
- Restrict `shareSync()` to `'strict'` or `'drop-oldest'`.
- Feature-detect the newer behavior with `try { push({ budget: 1 }) } catch { /* v24-style */ }`, or check
  `typeof dump === 'function'` on the module namespace (both came in v26.12.0).
