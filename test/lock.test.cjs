/**
 * test/lock.test.cjs — Concurrent-write convergence test for bin/lib/lock.cjs
 *
 * Test: Two child processes call `state add-active` simultaneously.
 * Both rows MUST appear in STATE.md with no torn writes.
 *
 * This test creates a temporary STATE.md fixture, spawns two Node child
 * processes that each call `node bin/sf-tools.cjs state add-active`, and
 * verifies that both rows appear in the resulting STATE.md.
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
const { execSync, spawnSync } = require('child_process');

const CWD = path.join(__dirname, '..');
const STATE_PATH = path.join(CWD, '.specflow', 'STATE.md');
const LOCK_PATH = path.join(CWD, '.specflow', '.state.lock');
const BACKUP_PATH = path.join(CWD, '.specflow', 'STATE.md.lock-test-backup');

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Create a minimal STATE.md with the new Active Specifications table schema.
 */
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

/**
 * Backup STATE.md before test, restore after.
 */
function backupState() {
  try {
    fs.copyFileSync(STATE_PATH, BACKUP_PATH);
  } catch (_) {}
}

function restoreState() {
  try {
    fs.copyFileSync(BACKUP_PATH, STATE_PATH);
    fs.unlinkSync(BACKUP_PATH);
  } catch (_) {}
  // Also clean up lock file if left behind
  try { fs.unlinkSync(LOCK_PATH); } catch (_) {}
}

// ─── Reentrancy test ──────────────────────────────────────────────────────────

test('withStateLock: reentrant calls within same process do not deadlock', async () => {
  const { withStateLock } = require('../bin/lib/lock.cjs');

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
});

test('withStateLock: lock file is cleaned up after normal completion', async () => {
  const { withStateLock } = require('../bin/lib/lock.cjs');

  await withStateLock(async () => {
    // Lock file should exist while held
    assert.ok(fs.existsSync(LOCK_PATH), 'Lock file should exist while held');
  });

  // Lock file should be removed after release
  assert.ok(!fs.existsSync(LOCK_PATH), 'Lock file should be removed after release');
});

test('withStateLock: lock file is cleaned up after error in callback', async () => {
  const { withStateLock } = require('../bin/lib/lock.cjs');

  await assert.rejects(
    () => withStateLock(async () => { throw new Error('test error'); }),
    /test error/
  );

  assert.ok(!fs.existsSync(LOCK_PATH), 'Lock file should be removed after callback error');
});

// ─── Concurrent-write convergence test ───────────────────────────────────────

test('concurrent state add-active: both rows appear in STATE.md', (t, done) => {
  backupState();

  // Write a fresh minimal STATE.md
  fs.writeFileSync(STATE_PATH, makeMinimalStateMd(), 'utf8');

  // Script that calls state add-active via sf-tools
  const addActiveScript = (specId, status, next) => `
    const { execSync } = require('child_process');
    const cwd = ${JSON.stringify(CWD)};
    execSync(
      'node bin/sf-tools.cjs state add-active ${specId} ${status} "${next}"',
      { cwd, stdio: 'inherit' }
    );
  `;

  const script1 = path.join(os.tmpdir(), 'sf-add-active-1.cjs');
  const script2 = path.join(os.tmpdir(), 'sf-add-active-2.cjs');

  fs.writeFileSync(script1, addActiveScript('SPEC-AAA', 'running', '/sf:review'));
  fs.writeFileSync(script2, addActiveScript('SPEC-BBB', 'draft', '/sf:audit'));

  let done1 = false;
  let done2 = false;

  function checkBoth() {
    if (!done1 || !done2) return;

    try {
      const content = fs.readFileSync(STATE_PATH, 'utf8');

      // Both rows must appear
      assert.ok(content.includes('SPEC-AAA'), 'SPEC-AAA row must be in STATE.md');
      assert.ok(content.includes('SPEC-BBB'), 'SPEC-BBB row must be in STATE.md');

      // No torn write: table must be parseable
      const lines = content.split('\n');
      const tableLines = lines.filter(l => l.trim().startsWith('|'));
      assert.ok(tableLines.length >= 3, 'Table must have header + separator + at least 2 data rows');

      restoreState();
      done();
    } catch (err) {
      restoreState();
      done(err);
    }
  }

  // Spawn both processes nearly simultaneously
  const { spawn } = require('child_process');

  const p1 = spawn('node', [script1], { cwd: CWD, stdio: 'inherit' });
  const p2 = spawn('node', [script2], { cwd: CWD, stdio: 'inherit' });

  p1.on('close', (code) => {
    if (code !== 0) {
      restoreState();
      done(new Error(`Process 1 exited with code ${code}`));
      return;
    }
    done1 = true;
    checkBoth();
  });

  p2.on('close', (code) => {
    if (code !== 0) {
      restoreState();
      done(new Error(`Process 2 exited with code ${code}`));
      return;
    }
    done2 = true;
    checkBoth();
  });

  p1.on('error', (err) => { restoreState(); done(err); });
  p2.on('error', (err) => { restoreState(); done(err); });
});
