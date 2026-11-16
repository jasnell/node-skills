# Lifecycle events and what to change

| Event (seen in drift or survey output) | Change |
| --- | --- |
| **Stability promoted** (for example 1.1 → 1.2 → 2) | Update the availability table and `meta.json` `stability`. Once no 1.x content remains, remove the **Experimental API.** banner; the linter requires the banner exactly while `stability` mentions 1.x. Soften the "verify first" wording. |
| **Unflagged** (the `--experimental-x` flag is no longer needed) | Update the Flag column. Add "(flag needed before vX)". Drop the flag from example headers for versions that don't need it, splitting the example if older lines still need the flag. Note the new `--no-experimental-x` opt-out. |
| **Renamed** (an API or flag) | The table gets both names and versions. Give the portable pattern (for example `sqlite.Database ?? sqlite.DatabaseSync`). Add a migration row. |
| **Deprecated or EOL** | Add a row in `node-modern-migration` (removed → replacement → since). Add to the owning skill's "Don't". Add an example asserting the removal on main. |
| **Default changed** | Add to `node-modern-migration` changed-defaults, and note it in the owning skill's pitfalls with both values and versions. |
| **Behavior changed with no `changes:` entry** (found by an example failing on one line) | Document the behavior per line. Record a discrepancy (a candidate upstream doc fix). Write a behavior-detecting example that asserts both branches. |
| **Backport lands** (for example v24.23 gets a v26 feature) | Add the version to the `added` lists in the table and in example headers. Re-run on the new v24 binary. Remove "(not on v24)". |
| **New release line** (v28, v30, ...) | Add it to the binary matrix and to the CI matrix in `.github/workflows/ci.yml`. Normalize `-alpha` version labels to the release version once it ships. |
| **Floor line EOL** (v24 EOL is April 2028) | Raise the floor in `AGENTS.md`, `README.md`, and every `meta.json` `floor`. Delete v24-only caveats, compatibility examples, and branches. Re-run the survey from the new floor. |
| **A whole module becomes Stable and well known** | Consider retiring or shrinking the skill. Once models are trained on it, keep only the traps. |

Always finish with the gate and re-pin `nodejsCommit` (see `workflow.md`).
