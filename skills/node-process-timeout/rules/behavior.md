# --process-timeout: verified behavior (main ab476eccd03 and v26.13.0)

## Syntax and startup errors (exit code 9)

| Input | Result |
| --- | --- |
| `500ms`, `30s`, `5m`, `1h` | accepted |
| `5`, `0s`, `1.5s`, `-1s`, `1d`, `10x` | `invalid value for --process-timeout: '<v>'. Expected a positive integer followed by a unit (ms, s, m or h), e.g. 30s` |
| `NODE_OPTIONS=--process-timeout=1s` | `--process-timeout= is not allowed in NODE_OPTIONS` |
| with `--inspect`, `--inspect-brk` (and `--inspect-wait`, `--inspect-port`, `--inspect-publish-uid` per the docs), `--run`, `--build-snapshot` | `either --process-timeout or --<x> can be used, not both` |
| `node --process-timeout=… inspect` | `--process-timeout cannot be used with \`node inspect\`` |
| `--report-on-process-timeout` alone | `--report-on-process-timeout must be used with --process-timeout` |

v24.x rejects the flag with `bad option: --process-timeout=…` (exit 9).
Feature-detect with `node --process-timeout=1h -e 0`.

At runtime, `inspector.open()` throws `ERR_INSPECTOR_NOT_AVAILABLE` and
`session.connectToMainThread()` throws. According to the docs, `SIGUSR1`
activation is ignored.

## When it fires

- The clock starts at **process start**, not when user code starts.
- The process exits `124` and ignores `process.exitCode`. `'exit'` and
  `'beforeExit'` don't run. Code coverage (`NODE_V8_COVERAGE=dir`) and
  `--cpu-prof` profiles are still written.
- stderr, idle case:
  ```text
  (node:PID) Process timed out after 500ms (--process-timeout). Exiting with code 124.
  Main thread was not executing JavaScript.
  Resources keeping the event loop alive:
      TCPServerWrap (listening on [::]:43631, fd 18)
      Timeout (next due in 714ms)
  ```
  Repeated handle types are grouped (`Timeout x2`). Seen in practice:
  `TCPServerWrap`, `Timeout`, `ProcessWrap (pid N)` and `PipeWrap (fd N)`.
- Busy JS: `Main thread was executing JavaScript:` followed by the stack
  (`at spinForever ([eval]:1:…)`), and then `No resources keeping the event
  loop alive were found.` when there are none.
- Blocked in native code (`execSync`, addons): after 2000 ms it prints `The
  main thread did not respond within 2000ms. It is likely blocked in a
  synchronous native operation, …` and exits 124. Total time is about
  timeout + 2 s.

## `--report-on-process-timeout`

The report is written in addition to the stderr summary, to
`--report-directory` (default: cwd) as `report.<date>.<time>.<pid>.0.001.json`.
In it, `header.trigger === 'ProcessTimeout'`,
`header.event === 'Process timed out (--process-timeout)'`, `libuv[]` lists the
handles (`type`, `is_active`, …), and `javascriptStack` holds the stack (or
`No stack.` when idle). Per the docs, a worker that doesn't answer within 2 s is
left out of the report.

## Child processes

Verified with a parent run as `--process-timeout=1s` that forks a child at
400 ms:

- The forked child has `process.execArgv` `['--process-timeout=1s']` and times
  out 1 s after **its own** start (at about 1.4 s), printing its own summary to
  the shared stderr.
- The parent exits at 1 s. The child is **not killed**: at about 1.2 s
  `process.kill(parentPid, 0)` already fails in the child.
- `spawn(process.execPath, [file])` receives `execArgv: []` and has no timeout.
  `fork(file, { execArgv: [] })` opts out the same way.
- The parent's summary lists live children as `ProcessWrap (pid N)`.

## `node --test`

- `node --process-timeout=2s --test dir/` applies the timeout to the runner
  process **and** passes `--process-timeout=2s` to every test-file process
  (`--test-isolation=process`, the default). Verified via `process.execArgv`
  inside a test.
- Every file starts after the runner, so the runner's timeout normally fires
  first. It exits 124 without the final test summary (the TAP/spec lines for
  finished tests are already printed) and lists the hung file only as
  `ProcessWrap (pid N)`. The orphaned file process exits shortly after through
  its own timeout, and its message is lost with the closed pipe.
- To identify the file: rerun the files one at a time
  (`node --process-timeout=… --test path/to/file.test.js`), or use
  `--test-isolation=none` so that the summary describes the leaked handles in
  one process.
- `--test-timeout` is per test. A test that passes but leaks an interval or a
  server still keeps its file process alive, and only `--process-timeout`
  ends that.

## `--watch`

Each restart of the app gets its own timeout. After the timeout fires, the
watcher prints `Failed running '<file>'. Waiting for file changes before
restarting...` and keeps running.

## `subprocess.timedOut` (YAML `added: v27.0.0-alpha.0.1.0`; main only, `undefined` in v26.13.0)

This is about the child_process `timeout` **option**, not the flag.

- `spawn(cmd, args, { timeout: 100 })`: `subprocess.timedOut === true` once the
  `killSignal` (default `SIGTERM`) has been sent. Like `killed`, it does not
  mean the child has exited yet. It is `false` for a child that exits in time.
- The `exec`/`execFile` callback error has `error.timedOut === true` and
  `error.killed === true`.
- On v26.13.0 or for portable code, use `err.killed && err.signal === killSignal`.
  The sync APIs (`execSync`, `spawnSync`) report `error.code === 'ETIMEDOUT'`
  and have no `timedOut`.
