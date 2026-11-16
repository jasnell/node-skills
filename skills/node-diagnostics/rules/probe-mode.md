# Debugger probe mode (`node inspect --probe`)

Source: `doc/api/debugger.md` ("Probe mode") at nodejs/node `ab476eccd03`. Stability 1.
Verified by `examples/probe-mode.mjs` (v24.19+) and `examples/probe-cond.mjs` (v24.20+).

| Capability | Versions |
| --- | --- |
| `--probe`/`--expr`, `--json`, `--preview`, `--timeout`, `--port` | v26.1.0, v24.16.0 |
| JSON schema v2 (`target` object, `location` per hit) | v26.2.0, v24.19.0 |
| `probe_failure` terminal error, `error.details` | v26.3.0, v24.19.0 |
| `--max-hit <n>` | v26.4.0, v24.19.0 |
| `--cond <expr>` | v26.6.0, v24.20.0 |

```sh
node inspect [--json] [--preview] [--timeout=<ms>] [--port=<port>] \
  --probe <file>:<line>[:<col>] --expr <expr> [--cond <expr>] [--max-hit <n>] \
  [--probe ... --expr ...] [--] [<node-option> ...] <script> [args...]
```

Rules:

* `--probe` must be followed immediately by exactly one `--expr`. `--cond` and
  `--max-hit` come *after* that pair, at most once each.
* `<file>` is a path-separator-anchored suffix of the script URL (`utils.js` matches every
  `utils.js`, so use `src/utils.js` to narrow it). Line and column are 1-based. Without a column, the probe binds
  to the first executable column.
* The expression is evaluated **before** the line runs, in its lexical scope. Don't probe a
  `let`/`const` on its own declaration line (ReferenceError).
* Probes sharing a location share one pause, and their expressions run in command-line order.
  They must share one `--cond` (or none). Conflicting conditions exit 9 with
  `Probes at app.js:3 must use the same --cond (or none)` on stderr.
* A `--cond` that throws counts as false.
* `--max-hit` applies per pair. When **any** probe reaches its limit, the session detaches and
  reports. The target keeps running.
* Child Node.js flags go after `--`. The child's stdout and stderr are silenced. Default
  timeout is 30000 ms.
* On v24.19 (no `--cond`), passing `--cond` fails with "Use -- before child Node.js
  flags in probe mode" plus the usage text.

## Text output

```text
Hit 1 at file:///path/app.js:3:3
  i = 4
Completed
```

## JSON v2 (`--json`)

```json
{"v":2,
 "probes":[{"expr":"i","target":{"suffix":"app.js","line":3},"condition":"i>1","maxHit":2}],
 "results":[
  {"probe":0,"event":"hit","hit":1,"location":{"url":"file:///…/app.js","line":3,"column":3},
   "result":{"type":"number","value":2,"description":"2"}},
  {"event":"completed"}]}
```

* `target.column` is present only if you gave `:col`. `condition` and `maxHit` are present only when set.
* A failing expression produces a hit with `error: { message, details? }` instead of `result`,
  and the session continues. The contents of `message` and `details` are informational and unstable.
* The last entry is always a terminal event:
  * `{"event":"completed"}`: normal end, or `--max-hit` reached
  * `{"event":"miss","pending":[i,...]}`: the script ended with probes never hit (exit 0)
  * `{"event":"timeout","pending":[...],"error":{"code":"probe_timeout",...}}`: exit 1 (observed)
  * `{"event":"error","pending":[...],"error":{"code":"probe_target_exit","exitCode":3,"stderr":"",...}}`:
    the target exited before every probe was hit. The prober still exits 0 (observed)
  * `{"event":"error","error":{"code":"probe_failure","probe":i,...}}`: non-zero exit (per
    docs; not reproduced here)
* Use `--preview` to include CDP property previews for object values. Or use
  `--expr 'JSON.stringify(obj)'`.
* Invalid arguments print usage to stderr with no report (exit 9 observed).
