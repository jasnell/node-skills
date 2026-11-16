// @node-skills {"added":["v26.1.0","v24.16.0"]}
// util.convertProcessSignalToExitCode (v25.4.0, v24.14.0) and util.styleText hex colors.
import { convertProcessSignalToExitCode, styleText } from 'node:util';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';

assert.equal(convertProcessSignalToExitCode('SIGTERM'), 143); // 128 + 15
assert.equal(convertProcessSignalToExitCode('SIGINT'), 130);
assert.throws(() => convertProcessSignalToExitCode('SIGFOO'), { code: 'ERR_INVALID_ARG_VALUE' });
assert.throws(() => convertProcessSignalToExitCode(15), { code: 'ERR_INVALID_ARG_VALUE' });  // names only

// Typical use: mirror a child's fate in your own exit code.
const child = spawnSync(process.execPath, ['-e', 'process.kill(process.pid, "SIGTERM")']);
if (process.platform !== 'win32') {
  assert.equal(child.signal, 'SIGTERM');
  assert.equal(child.status ?? convertProcessSignalToExitCode(child.signal), 143);
}

// Hex colors (#RGB / #RRGGBB) emit 24-bit escapes and combine with modifiers.
assert.equal(styleText('#f00', 'x', { validateStream: false }), '\u001b[38;2;255;0;0mx\u001b[39m');
assert.equal(styleText(['#00f', 'bold'], 'x', { validateStream: false }), '\u001b[38;2;0;0;255m\u001b[1mx\u001b[22m\u001b[39m');
assert.throws(() => styleText('#ffff', 'x'), { code: 'ERR_INVALID_ARG_VALUE' });
// Default validateStream: true checks process.stdout + NO_COLOR/FORCE_COLOR, so a pipe gets plain text.
const env = { ...process.env };
delete env.FORCE_COLOR;
const piped = spawnSync(process.execPath, ['-p', 'require("node:util").styleText("#f00", "x")'], { encoding: 'utf8', env });
assert.equal(piped.stdout.trim(), 'x');
const forced = spawnSync(process.execPath, ['-p', 'require("node:util").styleText("#f00", "x")'], { encoding: 'utf8', env: { ...env, FORCE_COLOR: '3' } });
assert.equal(forced.stdout.trim(), '\u001b[38;2;255;0;0mx\u001b[39m');
