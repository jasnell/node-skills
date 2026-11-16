# node-skills: authoring guide

This repository is a library of agent skills. It teaches coding agents about
Node.js features that are newer than their training data. The skills work in
Claude Code and opencode. Both use the same `skills/<name>/SKILL.md` layout.

To update the set for a new Node.js release, or to add a skill, follow the
`node-skills-maintainer` skill (`.claude/skills/node-skills-maintainer/`).
It holds the end-to-end process: survey → triage → author → verify →
descriptions → re-pin. Agents working in this repo load it automatically.

## Layout

```
skills/<name>/
  SKILL.md        router: frontmatter + compact body (loaded when the skill fires)
  rules/*.md      on-demand reference, each linked from SKILL.md
  examples/*.mjs  runnable, self-checking examples (node:assert)
  meta.json       provenance: sources, nodejs commit, versions (never loaded by agents)
tools/            survey, budget, lint, example runner, drift check, trigger eval
install/          installers for Claude Code and opencode
.claude-plugin/   Claude Code plugin + marketplace manifests
```

## Context tiers and budgets

The tiers come from `tools/skill-budget.mjs`, which is adapted from
mcollina/skills.

| Tier | What | Budget |
| --- | --- | --- |
| resident | `SKILL.md` frontmatter | ≤ 200 tokens (about 750 chars). Paid on every request |
| activation | `SKILL.md` body | ≤ 1000 tokens (about 3800 chars). Paid on every fire |
| on-demand | `rules/*.md` | not budgeted; read only when needed |

Run `node tools/skill-budget.mjs --check` and `node tools/skill-lint.mjs`. `node --test tools/`
enforces both.

## Content rules

1. **Write the delta, not the tutorial.** Cover only what an agent trained on
   Node.js ≤ 22 cannot guess: new APIs, new options, changed defaults,
   removals, and traps. Do not explain `fs.readFile`.
2. **The description is the router.** Frontmatter is `name` (matches the
   directory) and `description`. Nothing else goes in frontmatter: metadata
   goes in `meta.json`, so resident cost stays low. The description must:
   * name the concrete API identifiers (`histogram.welchTest`, `ZipFile`);
   * name the user phrasings and task signals that should trigger it
     ("compare benchmark runs", "p99", "zip archive", "hung process");
   * state the version floor ("Node.js 24.21+").
3. **No "When to use" section in the body.** That restates the routing that
   the description already did, and a test enforces this.
4. **Every SKILL.md body starts with an availability table.** Columns:
   feature | versions | stability | flag. The versions column uses the full
   YAML `added:` list (for example `v26.11.0, v24.22.0`) because of
   backports: a feature in `v26.8.0, v24.22.0` is **not** in v25.x. Floor:
   v24 LTS. Do not document anything that is unavailable on v24 without
   saying so.
5. **Experimental and early-development features:** if the skill covers
   anything at Stability 1.x, include this block verbatim near the top:

   > **Experimental API.** Before relying on these details, run the
   > `node-experimental-check` skill's probe (or `node --version` plus a
   > feature-detect one-liner) and check the docs for *the installed
   > version*: `https://nodejs.org/docs/<version>/api/<module>.html`.
   > If the installed version disagrees with this skill, the installed
   > version wins.

6. **Show patterns, then pitfalls, then "don't".** The body has a few
   (3–6) short, correct snippets for the highest-value tasks, a list of
   pitfalls, and the stale alternatives the agent would otherwise reach for
   (the npm package, the removed flag, the old API).
7. **Detail goes in rules/.** Full option lists, every method, and the
   protocol details belong there. Link every rules file from SKILL.md with a
   one-line hook that says when to read it.
8. **Every non-trivial claim must be verified.** Write it from
   `/home/dev/node/doc/api/*.md` at the commit pinned in `meta.json`, and
   check it by running an example. If the docs and the behavior disagree,
   document the behavior and record the discrepancy in `meta.json` under
   `"discrepancies"`.
9. **Never name a file that does not exist.** Reference other skills by
   name, never by relative path, because skills install independently.

## SKILL.md skeleton

```markdown
---
name: node-example
description: <what it covers, with API names>. Use when <task signals / phrasings>. Node.js <floor>+.
---

# <Title>

| Feature | Versions | Stability | Flag |
| --- | --- | --- | --- |

<experimental block, if applicable>

## <Pattern 1>
## Pitfalls
## Don't
## Reference
- [rules/x.md](rules/x.md) — when to read it
```

## Examples

Each `examples/*.mjs` file:

* begins with a header comment on line 1:
  `// @node-skills {"added":["v26.11.0","v24.22.0"],"flags":["--experimental-x"]}`
  Here `added` uses the YAML `added:` semantics (see `tools/run-examples.mjs`)
  and `flags` are passed to node. Add `"timeout": <ms>` if needed;
* asserts its own correctness with `node:assert`, prints little, and exits 0;
* if it finds at runtime that it cannot run (for example, the build lacks
  `node:quic`, or OpenSSL lacks an algorithm), prints the reason and exits
  with **77**. The runner reports that as skipped. Never exit 0 without
  running the check;
* needs no network access, no npm deps, and leaves no files behind (use
  `fs.mkdtempDisposable`/`os.tmpdir` and clean up).

`node tools/run-examples.mjs` runs every example with `$NODE` (default `node`) and skips
any example whose `added` range doesn't include that version.

## meta.json

```json
{
  "nodejsCommit": "ab476eccd03",
  "sources": ["doc/api/perf_hooks.md"],
  "floor": "v24.21.0",
  "stability": "2 - Stable",
  "discrepancies": []
}
```

`node tools/check-drift.mjs --node-dir ../node` reports YAML/stability changes in each
skill's sources since its pinned commit.

## Repository rules

* Commits follow the user's instructions. Never push.
* After editing any skill, run `node --test tools/` (lint, budget, and structure) and
  `NODE=<binary> node tools/run-examples.mjs`.
