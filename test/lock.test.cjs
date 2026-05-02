/**
 * test/lock.test.cjs — Concurrent-write convergence test for bin/lib/lock.cjs
 *
 * Test: Two child processes call `state add-active` simultaneously.
 * Both rows MUST appear in STATE.md with no torn writes.
 *
 * Each test runs in its own os.tmpdir()-based directory so the project's
 * real .specflow/STATE.md is never touched and tests can run in parallel
 * across files (Node 22's default test runner).
 *
 * Also tests reentrancy: calling withStateLock from within an already-locked
 * callback in the same process must not deadlock.
 */

'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const os = require('os');

const PROJECT_ROOT = path.join(__dirname, '..');
const SF_TOOLS = path.join(PROJECT_ROOT, 'bin', 'sf-tools.cjs');

// ─── Helpers ─────────────────────────────────────────────────────────────────

function setupTmpDir() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sf-lock-'));
  fs.mkdirSync(path.join(tmpDir, '.specflow'), { recursive: true });
  return tmpDir;
}

function teardownTmpDir(tmpDir) {
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
}

/**
 * Clear the lock module from require cache so module-scope _depth/_lockFd
 * reset between tests. Each test calls this and then re-requires the module.
 */
function freshLockModule() {
  delete require.cache[require.resolve('../bin/lib/lock.cjs')];
  return require('../bin/lib/lock.cjs');
}

function makeMinimalStateMd() {
  return `# SpecFlow State

## Active Specifications

| SPEC-ID | Status | Next Step |
|---------|--------|-----------|

## Queue

| Priority | ID | Title | Status | Complexity | Depends On |
|----------|-----|-------|--------|------------|------------|

## Decisions

| Date | Decision |
|------|----------|

---
*Last updated: test*
`;
}

// ─── Reentrancy test ──────────────────────────────────────────────────────────

test('withStateLock: reentrant calls within same process do not deadlock', async () => {
  const tmpDir = setupTmpDir();
  const origCwd = process.cwd();
  process.chdir(tmpDir);
  try {
    const { withStateLock } = freshLockModule();

    let innerRan = false;
    const result = await withStateLock(async () => {
      // Reentrant call — must not deadlock
      await withStateLock(async () => {
        innerRan = true;
      });
      return 'outer';
    });

    assert.equal(result, 'outer');
    assert.ok(innerRan, 'Inner reentrant withStateLock call must have run');
  } finally {
    process.chdir(origCwd);
    teardownTmpDir(tmpDir);
  }
});

test('withStateLock: lock file is cleaned up after normal completion', async () => {
  const tmpDir = setupTmpDir();
  const origCwd = process.cwd();
  process.chdir(tmpDir);
  try {
    const { withStateLock } = freshLockModule();
    const lockPath = path.join(tmpDir, '.specflow', '.state.lock');

    await withStateLock(async () => {
      assert.ok(fs.existsSync(lockPath), 'Lock file should exist while held');
    });

    assert.ok(!fs.existsSync(lockPath), 'Lock file should be removed after release');
  } finally {
    process.chdir(origCwd);
    teardownTmpDir(tmpDir);
  }
});

test('withStateLock: lock file is cleaned up after error in callback', async () => {
  const tmpDir = setupTmpDir();
  const origCwd = process.cwd();
  process.chdir(tmpDir);
  try {
    const { withStateLock } = freshLockModule();
    const lockPath = path.join(tmpDir, '.specflow', '.state.lock');

    await assert.rejects(
      () => withStateLock(async () => { throw new Error('test error'); }),
      /test error/
    );

    assert.ok(!fs.existsSync(lockPath), 'Lock file should be removed after callback error');
  } finally {
    process.chdir(origCwd);
    teardownTmpDir(tmpDir);
  }
});

// ─── Concurrent-write convergence test ───────────────────────────────────────

test('concurrent state add-active: both rows appear in STATE.md', (t, done) => {
  const tmpDir = setupTmpDir();
  const statePath = path.join(tmpDir, '.specflow', 'STATE.md');

  fs.writeFileSync(statePath, makeMinimalStateMd(), 'utf8');

  const addActiveScript = (specId, status, next) => `
    const { execSync } = require('child_process');
    const cwd = ${JSON.stringify(tmpDir)};
    execSync(
      'node ${JSON.stringify(SF_TOOLS).slice(1, -1)} state add-active ${specId} ${status} "${next}"',
      { cwd, stdio: 'inherit' }
    );
  `;

  const script1 = path.join(tmpDir, 'sf-add-active-1.cjs');
  const script2 = path.join(tmpDir, 'sf-add-active-2.cjs');

  fs.writeFileSync(script1, addActiveScript('SPEC-AAA', 'running', '/sf:review'));
  fs.writeFileSync(script2, addActiveScript('SPEC-BBB', 'draft', '/sf:audit'));

  let done1 = false;
  let done2 = false;

  function checkBoth() {
    if (!done1 || !done2) return;

    try {
      const content = fs.readFileSync(statePath, 'utf8');

      assert.ok(content.includes('SPEC-AAA'), 'SPEC-AAA row must be in STATE.md');
      assert.ok(content.includes('SPEC-BBB'), 'SPEC-BBB row must be in STATE.md');

      const lines = content.split('\n');
      const tableLines = lines.filter(l => l.trim().startsWith('|'));
      assert.ok(tableLines.length >= 3, 'Table must have header + separator + at least 2 data rows');

      teardownTmpDir(tmpDir);
      done();
    } catch (err) {
      teardownTmpDir(tmpDir);
      done(err);
    }
  }

  const { spawn } = require('child_process');

  const p1 = spawn('node', [script1], { cwd: tmpDir, stdio: 'inherit' });
  const p2 = spawn('node', [script2], { cwd: tmpDir, stdio: 'inherit' });

  p1.on('close', (code) => {
    if (code !== 0) {
      teardownTmpDir(tmpDir);
      done(new Error(`Process 1 exited with code ${code}`));
      return;
    }
    done1 = true;
    checkBoth();
  });

  p2.on('close', (code) => {
    if (code !== 0) {
      teardownTmpDir(tmpDir);
      done(new Error(`Process 2 exited with code ${code}`));
      return;
    }
    done2 = true;
    checkBoth();
  });

  p1.on('error', (err) => { teardownTmpDir(tmpDir); done(err); });
  p2.on('error', (err) => { teardownTmpDir(tmpDir); done(err); });
});
