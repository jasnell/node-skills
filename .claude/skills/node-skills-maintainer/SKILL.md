---
name: node-skills-maintainer
description: "Maintains the node-skills repo as Node.js evolves: surveys nodejs/node for new or changed APIs, finds stale or missing coverage, updates existing skills or creates new ones, verifies every claim on real binaries, tunes descriptions so skills trigger, and re-pins provenance. Use when asked to update the Node.js skills for a new release or for nodejs/node main, add a skill for a new Node.js feature, check the skills for drift or staleness, fix a skill that gives wrong or outdated guidance, or improve skill triggering."
---

# Maintaining node-skills

The authoring contract is `AGENTS.md`, at the repo root. This skill is the
*process* for applying it over time. Read [rules/lessons.md](rules/lessons.md)
before starting: it lists the mistakes that cost the most time in the first
build.

## Non-negotiables

1. **Run every claim.** Docs and behavior disagreed 99 times in the first
   build. Use the YAML for orientation only; the example run is the
   evidence. Record each mismatch in `meta.json` `discrepancies`.
2. **Test the oldest and newest release of every supported line, plus a
   fresh `main` build.** The same API behaves differently across lines,
   often with no `changes:` entry.
3. **Write the delta.** Cover only what a model trained on older Node.js
   cannot guess. Stay within budget: frontmatter ≤ 200 tokens, body ≤ 1000.
   Detail goes in `rules/`.
4. **Never push, and commit only when the user asks.** Follow the user's
   commit conventions.

## Workflow

| Step | Do | Detail |
| --- | --- | --- |
| 0. Binaries | Update and rebuild the nodejs/node checkout. Install the latest release of each supported line. Confirm that `out/Release/node` really has the newest APIs | [rules/verification.md](rules/verification.md) |
| 1. Survey | `node tools/check-drift.mjs --node-dir ../node` (stale skills). Then `node tools/survey.mjs --node-dir ../node --since <last surveyed release> --changes --uncovered` (new, uncovered features) | [rules/workflow.md](rules/workflow.md) |
| 2. Triage | Decide which features earn coverage and where they go: update a skill, create a skill, or add to `node-modern-migration` | [rules/workflow.md](rules/workflow.md) |
| 3. Author | Write it yourself for 1–2 skills. For more, use parallel agents grouped by topic overlap, with the standard brief | [rules/delegation-brief.md](rules/delegation-brief.md) |
| 4. Verify | Run examples on every binary. Self-skip with exit 77. Repeat timing examples under parallel load | [rules/verification.md](rules/verification.md) |
| 5. Descriptions | Task first, then triggers, then API names. Use a double-quoted YAML string. Run `tools/trigger-eval.mjs` | [rules/descriptions.md](rules/descriptions.md) |
| 6. Lifecycle | Handle stability promotions, unflagging, removals and new release lines | [rules/lifecycle.md](rules/lifecycle.md) |
| 7. Finalize | Run the gate below. Regenerate `DISCREPANCIES.md`. Update the README table and `SURVEY.md`. Re-pin `nodejsCommit` | [rules/workflow.md](rules/workflow.md) |

## Gate (all must pass before you report done)

```sh
node tools/skill-lint.mjs && node tools/skill-budget.mjs --check && node --test tools/
for n in $OLDEST_24 $LATEST_24 $LATEST_CURRENT ../node/out/Release/node; do NODE=$n node tools/run-examples.mjs; done
claude plugin validate .            # plugin and marketplace manifests
node tools/discrepancies.mjs        # then review the new entries
```

Report to the user, in this order:
- per-binary pass/fail/skip counts;
- new discrepancies, which may be upstream doc bugs or real Node.js bugs;
- anything left unverified, and why;
- trigger-eval results, if descriptions changed.

