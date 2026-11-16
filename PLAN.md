# Plan: node-skills

Goal: a set of agent skills that teach coding agents about Node.js features
that are newer than their training data. The source of truth is
`nodejs/node` docs and tests. Every claim must trace back to a doc section
or a runnable example. See `SURVEY.md` for the full inventory.

## Principles

1. **Only what's new.** Cover new APIs, changed defaults, and removals. Don't
   re-teach general Node.js (the existing `node` skill covers that).
2. **Version-gate everything.** Each skill starts with a table of feature,
   versions (the full `added:` list), stability, and the flag it needs. Each
   skill also tells the agent to check `process.version` or
   `node --help | grep <flag>` before using a feature, and to fall back
   gracefully on older versions.
3. **Progressive disclosure.** `SKILL.md` stays small (under about 150 lines):
   when to use, key patterns, and pitfalls. API detail goes in `references/*.md`,
   which the agent loads only when needed.
4. **Every example is executable.** `examples/*.mjs` run in CI against a
   pinned Node build and against the latest release. If an example fails,
   the skill is stale.
5. **Traceable to source.** Each skill records the docs it was written from
   (`sources:` list plus the nodejs/node commit). A drift script flags new
   `added:`/`changes:` YAML in those files since that commit.
6. **Descriptions drive triggering.** Each frontmatter `description` names the
   concrete API identifiers and the user phrasings that should activate it
   ("benchmark this function", "zip files", "hung process", "p99 latency").

## Repository layout

```
node-skills/
  README.md                 # what it is, install (symlink into ~/.claude/skills or plugin)
  SURVEY.md  PLAN.md
  skills/
    <skill-name>/
      SKILL.md              # frontmatter: name + description only
      rules/*.md            # detailed API notes, each linked from SKILL.md
      meta.json             # sources, pinned nodejs commit, floor, stability, discrepancies
      examples/*.mjs        # runnable, self-checking (node:assert) examples
  tools/
    survey.mjs              # new APIs/changes vs a baseline version, with skill coverage
    check-drift.mjs         # diff doc YAML for each skill's sources since its pinned commit
    run-examples.mjs        # run every example with $NODE, honoring per-example min version/flags
  .github/workflows/ci.yml  # examples run on pinned node + latest; drift report
```

## Proposed skills (17)

The skills are listed roughly in priority order. Priority weighs how useful a
feature is for general-purpose coding, how unfamiliar it is to agents, and
how stable the API is.

| # | Skill | Covers | Why it's prioritized |
|---|---|---|---|
| 1 | `node-modern-migration` | §4 changed defaults and §5 removals and deprecations, with old-to-new replacement pairs | Stops agents from emitting removed APIs. Highest value for the effort |
| 2 | `node-histogram-stats` | All Histogram statistics, sliding window, export/import, `monitorEventLoopDelay` options, ELU | User-named. Unique capability (latency SLOs, A/B significance tests) |
| 3 | `node-process-timeout` | `--process-timeout`, `--report-on-process-timeout`, `subprocess.timedOut`, diagnosing hangs | User-named. Small and stable soon |
| 4 | `node-test-runner-new` | Tags, randomize/seed, rerun failures, global setup, forbid-only, expected failures, mock helpers, `assert.called*`, `context.log`, OTel | Testing is where agents spend most of their time |
| 5 | `node-bench` | `node:bench`, `--bench*` flags, measurement model, reporters, `doNotOptimize`, isolation/GC | Agents write ad-hoc benchmarks badly. A good fit with skill 2 |
| 6 | `node-modules-loading` | Type stripping now Stable, `require(esm)` Stable, `registerHooks`, `module.register` EOL, package maps, import text, private modules, `"worker"` condition, compile cache, `--config-file` | Corrects the most commonly stale advice |
| 7 | `node-sqlite` | `Database`/`Statement` (renamed), tag store, authorizer, serialize, virtual tables, stats, defaults | Popular. The API changed a lot |
| 8 | `node-crypto-modern` | PQC (ML-KEM, ML-DSA, SLH-DSA, hybrid), Argon2, KMAC/`createMac`, SHA-3 family, AEADs, X.509 generation and inspection, PKCS#12, UUIDv7, raw key formats | Broad demand. Easy to get subtly wrong |
| 9 | `node-zip` | `ZipFile`/`ZipBuffer`/`ZipEntry`, helpers, size guard, `crc32c`, iterable compression | Replaces common npm dependencies |
| 10 | `node-permission-model` | All `--allow-*` flags, `permission.drop`, `--permission-audit`, interaction with FFI/VFS/inspector | Security posture. Agents need to know which flags exist |
| 11 | `node-diagnostics` | Bounded channels and scopes, `TracingChannel` Stable, built-in channels, ALS `withScope`, profile handles, debugger probe mode, inspector events | For APM authors and debugging workflows |
| 12 | `node-utilities` | `util.debounce/throttle/isPartialDeepStrictEqual/markPromiseAsHandled`, Buffer additions, `fs.mkstemp`/disposables/`Utf8Stream`/glob options, `URLPattern`, locks, Temporal in `Stats`, `process.ref/unref` | Grab bag of small but frequently applicable APIs |
| 13 | `node-net-http-modern` | `net/promises`, `BoundSocket`, `BlockList`, keepalive/TOS, `dgram` sync, header validators, websocket mask, env proxy, HTTP/2 options | Server authors |
| 14 | `node-stream-iter` | `stream/iter` concepts, pipelines, consumers, FileHandle pull/writer, interop | Big and experimental. Write after the API settles |
| 15 | `node-vfs-sea` | `node:vfs`, providers, loader integration, `--vfs-load`, `--build-sea` with VFS assets | Packaging and distribution |
| 16 | `node-ffi` | `node:ffi` and `--allow-ffi` | Niche. Replaces `ffi-napi`/koffi in some cases |
| 17 | `node-quic-dtls` | `node:quic`, `node:dtls` | Niche and still in early development. Likely a reference-heavy skill |

