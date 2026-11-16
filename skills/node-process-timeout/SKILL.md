---
name: node-process-timeout
description: "Node.js can now limit how long any process runs and explain why it was stuck: --process-timeout=duration. On expiry it exits with code 124 and prints the JS stack and the handles keeping the event loop alive. Use whenever a Node.js script, CLI tool, server, cron job, test run or CI step hangs or won't exit when it's done; to find out why a process is still running (open handles, leaked servers or sockets, timers); to bound a run without wrapper code or timeout(1); or to tell whether a child process was killed by its timeout option (subprocess.timedOut). Also covers --report-on-process-timeout. Node.js 26.11+ (not on v24); timedOut v27+."
---

# --process-timeout

| Feature | Versions | Stability | Flag |
| --- | --- | --- | --- |
| `--process-timeout=duration` (exit code `124`) | v26.11.0 (not on v24) | 1.1 Active development | itself |
| `--report-on-process-timeout` | v26.11.0 | 1.1 | needs `--process-timeout` |
| `subprocess.timedOut`, `error.timedOut` (exec/execFile callback) | v27.0.0-alpha.0.1.0 (YAML); absent in v26.13.0 | 2 | none |

> **Experimental API.** Before relying on these details, run the
> `node-experimental-check` skill's probe (or `node --version` plus a
> feature-detect one-liner) and check the docs for *the installed
> version*: `https://nodejs.org/docs/<version>/api/<module>.html`.
> If the installed version disagrees with this skill, the installed
> version wins.

## Make CI fail instead of hang

```sh
node --process-timeout=10m server-smoke.js     # units: ms s m h, positive integer
node --process-timeout=15m --test              # caps the whole run
node --process-timeout=5m --report-on-process-timeout --report-directory=reports app.js
```

When it fires, the process exits with **124** (like `timeout(1)`, overriding
`process.exitCode`). It prints the JS stack if the main thread was running JS,
otherwise the handles keeping the loop alive:

```text
(node:25418) Process timed out after 5s (--process-timeout). Exiting with code 124.
Main thread was not executing JavaScript.
Resources keeping the event loop alive:
    TCPServerWrap (listening on [::]:3000, fd 20)
    Timeout x2 (next due in 2931ms)
```

## Find what keeps the process alive

Run it with a short timeout and read the resource list (`TCPServerWrap`,
`Timeout`, `ProcessWrap (pid N)`, `PipeWrap`…). The report's `header.trigger`
is `'ProcessTimeout'`, and its `libuv` array lists every handle.

## Child processes and `node --test`

- `fork()` children (and any child given `process.execArgv`) inherit the flag
  and time out on **their own clock**, measured from their own start.
- `spawn(process.execPath, …)` without `execArgv` does not inherit it.
  `fork(file, { execArgv: [] })` opts a child out.
- Children are **not killed** when the parent times out. They outlive it and
  stop only through their own timeout.
- `node --test` passes the flag to each test-file process. The runner's clock
  starts first, so the runner usually fires first and lists the hung file only
  as `ProcessWrap (pid N)`. The orphaned file process then exits on its own
  timeout.

## Pitfalls

- It is **not allowed in `NODE_OPTIONS`** (exit 9). Put it on the command line
  or in the npm script.
- It can't be combined with `--inspect*`, `node inspect`, `--run` or
  `--build-snapshot`. `inspector.open()` throws `ERR_INSPECTOR_NOT_AVAILABLE`.
- `'exit'`/`'beforeExit'` handlers don't run. Coverage
  (`NODE_V8_COVERAGE`) and `--cpu-prof` output are still written.
- A main thread blocked in native code (`execSync`) gets 2 s to respond, then
  the process exits 124 with a "did not respond" note and no stack.
- `subprocess.timedOut` belongs to the `timeout` **option** of
  spawn/exec/execFile/fork, not to this flag. For sync APIs, check
  `err.code === 'ETIMEDOUT'`.

## Don't

- Don't wrap the command in `timeout 600 node …` or write
  `setTimeout(() => process.exit(1), …).unref()` watchdogs. On 26.11+ the flag
  gives the same exit code plus a diagnosis.
- Don't install `why-is-node-running` or `wtfnode` just to list open handles.
  `--process-timeout` prints them.
- Don't use `--test-timeout` for "the run never ends". It is per test, and
  tests that pass but leak a handle still hang.

## Reference

- [rules/behavior.md](rules/behavior.md) — read for the exact output formats, error messages, exit codes, the report, and verified child-process/test-runner timing.
