#!/usr/bin/env node
// Installs (or removes) node-skills for Claude Code or opencode.
//
//   node install/install.mjs --target claude    [--scope user|project] [--dir DIR] [--mode link|copy] [--only a,b] [--uninstall] [--dry-run]
//   node install/install.mjs --target opencode  ...
//
// Destinations:
//   claude   user:    ~/.claude/skills/<name>
//            project: <dir>/.claude/skills/<name>
//   opencode user:    ~/.config/opencode/skills/<name>   (or $OPENCODE_CONFIG_DIR/skills)
//            project: <dir>/.opencode/skills/<name>
//
// opencode also reads ~/.claude/skills and .claude/skills, so a Claude install
// is visible to opencode as well; install for opencode only if you do not use
// Claude Code or want the skills scoped to opencode.
//
// For Claude Code the plugin route is usually better (versioned, updatable):
//   /plugin marketplace add <path-or-git-url-of-this-repo>
//   /plugin install node-skills@node-skills
//
// --mode link (default) symlinks each skill directory to this checkout, so a
// `git pull` updates the installed skills. --mode copy makes standalone copies
// (use it on Windows without symlink permission, or to pin a snapshot).
// Uninstall only removes entries this script created: symlinks that point into
// this checkout, or copies carrying the .node-skills-install marker.

import { cp, lstat, mkdir, readdir, readlink, rm, symlink, writeFile, access } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const REPO = fileURLToPath(new URL('..', import.meta.url));
const SKILLS = join(REPO, 'skills');
const MARKER = '.node-skills-install';

const { values } = parseArgs({
  options: {
    target: { type: 'string' },
    scope: { type: 'string', default: 'user' },
    dir: { type: 'string', default: process.cwd() },
    mode: { type: 'string', default: 'link' },
    only: { type: 'string' },
    uninstall: { type: 'boolean', default: false },
    'dry-run': { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
});

function usage(code) {
  console.log('usage: node install/install.mjs --target claude|opencode [--scope user|project] [--dir DIR] [--mode link|copy] [--only a,b] [--uninstall] [--dry-run]');
  process.exit(code);
}

if (values.help) usage(0);
if (!['claude', 'opencode'].includes(values.target)) usage(1);
if (!['user', 'project'].includes(values.scope)) usage(1);
if (!['link', 'copy'].includes(values.mode)) usage(1);

function destination() {
  const project = resolve(values.dir);
  if (values.target === 'claude') {
    return values.scope === 'user' ? join(homedir(), '.claude', 'skills') : join(project, '.claude', 'skills');
  }
  if (values.scope === 'project') return join(project, '.opencode', 'skills');
  const config = process.env.OPENCODE_CONFIG_DIR ?? join(process.env.XDG_CONFIG_HOME ?? join(homedir(), '.config'), 'opencode');
  return join(config, 'skills');
}

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function ownedByUs(path) {
  let st;
  try {
    st = await lstat(path);
  } catch {
    return null; // absent
  }
  if (st.isSymbolicLink()) {
    const target = resolve(join(path, '..'), await readlink(path));
    return target.startsWith(SKILLS) ? 'link' : false;
  }
  if (st.isDirectory() && (await exists(join(path, MARKER)))) return 'copy';
  return false;
}

const dest = destination();
const all = (await readdir(SKILLS, { withFileTypes: true }))
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();
const wanted = values.only ? values.only.split(',').map((s) => s.trim()) : all;
for (const name of wanted) {
  if (!all.includes(name)) {
    console.error(`unknown skill: ${name}`);
    process.exit(1);
  }
}

const dry = values['dry-run'];
console.log(`${values.uninstall ? 'Removing' : 'Installing'} ${wanted.length} skill(s) ${values.uninstall ? 'from' : 'into'} ${dest}${dry ? ' (dry run)' : ''}`);
if (!dry && !values.uninstall) await mkdir(dest, { recursive: true });

let conflicts = 0;
for (const name of wanted) {
  const path = join(dest, name);
  const owner = await ownedByUs(path);

  if (values.uninstall) {
    if (owner) {
      if (!dry) await rm(path, { recursive: owner === 'copy', force: true });
      console.log(`  removed  ${name}`);
    } else if (owner === false) {
      console.log(`  kept     ${name} (not installed by node-skills)`);
    }
    continue;
  }

  if (owner === false) {
    conflicts++;
    console.log(`  CONFLICT ${name}: ${path} exists and was not installed by node-skills; left untouched`);
    continue;
  }
  if (owner && !dry) await rm(path, { recursive: owner === 'copy', force: true });
  if (!dry) {
    if (values.mode === 'link') {
      await symlink(join(SKILLS, name), path, process.platform === 'win32' ? 'junction' : 'dir');
    } else {
      await cp(join(SKILLS, name), path, { recursive: true });
      await writeFile(join(path, MARKER), `${REPO}\n`);
    }
  }
  console.log(`  ${owner ? 'updated ' : 'added   '} ${name} (${values.mode})`);
}

if (!values.uninstall) {
  console.log('\nRestart the agent (or start a new session) to pick up the skills.');
  if (values.target === 'opencode' && values.scope === 'user' && (await exists(join(homedir(), '.claude', 'skills', wanted[0])))) {
    console.log('Note: opencode also reads ~/.claude/skills, where these skills are already installed. The opencode copy takes precedence.');
  }
}
if (conflicts) process.exitCode = 1;
