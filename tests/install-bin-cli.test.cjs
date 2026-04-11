/**
 * tests/install-bin-cli.test.cjs — Smoke test for bin/ installation
 *
 * Regression guard for the installer bug where bin/ was never copied into
 * ~/.claude/specflow-cc/, breaking every command that invoked sf-tools.cjs
 * in user projects.
 *
 * Run: node tests/install-bin-cli.test.cjs
 */

'use strict';

const assert = require('assert').strict;
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const INSTALLER = path.join(REPO_ROOT, 'bin', 'install.js');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log('  PASS: ' + name);
  } catch (e) {
    failed++;
    console.log('  FAIL: ' + name);
    console.log('    ' + e.message);
  }
}

function makeTempProject() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'sf-install-test-'));
}

function cleanup(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

function runInstaller(cwd) {
  const result = spawnSync('node', [INSTALLER, '--local'], {
    cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    throw new Error(
      'installer exited with ' + result.status +
      '\nstdout: ' + result.stdout +
      '\nstderr: ' + result.stderr
    );
  }
  return result;
}

console.log('install-bin-cli.test.cjs');
console.log('');

console.log('installer bin/ copy:');

test('copies bin/sf-tools.cjs into runtime directory', () => {
  const tmp = makeTempProject();
  try {
    runInstaller(tmp);
    const target = path.join(tmp, '.claude', 'specflow-cc', 'bin', 'sf-tools.cjs');
    assert.ok(fs.existsSync(target), 'sf-tools.cjs missing at ' + target);
  } finally {
    cleanup(tmp);
  }
});

test('copies bin/lib/ recursively (todo.cjs present)', () => {
  const tmp = makeTempProject();
  try {
    runInstaller(tmp);
    const target = path.join(tmp, '.claude', 'specflow-cc', 'bin', 'lib', 'todo.cjs');
    assert.ok(fs.existsSync(target), 'bin/lib/todo.cjs missing at ' + target);
  } finally {
    cleanup(tmp);
  }
});

test('does NOT copy bin/install.js into runtime directory', () => {
  const tmp = makeTempProject();
  try {
    runInstaller(tmp);
    const target = path.join(tmp, '.claude', 'specflow-cc', 'bin', 'install.js');
    assert.ok(!fs.existsSync(target), 'install.js should be excluded but exists at ' + target);
  } finally {
    cleanup(tmp);
  }
});

console.log('');
console.log('installed sf-tools.cjs end-to-end:');

test('sf-tools.cjs todo list returns fixture TODO from user project', () => {
  const tmp = makeTempProject();
  try {
    runInstaller(tmp);

    // Create a minimal per-file TODO fixture
    const todosDir = path.join(tmp, '.specflow', 'todos');
    fs.mkdirSync(todosDir, { recursive: true });
    fs.writeFileSync(
      path.join(todosDir, 'TODO-001.md'),
      [
        '---',
        'id: TODO-001',
        'title: Smoke test fixture',
        'priority: high',
        'status: open',
        'complexity: small',
        'created: 2026-04-11',
        '---',
        '',
        'Fixture body.',
        '',
      ].join('\n')
    );

    // Invoke the INSTALLED copy of sf-tools.cjs, not the source copy
    const installedCli = path.join(tmp, '.claude', 'specflow-cc', 'bin', 'sf-tools.cjs');
    const result = spawnSync('node', [installedCli, 'todo', 'list'], {
      cwd: tmp,
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf8',
    });

    assert.equal(result.status, 0,
      'sf-tools.cjs exited with ' + result.status +
      '\nstdout: ' + result.stdout +
      '\nstderr: ' + result.stderr
    );

    const parsed = JSON.parse(result.stdout);
    assert.ok(Array.isArray(parsed), 'output was not a JSON array');
    assert.equal(parsed.length, 1, 'expected exactly 1 todo, got ' + parsed.length);
    assert.equal(parsed[0].id, 'TODO-001');
    assert.equal(parsed[0].title, 'Smoke test fixture');
    assert.equal(parsed[0].priority, 'high');
  } finally {
    cleanup(tmp);
  }
});

console.log('');
console.log('settings.json hook configuration:');

function readSettings(tmp) {
  const p = path.join(tmp, '.claude', 'settings.json');
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

test('PostToolUse entries are matcher groups (no flat {type, command})', () => {
  const tmp = makeTempProject();
  try {
    runInstaller(tmp);
    const settings = readSettings(tmp);
    const entries = settings.hooks.PostToolUse;
    assert.ok(Array.isArray(entries), 'PostToolUse must be an array');
    assert.ok(entries.length > 0, 'PostToolUse must not be empty after install');
    for (const entry of entries) {
      assert.ok(
        Array.isArray(entry.hooks),
        'every PostToolUse entry must be a matcher group with hooks[] array, got: ' +
          JSON.stringify(entry)
      );
      assert.ok(entry.type === undefined,
        'entry must NOT be a flat {type, command}: ' + JSON.stringify(entry));
    }
  } finally {
    cleanup(tmp);
  }
});

test('context-monitor hook present in matcher group', () => {
  const tmp = makeTempProject();
  try {
    runInstaller(tmp);
    const settings = readSettings(tmp);
    const found = settings.hooks.PostToolUse.some(entry =>
      Array.isArray(entry.hooks) &&
      entry.hooks.some(h => h.command && h.command.includes('context-monitor'))
    );
    assert.ok(found, 'context-monitor hook missing from PostToolUse');
  } finally {
    cleanup(tmp);
  }
});

test('running installer twice does not duplicate context-monitor hook', () => {
  const tmp = makeTempProject();
  try {
    runInstaller(tmp);
    runInstaller(tmp);
    const settings = readSettings(tmp);
    let count = 0;
    for (const entry of settings.hooks.PostToolUse) {
      if (!Array.isArray(entry.hooks)) continue;
      for (const h of entry.hooks) {
        if (h.command && h.command.includes('context-monitor')) count++;
      }
    }
    assert.equal(count, 1,
      'expected exactly 1 context-monitor hook after repeat install, got ' + count);
  } finally {
    cleanup(tmp);
  }
});

test('auto-heals flat broken context-monitor entry from prior install', () => {
  const tmp = makeTempProject();
  try {
    // Simulate settings.json left by installer 1.18.0/1.18.1: a flat
    // { type, command } entry at the top level of PostToolUse, which is
    // invalid per Claude Code's schema.
    const claudeDir = path.join(tmp, '.claude');
    fs.mkdirSync(claudeDir, { recursive: true });
    const broken = {
      hooks: {
        PostToolUse: [
          {
            type: 'command',
            command: 'node "$HOME/.claude/hooks/context-monitor.js"'
          }
        ]
      }
    };
    fs.writeFileSync(
      path.join(claudeDir, 'settings.json'),
      JSON.stringify(broken, null, 2) + '\n'
    );

    runInstaller(tmp);

    const settings = readSettings(tmp);
    // No flat entries should remain.
    for (const entry of settings.hooks.PostToolUse) {
      assert.ok(Array.isArray(entry.hooks),
        'flat entry was not healed: ' + JSON.stringify(entry));
    }
    // Exactly one context-monitor hook — the correctly-formatted one the
    // installer pushed after removing the broken flat entry.
    let count = 0;
    for (const entry of settings.hooks.PostToolUse) {
      for (const h of entry.hooks) {
        if (h.command && h.command.includes('context-monitor')) count++;
      }
    }
    assert.equal(count, 1,
      'expected exactly 1 context-monitor hook after auto-heal, got ' + count);
  } finally {
    cleanup(tmp);
  }
});

test('auto-heal preserves flat entries that are NOT context-monitor', () => {
  const tmp = makeTempProject();
  try {
    // A flat entry that doesn't reference context-monitor should be left
    // alone by auto-heal — it may belong to some other tool. (It will still
    // be invalid per Claude Code's schema, but that's not our problem to
    // fix; we only clean up after our own prior bug.)
    const claudeDir = path.join(tmp, '.claude');
    fs.mkdirSync(claudeDir, { recursive: true });
    const preExisting = {
      hooks: {
        PostToolUse: [
          {
            type: 'command',
            command: 'node /some/other/tool.js'
          }
        ]
      }
    };
    fs.writeFileSync(
      path.join(claudeDir, 'settings.json'),
      JSON.stringify(preExisting, null, 2) + '\n'
    );

    runInstaller(tmp);

    const settings = readSettings(tmp);
    const foreignStillThere = settings.hooks.PostToolUse.some(e =>
      e && e.command === 'node /some/other/tool.js'
    );
    assert.ok(foreignStillThere,
      'auto-heal must not touch foreign flat entries');
  } finally {
    cleanup(tmp);
  }
});

test('auto-heal handles mix of correct + flat broken context-monitor', () => {
  const tmp = makeTempProject();
  try {
    // Simulate the real user case: a correctly-formatted hook was already
    // present, AND installer 1.18.0/1.18.1 added a flat broken duplicate.
    const claudeDir = path.join(tmp, '.claude');
    fs.mkdirSync(claudeDir, { recursive: true });
    const mixed = {
      hooks: {
        PostToolUse: [
          {
            hooks: [
              {
                type: 'command',
                command: 'node "$HOME/.claude/hooks/context-monitor.js"'
              }
            ]
          },
          {
            type: 'command',
            command: 'node "$HOME/.claude/hooks/context-monitor.js"'
          }
        ]
      }
    };
    fs.writeFileSync(
      path.join(claudeDir, 'settings.json'),
      JSON.stringify(mixed, null, 2) + '\n'
    );

    runInstaller(tmp);

    const settings = readSettings(tmp);
    // Flat entry gone
    for (const entry of settings.hooks.PostToolUse) {
      assert.ok(Array.isArray(entry.hooks),
        'flat entry survived auto-heal: ' + JSON.stringify(entry));
    }
    // Exactly one context-monitor hook — the pre-existing correct one.
    // Installer must not push a new duplicate after healing.
    let count = 0;
    for (const entry of settings.hooks.PostToolUse) {
      for (const h of entry.hooks) {
        if (h.command && h.command.includes('context-monitor')) count++;
      }
    }
    assert.equal(count, 1,
      'expected exactly 1 context-monitor hook after heal+install, got ' + count);
  } finally {
    cleanup(tmp);
  }
});

test('installer does not corrupt pre-existing correctly-formatted hook', () => {
  const tmp = makeTempProject();
  try {
    // Simulate a user who already has a correctly-formatted context-monitor hook
    // from a prior install or manual configuration.
    const claudeDir = path.join(tmp, '.claude');
    fs.mkdirSync(claudeDir, { recursive: true });
    const preExisting = {
      hooks: {
        PostToolUse: [
          {
            hooks: [
              {
                type: 'command',
                command: 'node "$HOME/.claude/hooks/context-monitor.js"'
              }
            ]
          }
        ]
      }
    };
    fs.writeFileSync(
      path.join(claudeDir, 'settings.json'),
      JSON.stringify(preExisting, null, 2) + '\n'
    );

    runInstaller(tmp);

    const settings = readSettings(tmp);
    // Every entry must still be a matcher group
    for (const entry of settings.hooks.PostToolUse) {
      assert.ok(Array.isArray(entry.hooks),
        'pre-existing entry was mangled: ' + JSON.stringify(entry));
    }
    // Exactly one context-monitor hook — installer should have detected the
    // existing one and NOT pushed a duplicate.
    let count = 0;
    for (const entry of settings.hooks.PostToolUse) {
      for (const h of entry.hooks) {
        if (h.command && h.command.includes('context-monitor')) count++;
      }
    }
    assert.equal(count, 1,
      'expected exactly 1 context-monitor hook when one already existed, got ' + count);
  } finally {
    cleanup(tmp);
  }
});

console.log('');
console.log('Results: ' + passed + ' passed, ' + failed + ' failed');

if (failed > 0) {
  process.exit(1);
}
