# Lessons from the first build (2026-11, nodejs/node ab476eccd03)

## Docs are not ground truth

- The first build recorded 99 doc/behavior mismatches (see `DISCREPANCIES.md`).
  Categories:
  - Options documented with no `changes:` entry that older lines silently
    ignore.
  - Defaults that differ by line.
  - Undocumented exports.
  - Documented classes that are not exported.
  - Wrong parameter names (`kmacParams.algorithm` vs `name`).
- Malformed versions such as `added: v27.0.0-alpha.0.1.0` and
  `v27.0.0-alpha.0.0.0`. Treat them as v27.0.0 in example headers. In
  tables, label them "v27 alpha" until a stable v27 ships.
- `REPLACEME` means the feature is on main only. Feature-detect it in
  examples instead of inventing a version.
- Some doc claims are simply wrong about safety. `--allow-net` accepts any
  value and grants all network, so it can't restrict to one host. Verify
  security claims by trying to break them.

## Versions

- `added: [v26.8.0, v24.22.0]` is **not** in v25.x or 26.0–26.7. Use
  `tools/versions.mjs` `isAvailable`, never `>= min`.
- The same API differs between lines with no history entry. Examples:
  - `stream/iter` `budget` must be ≥ 16384 on v24.
  - SQLite `ArrayBuffer` binds NULL on v24.19.
  - `zipEntry.rawContent` is a getter on v26.x and a method on v27.
  - `localStorage` without a file is `undefined`, not a throw.

  Only running every line catches these.
- The v24.19 and v24.22 behaviors differ. "v24" is not one target: test the
  oldest and the newest supported v24 release.
- An official build can lack a whole module (QUIC/DTLS need configure
  flags).

## Examples

- Exit 0 from a self-skip reported a pass for code that never ran.
  Hence the exit 77 rule.
- Timing assertions (event-loop delay `min >= resolution`) failed only
  under the runner's parallel load. Stress-test them.
- A set `NODE_OPTIONS` changes behavior (`--config-file` ignores
  `nodeOptions` if `NODE_OPTIONS` is set at all). The runner clears it.
  Remember this when reproducing outside the runner.
- Child-process-based examples (permissions, test runner, timeouts) are the
  most reliable way to test CLI flags. Assert on the exit code, stderr
  shape, and error `code`.

## Descriptions and budgets

- Leading with API names hurt triggering. Lead with the task (see
  `descriptions.md`).
- YAML plain scalars broke on `: `. Always double-quote.
- Bodies end up at 950–1000 tokens. Any addition needs a matching move of
  detail into `rules/`.
- A description written around one context (CI) made a general feature look
  narrow. The user caught it.

## Process

- Build scaffolding and conventions before spawning agents. Broadcast
  any convention added mid-flight to the running agents.
- Agents resumed with SendMessage keep their context. Use that for
  follow-ups such as a newly installed binary or a failing example.
- An agent's report can catch your own mistakes (it found an error in
  `SURVEY.md`). Check the claims in reports against the source before
  repeating them to the user.
- Clean up large scratch artifacts (the QUIC build), or tell the user they
  exist.
