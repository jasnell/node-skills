# Verification: binaries, examples, flakiness

## The binary matrix

| Binary | Why | How |
| --- | --- | --- |
| Oldest v24.x you support | Catches silently ignored options and older semantics | `nvm install 24.19.0` (or whatever the floor is) |
| Latest v24.x | Backports land late in a line; claims like "v24.22+" need a v24.22+ binary | `nvm install 24` |
| Latest of each current line (v26.x, ...) | Behavior that differs from both v24 and main | `nvm install 26` |
| `main` build | Matches the docs you're writing from | `make -j$(nproc)` in the nodejs/node checkout |

Before trusting the `main` build, confirm that it's current. An earlier build
once lacked an API the docs described:

```sh
git -C ../node log -1 --format=%ci; ls -l --time-style=full-iso ../node/out/Release/node
../node/out/Release/node -p "typeof require('node:crypto').<newest API you document>"
```

If the binary is older than HEAD, rebuild it (incremental, a few minutes).

**Special builds.** `node:quic` and `node:dtls` exist only in builds
configured with `--experimental-quic --experimental-dtls`. Standard release
builds and a default `main` build lack them, even when you pass the runtime
flag. Build a copy outside the checkout (about 4.6 GB):

```sh
rsync -a --exclude .git ../node/ /tmp/nq/node && cd /tmp/nq/node \
  && ./configure --experimental-quic --experimental-dtls && make -j$(nproc)
```

Then delete `/tmp/nq` when you're done.

## Example contract (enforced by the runner and the linter)

- Line 1: `// @node-skills {"added":[...YAML added list...],"flags":[...],"timeout":ms}`.
  The runner skips any binary outside the `added` range.
- The example asserts behavior with `node:assert`. "Doesn't throw" is not a
  test: older versions silently ignore unknown options.
- If it can't run at runtime (platform, missing algorithm, build without a
  module), it prints `skip: <reason>` and exits **77**. Exiting 0 counts as a
  pass for something that never ran.
- No network beyond loopback. No leftover files (`await using` with
  `fs.mkdtempDisposable`, or clean up in `finally`). The runner clears
  `NODE_OPTIONS`.
- For version-dependent behavior, detect the behavior rather than the
  version, and assert each branch (see
  `node-stream-iter/examples/v24-differences.mjs`).

## Flakiness

The runner runs 8 examples in parallel, so timing assertions that pass alone
can fail under load. An event-loop delay sample once fell below the timer
resolution. Before trusting a timing example:

```sh
for i in $(seq 40); do ( $NODE ex.mjs >/dev/null 2>&1 || echo FAIL ) & done | wc -l; wait
```

Do this on the oldest and newest binary. Assert medians and ranges, not
`min`/exact counts.

## Recording discrepancies

When the docs and behavior disagree, write it down instead of picking
whichever you prefer:

```json
"discrepancies": [
  "zlib.md:1671-1676 rawContent([options]) is documented as a method added v26.8.0; on v26.13.0 it is a getter. The method arrived in v27 (#66801)."
]
```

Each entry gives the doc file:line, what the doc says, what each tested
binary does, and the PR or commit if known. The skill documents the
**behavior**, with version notes.
