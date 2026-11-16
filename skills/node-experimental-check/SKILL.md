---
name: node-experimental-check
description: Verifies that an experimental or recently added Node.js API, CLI flag, or global exists in the user's installed Node.js before code depends on it, and finds the version-matched docs. Use before writing code that uses any Stability 1.x Node.js feature (node:bench, node:vfs, node:ffi, node:quic, node:dtls, stream/iter, zlib ZipFile, --experimental-* or --allow-* flags) or any API added in Node.js 24+, or when an API "is not a function", ERR_UNKNOWN_BUILTIN_MODULE, or "bad option" appears.
---

# Verify experimental Node.js features before relying on them

Experimental APIs (Stability 1, 1.0, 1.1) change between minor releases.
Option names change, methods move, and flags get renamed or removed. A skill
describes one snapshot. **The installed Node.js is the source of truth.**

## Checklist (do not skip for Stability 1.x)

1. **Find the runtime that will run the code.** Run `node --version`, but
   also check `.nvmrc`, `package.json` `engines`, `volta`, the Dockerfile
   `FROM node:<tag>`, and the CI `node-version`. The shell's `node` may not
   be the one that matters.
2. **Probe the exact items you will use.** Run the bundled script with the
   target binary:
   ```sh
   node scripts/probe.mjs --flag --experimental-stream-iter --module node:stream/iter
   node scripts/probe.mjs --module node:zlib:ZipFile.openSync --global URLPattern
   node scripts/probe.mjs --flag --experimental-bench --list node:bench   # list exports
   node scripts/probe.mjs --node ./out/Release/node --flag --process-timeout
   ```
   The probe passes `--experimental-*`/`--allow-*` flags through to the
   module checks and exits 1 if anything is missing. If you can't run the
   script, use a one-liner instead:
   `node --experimental-x -p "typeof require('node:mod').thing"` and
   `node --help | grep -- --flag`.
3. **Read the docs for that version, not `latest`:**
   `https://nodejs.org/docs/<version>/api/<module>.html`. For a pre-release
   build, read `doc/api/<module>.md` in its checkout. Check the YAML
   `added:`/`changes:` history and the Stability line of each API you use.
4. **Prefer behavior over docs.** For anything subtle (defaults, units,
   error codes), run a 5-line script instead of trusting prose.
5. **Gate or fall back.** If the code must run on several versions, use
   feature detection (`typeof x === 'function'`, a `try { await import() }`
   block), not a version-string compare. State the minimum version in
   `engines` or in a comment.
6. **Tell the user** that the code depends on an experimental API, which
   flag it needs, and that the API may change in minor releases.

## Reading `added:` lists

`added: [v26.8.0, v24.22.0]` means the feature is in 24.22+ on the v24 line
and in 26.8+. It is **not** in v25.x or in 26.0–26.7. A single entry
`v26.1.0` means the feature is not on v24 at all.

## Pitfalls

- A flag that the installed version does not accept fails the process with
  `bad option`. That means the version lacks the feature, not that the
  flag is spelled wrong.
- Some modules only resolve with the `node:` prefix (`node:sqlite`,
  `node:test`, `node:bench`) and some only behind a flag. Probe with the
  flag.
- Flags that get unflagged keep an opposite `--no-experimental-*` form.
  After that, passing the old `--experimental-*` flag may warn or error.