Not planned for now: Node-API additions (they belong in the existing
`nodejs-core` skill) and inspector protocol internals.

## Template for SKILL.md

See the skeleton in `AGENTS.md`, which is the authoring contract. Each
SKILL.md has frontmatter (name and description) and an availability table.
Skills covering experimental features add the experimental banner. The rest
of the body is patterns, pitfalls, a "Don't" list, and links to rules/.

## Phases

1. **Scaffolding.** README, the SKILL.md template, `run-examples.mjs`,
   `check-drift.mjs`, and CI. `git init` here.
2. **Pilot (skills 1–3).** Write `node-modern-migration`,
   `node-histogram-stats`, and `node-process-timeout`. Then evaluate
   triggering and accuracy by giving an agent tasks with and without the
   skill (for example "find out if change X regressed p99 latency" or
   "make this test suite fail if it hangs") and compare the output.
   Adjust the template based on what we learn.
3. **Core breadth (skills 4–9).**
4. **Remaining skills (10–17).** Experimental or early-development modules
   ship with an explicit "API may change" banner and a short drift window.
5. **Maintenance.** Run the drift check on a schedule against `nodejs/node`
   `main`. When a feature is promoted to Stable or a new release line
   ships, update the version tables.

## Decisions (2026-11-16)

* **Distribution:** use whichever route suits each harness.
  * Claude Code: install it as a plugin through this repo's marketplace
    (`.claude-plugin/`), or symlink or copy into `~/.claude/skills` with
    `install/install.mjs --target claude`.
  * opencode: install into `~/.config/opencode/skills` with
    `install/install.mjs --target opencode`, or add a `skills` path entry in
    `opencode.json`. opencode also reads `~/.claude/skills`.
* **Version floor:** v24 LTS.
* **Experimental modules:** include them. Every Stability 1.x skill carries a
  verbatim "Experimental API" banner that routes to the
  `node-experimental-check` skill. That skill's probe script verifies flags,
  modules, and exports against the installed binary. `skill-lint` enforces
  the banner.
* **Relationship to the existing `node` skill:** separate.
* **Context budget:** use `skill-budget.mjs` and `skill-lint.mjs` from
  mcollina/skills, plus checks specific to this repo. Budgets: frontmatter
  ≤ 200 tokens, body ≤ 1000 tokens.

## Changes from the first draft of this plan

* Detail files live in `rules/`, not `references/`, so that the
  mcollina/skills tools work unchanged.
* Frontmatter is `name` and `description` only, because frontmatter is
  resident cost on every request. Provenance (sources, pinned commit,
  version floor, stability, doc/behavior discrepancies) moved to
  `meta.json`.
* There is no "When to use" section: the description already does the
  routing. A test enforces this.
* An 18th skill, `node-experimental-check`, holds the procedure and the
  probe script for verifying experimental features.
* Skill names were shortened: `node-test-runner`, `node-crypto`,
  `node-permissions`, `node-networking`, `node-vfs` (which includes SEA).
