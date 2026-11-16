# Workflow: survey, triage, finalize

## 1. Survey

Run these from the repo root, with `../node` being a nodejs/node checkout on
`main` that is up to date (`git -C ../node pull --ff-only`).

```sh
# Which skills are stale: doc YAML or stability changed in their sources since the pinned commit
node tools/check-drift.mjs --node-dir ../node

# What's new since the last survey baseline, and what no skill mentions yet.
# The baseline is the newest release the previous survey covered (see the
# dated sections in SURVEY.md). For a full re-survey, use v24.0.0.
node tools/survey.mjs --node-dir ../node --since v26.13.0 --changes --uncovered
node tools/survey.mjs --node-dir ../node --since v26.13.0 --module zlib   # one module, covered and not

# Features whose docs lag the code (an undocumented export, a new flag):
git -C ../node log --oneline <oldest pinned commit>..HEAD -- lib src doc/api \
  | grep -iE '^[0-9a-f]+ [a-z_,/ ]+: (add|implement|introduce|support|expose)'
```

`survey.mjs` coverage is a token match, so treat it as triage, not proof. A
"covered" row can still be out of date: drift catches that case.

Record results by **appending a dated section** to `SURVEY.md` (baseline,
counts, notable additions). Don't rewrite history.

## 2. Triage: does it earn coverage?

Include a feature when all of these hold:

- **A model can't guess it.** It's new, renamed, has a changed default, or
  was removed. Don't cover a feature that is older than the training
  cutoff and unchanged.
- **It matters to general coding.** Users hit it in tasks, or it replaces an
  npm dependency, or code that uses the old way breaks.
- **It's available on a supported line** (≥ the floor in `AGENTS.md`).
  Features only on `main` are fine if the skill says so.

Usually skip:

- Node-API/C++ internals (they belong in the separate `nodejs-core`
  skill).
- Inspector protocol minutiae.
- Error codes on their own: cover them under their feature.
- Type-only doc entries (`type: ApplicationOptions`) unless the feature
  itself is covered.

## Where it goes

| The change is… | Put it in |
| --- | --- |
| A removal, EOL, runtime deprecation, or changed default | `node-modern-migration` (one row), plus the owning skill's "Don't" |
| A new API in a module or task that a skill already owns | That skill: `rules/` first, the body only if it's behavior-critical |
| A new built-in module, or a distinct task no skill owns | A new skill. Use one skill per task a user would ask for, and keep the boundary at the smallest unit that a single task needs in full |
| A small standalone utility | `node-utilities` (keep its body a lookup table) |
| An addition that would push a body over 1000 tokens | Move existing body detail to `rules/`, or split the skill |

Skill ownership is listed in the README table. When two skills touch one
feature, the reference material lives in exactly one of them and the other
points to it **by name** (relative paths break when skills install
separately).

## 7. Finalize

1. Run the gate in `SKILL.md`. Fix anything that fails. Don't weaken a
   check.
2. Run `node tools/discrepancies.mjs`. Read the new entries: separate
   upstream doc bugs from real Node.js bugs, and tell the user about the
   bugs.
3. Update the README skills table (and floors), `SURVEY.md` (the dated
   section), and `PLAN.md` if a design decision changed.
4. Re-pin provenance:
   - **Skills you updated:** set `nodejsCommit` to the commit you verified
     against (`git -C ../node rev-parse --short=11 HEAD`), and add any new
     doc files to `sources`.
   - **Untouched skills with no drift:** `node tools/check-drift.mjs --node-dir ../node --bump`.
     This re-pins only skills that report `current`.
   - **Never bump a drifting skill without reviewing the diff.**
5. If the user asks for a commit, use one logical change per commit (for
   example "node-zip: cover ZipFile.rename"). Never push.
