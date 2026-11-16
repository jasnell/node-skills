# node-skills

Agent skills that teach coding agents about Node.js features newer than their
training data. The set covers new built-in modules, new APIs and flags,
changed defaults, and removals since Node.js 24 LTS. The skills work in
**Claude Code** and **opencode**.

Every skill is written from the nodejs/node docs at a pinned commit. Its
claims are checked by runnable examples on v24 LTS, current, and a build of
`main`.

## Skills

| Skill | Covers | Floor |
| --- | --- | --- |
| `node-experimental-check` | Probe script and procedure for checking experimental or new APIs against the *installed* Node.js | 24 |
| `node-modern-migration` | Removed and deprecated APIs (v25–v28) and changed defaults | 24 |
| `node-modules-loading` | Type stripping (Stable), `require(esm)`, `module.registerHooks`, package maps, compile cache, `--config-file` | 24 |
| `node-process-timeout` | `--process-timeout`, `--report-on-process-timeout`, `subprocess.timedOut` | 26.11 |
| `node-bench` | `node:bench` benchmark runner and `--bench*` flags | 26.9 |
| `node-histogram-stats` | `Histogram` statistics: significance tests, confidence intervals, EWMA, burn rate, snapshots, export/import | 24.12 |
| `node-test-runner` | New `node:test` features: tags, randomizing order, rerunning failures, global setup, mock helpers | 24 |
| `node-utilities` | Small built-ins that replace npm packages (debounce/throttle, temp files, URLPattern, locks, Worker) | 24 |
| `node-sqlite` | `node:sqlite` today: `Database`/`Statement`, tag store, authorizer, virtual tables | 24 |
| `node-zip` | Built-in ZIP archives in `node:zlib` | 26.8 |
| `node-stream-iter` | Experimental `node:stream/iter` and `node:zlib/iter` | 24.20 |
| `node-crypto` | Argon2, post-quantum algorithms, KMAC, SHA-3/SHAKE, new AEADs, UUIDv7, PKCS#12, X.509 generation | 24.7 |
| `node-permissions` | Permission model: `--allow-*` scopes, `permission.drop()`, audit mode | 24 |
| `node-diagnostics` | Bounded/tracing channels, AsyncLocalStorage scopes, profile handles, debugger probe mode | 24 |
| `node-networking` | `net/promises`, `BoundSocket`, BlockList, proxy env, header validation, changed HTTP defaults | 24 |
| `node-vfs` | `node:vfs` and single executable apps with VFS assets (`--build-sea`) | 26.4 |
| `node-ffi` | `node:ffi`: calling C functions from shared libraries | 26.1 |
| `node-quic-dtls` | `node:quic` and `node:dtls` (needs a build configured with QUIC/DTLS) | 26.x |

Skills covering Stability 1.x features start with an **Experimental API**
banner. It sends the agent to `node-experimental-check` to verify the details
against the installed version before writing code.

## Install

### Claude Code

As a plugin (recommended: versioned, updatable, skills namespaced as `node-skills:*`):

```text
/plugin marketplace add <path-or-git-url-of-this-repo>
/plugin install node-skills@node-skills
```

Or as plain skills, symlinked so that `git pull` updates them:

```sh
node install/install.mjs --target claude                       # ~/.claude/skills
node install/install.mjs --target claude --scope project --dir path/to/project
```

### opencode

```sh
node install/install.mjs --target opencode                     # ~/.config/opencode/skills
node install/install.mjs --target opencode --scope project --dir path/to/project
```

opencode also reads `~/.claude/skills`, so the Claude Code install already
works there. Alternatively, add this repo's `skills/` directory to the
`skills` array in `opencode.json`.

Installer options: `--mode copy` (instead of symlinks), `--only a,b`,
`--uninstall`, and `--dry-run`. Uninstall removes only what the installer
created.

## Maintaining

The repo includes a project-level maintainer skill,
`.claude/skills/node-skills-maintainer`. It is loaded by Claude Code and
opencode when working inside this repo, and isn't shipped with the plugin.
It covers the whole update process for new Node.js releases:

- surveying new and changed APIs (`tools/survey.mjs`) and finding drift;
- triage and where each feature belongs;
- delegating authoring to parallel agents with a standard brief;
- verifying on the binary matrix;
- writing descriptions that trigger, with the trigger eval;
- lifecycle events (promotions, removals, EOL of the floor line);
- the lessons from the first build.

Ask an agent in this repo something like "Node.js 26.14 is out, update the
skills".

## Tools

The tools need only Node.js 24+, with no dependencies.

| Command | Purpose |
| --- | --- |
| `node tools/survey.mjs --node-dir ../node --since v26.13.0 --changes --uncovered` | New APIs/changes since a baseline release, and which no skill mentions |
| `node --test tools/` | Structure, lint and budget tests (run in CI) |
| `node tools/skill-budget.mjs [--check]` | Context cost per skill: resident ≤ 200 tokens, activation ≤ 1000 |
| `node tools/skill-lint.mjs` | Links, `meta.json`, experimental banner, example headers |
| `NODE=/path/to/node node tools/run-examples.mjs [skill]` | Run every example and skip versions outside each example's `added` range |
| `node tools/check-drift.mjs --node-dir ../node` | Upstream doc changes since each skill's pinned commit |
| `node tools/trigger-eval.mjs --model sonnet --runs 2` | Does each description make Claude Code load the right skill? (uses model calls) |
| `node tools/discrepancies.mjs` | Rebuild `DISCREPANCIES.md` from every `meta.json` |

`skill-budget.mjs` and `skill-lint.mjs` are adapted from
[mcollina/skills](https://github.com/mcollina/skills); see
`THIRD_PARTY_NOTICES.md`.

See `AGENTS.md` for the authoring contract, `SURVEY.md` for the feature
inventory, `PLAN.md` for the design and decisions, and `DISCREPANCIES.md` for
the doc/behavior mismatches found while testing.

## License

MIT. See `LICENSE`. Third-party notices are in `THIRD_PARTY_NOTICES.md`.
