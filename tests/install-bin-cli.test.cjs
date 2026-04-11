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
console.log('Results: ' + passed + ' passed, ' + failed + ' failed');

if (failed > 0) {
  process.exit(1);
}
