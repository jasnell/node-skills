# Delegating skill authoring to parallel agents

Delegate when three or more skills need substantial work. One agent per
skill is wasteful. Group the work into ≤ 7 agents, with 2–3 skills each, and
put **overlapping topics in the same agent** so that boundaries stay
consistent. The first build used these groups:

| Agent | Skills | Why together |
| --- | --- | --- |
| A | modern-migration, modules-loading | both cover module.register EOL and strip-types renames |
| B | histogram-stats, bench, process-timeout | bench results relate to Histogram |
| C | test-runner, utilities | broad, small APIs |
| D | sqlite, zip, stream-iter | zlib iterable compression is shared by zip and stream-iter |
| E | crypto, permissions | --allow-openssl-store spans both |
| F | diagnostics, networking | channels, profiling, net |
| G | vfs, ffi, quic-dtls | experimental modules that need special flags or builds |

Do the shared scaffolding yourself **before** you spawn the agents:
tools, template changes, and any new convention. Agents copy whatever
exists when they start. A convention added mid-flight, such as the exit-77
rule, has to be sent to every running agent.

## Brief template

Fill in the parts in angle brackets. Every line exists because an agent once
got it wrong.

```text
You are authoring/updating agent skills in /home/dev/node-skills. They teach coding
agents about Node.js features newer than their training data. FIRST read
AGENTS.md (the authoring contract; follow it exactly) and SURVEY.md. Then read
the finished exemplar skill skills/<a good existing skill>/ to match its style.

## Ground truth
- Docs: <node checkout>/doc/api/*.md at commit <sha> (pin this in meta.json).
  Read the YAML added:/changes: and Stability lines for every API you document.
- Binaries: main build <path> (<version>); releases <oldest v24>, <latest v24>,
  <latest current>.
- Every non-trivial claim must be verified by an example you run. If the docs and
  behavior disagree, document the behavior and record the discrepancy (with
  doc/api file:line) in meta.json "discrepancies" AND in your report.
  If you can't verify something, leave it out or mark it as docs-only.

## Your skills (create or edit only these directories)
1. `<skill>` — <scope: APIs, flags, sources, the user TASKS to focus on, the
   "Don't" list of stale alternatives, boundaries with sibling skills by name>

## Constraints
- Floor is v24 LTS. Version columns use the full YAML added: list.
- The description routes: task first, then triggers, then API names, then the
  version floor; it must be a double-quoted YAML string ≤ 200 tokens of
  frontmatter. Body ≤ 1000 tokens. No "When to use" heading.
- Stability 1.x content needs the verbatim **Experimental API.** banner.
- Examples: line-1 `// @node-skills {...}` header, self-asserting, no network,
  no leftover files. Exit 77 with "skip: <reason>" when the example can't run
  at runtime. Never exit 0 without running the checks.
- Validate: skill-lint, skill-budget --check, node --test tools/, and
  run-examples on EVERY binary listed above.
- Do not edit outside your directories. Run no git commands that modify state.

## Final report (short)
Per skill: files, budget numbers, example results per binary, discrepancies
(file:line), anything left out or unverified.
```

## While the agents run

- Don't do overlapping work yourself. Use the time for shared files: the
  README, CI, installers.
- An agent that finished keeps its context. Send it follow-ups (a new
  binary, a failing example) through SendMessage instead of spawning a
  fresh agent.

## Reviewing what comes back

- Re-run the gate yourself. Agents report repo-wide failures caused by
  *other* in-progress agents, which is normal mid-flight; the gate must be
  clean at the end.
- Read every SKILL.md body: check the version columns, whether a feature is
  really unavailable on v24, and that nothing is claimed beyond what an
  example shows.
- Treat reported discrepancies as leads, and spot-check the surprising
  ones. In the first build, an agent's report also caught an error in
  `SURVEY.md`.
- Look for exit-0 skips: `grep -rn "exit(0)" skills/*/examples`.
