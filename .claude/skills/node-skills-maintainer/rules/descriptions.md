# Descriptions that trigger

The frontmatter `description` is the only part of a skill the model sees
before it decides whether to load it. Claude Code caps a description at
1,536 characters. Under listing-budget pressure, it drops whole descriptions
for the least-used skills, leaving only the name. So the name and the first
clause must carry the meaning.

## Shape

```text
<What changed / what it does, in the user's words: "Node.js now has a built-in X">.
Use whenever <the tasks and phrasings a user actually types>; <stale alternatives
it replaces: "instead of adm-zip, jszip">. Covers <API identifiers, compact>.
Node.js <floor>+ (<line caveats>).
```

- **Task first.** A model trained before an API can't match a task to a name
  it has never seen. Listing API identifiers first put the effective
  triggers last.
- **"Node.js now has a built-in X"** is the most effective opener for
  "the model is confident it knows" tasks, such as zip or SQLite. It tells
  the model its knowledge is stale.
- **Don't narrow a general feature to one context.** `--process-timeout`
  was described as "make CI fail instead of hang", which suggested a
  CI-only tool. List the range of contexts instead: script, CLI, server,
  cron job, test run, CI step.
- **Narrow experimental APIs on purpose.** If a broad trigger would get a
  flagged, experimental API adopted in ordinary code, gate it with "use only
  when the user asks for X or accepts an experimental API"
  (`node-stream-iter`).
- **Name the npm packages and old APIs it replaces.** Users and models
  reach for them first.
- **Give the version floor, with line caveats** ("26.8+ (not on v24)").

## YAML

Always use a double-quoted string, e.g. `description: "..."`. Plain scalars
break on `: ` (for example "Histogram: significance tests") and on a leading
quote. Write it with `json.dumps(text, ensure_ascii=False)` and check it with
a real parser (`python3 -c "import yaml,sys; yaml.safe_load(...)"`).
`claude plugin validate skills` also parses every frontmatter.
`skill-lint.mjs` checks only that the keys are present.

Frontmatter budget: ≤ 200 tokens is about 700 characters of description.

## Measuring

```sh
node tools/trigger-eval.mjs --model sonnet --runs 2
node tools/trigger-eval.mjs --model haiku          # the weakest at triggering
```

`evals/trigger-prompts.json` has at least one realistic prompt per skill, plus
negative controls (`"NONE"`). Prompts must use the user's words, never the
new API names. Add a prompt for every new skill and for every reported
non-trigger.

How to read the results:

- **Run-to-run variance is large.** In the first build, the same inputs
  scored 19 and then 22 out of 24. Compare several runs, not one.
- **A negative control that fires** means some description is too broad.
  Fix that before anything else.
- **A consistent miss on a prompt where the model is confident** ("my CLI
  doesn't exit", "run TypeScript directly") is usually not fixable by
  rewording. Two rounds of edits changed nothing. Don't keep tuning to the
  eval set (overfitting). Report it instead, and suggest a project-level
  instruction such as a CLAUDE.md or AGENTS.md line saying "check the node-*
  skills for Node.js work".
- After editing descriptions, re-run `skill-budget --check`. Descriptions sit
  close to the 200-token ceiling.
