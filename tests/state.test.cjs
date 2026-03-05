/**
 * tests/state.test.cjs — Tests for bin/lib/state.cjs
 *
 * Run: node tests/state.test.cjs
 */

'use strict';

const assert = require('assert').strict;
const { cmdStateGet, cmdStateSetActive, cmdQueueNext, extractActiveSpec } = require('../bin/lib/state.cjs');
const fs = require('fs');
const path = require('path');
const os = require('os');

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

/**
 * Helper: create a temp .specflow directory with STATE.md
 */
function createFixture(stateContent) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sf-state-test-'));
  const sfDir = path.join(tmpDir, '.specflow');
  fs.mkdirSync(sfDir, { recursive: true });
  fs.writeFileSync(path.join(sfDir, 'STATE.md'), stateContent, 'utf8');
  return tmpDir;
}

function cleanup(tmpDir) {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

const SAMPLE_STATE = `# SpecFlow State

## Active Specification

SPEC-007

**Status:** running
**Next Step:** /sf:implement

## Queue

| Priority | ID | Title | Status | Complexity | Depends On |
|----------|-----|-------|--------|------------|------------|
| p1 | SPEC-006 | Feature A | draft | large | -- |
| p1 | SPEC-007 | Feature B | running | medium | -- |
| p2 | SPEC-008 | Feature C | done | small | SPEC-007 |

## Notes

Some notes here.
`;

console.log('state.test.cjs');
console.log('');

// --- extractActiveSpec tests ---

console.log('extractActiveSpec:');

test('extracts active spec ID', () => {
  assert.equal(extractActiveSpec(SAMPLE_STATE), 'SPEC-007');
});

test('returns null when no active spec section', () => {
  assert.equal(extractActiveSpec('# No active section here'), null);
});

// --- cmdStateGet (integration) ---

console.log('');
console.log('cmdStateGet (integration):');

test('state get returns correct fields via public API', () => {
  const tmpDir = createFixture(SAMPLE_STATE);
  try {
    const origWrite = process.stdout.write;
    let captured = '';
    process.stdout.write = (s) => { captured += s; };
    cmdStateGet(tmpDir, false);
    process.stdout.write = origWrite;

    const result = JSON.parse(captured);
    assert.equal(result.active_spec, 'SPEC-007');
    assert.equal(result.status, 'running');
    assert.equal(result.next_step, '/sf:implement');
  } finally {
    cleanup(tmpDir);
  }
});

test('state get returns null fields for empty STATE.md', () => {
  const tmpDir = createFixture('# SpecFlow State\n\n## Active Specification\n\n');
  try {
    const origWrite = process.stdout.write;
    let captured = '';
    process.stdout.write = (s) => { captured += s; };
    cmdStateGet(tmpDir, false);
    process.stdout.write = origWrite;

    const result = JSON.parse(captured);
    assert.equal(result.active_spec, null);
    assert.equal(result.status, null);
  } finally {
    cleanup(tmpDir);
  }
});

// --- cmdStateSetActive (integration via file) ---

console.log('');
console.log('cmdStateSetActive (integration):');

test('set-active updates status and preserves next step when not provided', () => {
  const tmpDir = createFixture(SAMPLE_STATE);
  try {
    // Simulate what cmdStateSetActive does
    const { cmdStateSetActive } = require('../bin/lib/state.cjs');
    // Capture stdout
    const origWrite = process.stdout.write;
    let captured = '';
    process.stdout.write = (s) => { captured += s; };
    cmdStateSetActive(tmpDir, 'SPEC-009', 'drafting', undefined, false);
    process.stdout.write = origWrite;

    const updated = fs.readFileSync(path.join(tmpDir, '.specflow', 'STATE.md'), 'utf8');
    assert.ok(updated.includes('SPEC-009'), 'Should contain new spec ID');
    assert.ok(updated.includes('**Status:** drafting'), 'Should contain new status');
    assert.ok(updated.includes('**Next Step:** /sf:implement'), 'Should preserve existing next step');
    assert.ok(updated.includes('## Notes'), 'Should preserve other content');
  } finally {
    cleanup(tmpDir);
  }
});

test('set-active updates next step when provided', () => {
  const tmpDir = createFixture(SAMPLE_STATE);
  try {
    const { cmdStateSetActive } = require('../bin/lib/state.cjs');
    const origWrite = process.stdout.write;
    let captured = '';
    process.stdout.write = (s) => { captured += s; };
    cmdStateSetActive(tmpDir, 'SPEC-009', 'drafting', '/sf:review', false);
    process.stdout.write = origWrite;

    const updated = fs.readFileSync(path.join(tmpDir, '.specflow', 'STATE.md'), 'utf8');
    assert.ok(updated.includes('SPEC-009'), 'Should contain new spec ID');
    assert.ok(updated.includes('**Status:** drafting'), 'Should contain new status');
    assert.ok(updated.includes('**Next Step:** /sf:review'), 'Should contain new next step');
  } finally {
    cleanup(tmpDir);
  }
});

// --- cmdQueueNext (integration) ---

console.log('');
console.log('cmdQueueNext (integration):');

test('queue next returns first actionable (not done/complete)', () => {
  const tmpDir = createFixture(SAMPLE_STATE);
  try {
    const origWrite = process.stdout.write;
    let captured = '';
    process.stdout.write = (s) => { captured += s; };
    cmdQueueNext(tmpDir, false);
    process.stdout.write = origWrite;

    const result = JSON.parse(captured);
    assert.equal(result.id, 'SPEC-006');
  } finally {
    cleanup(tmpDir);
  }
});

test('queue next returns null when all done', () => {
  const allDone = `# SpecFlow State

## Active Specification

SPEC-001

**Status:** done
**Next Step:** /sf:done

## Queue

| Priority | ID | Title | Status | Complexity | Depends On |
|----------|-----|-------|--------|------------|------------|
| p1 | SPEC-001 | A | done | small | -- |
| p1 | SPEC-002 | B | complete | small | -- |
`;
  const tmpDir = createFixture(allDone);
  try {
    const origWrite = process.stdout.write;
    let captured = '';
    process.stdout.write = (s) => { captured += s; };
    cmdQueueNext(tmpDir, false);
    process.stdout.write = origWrite;

    const result = JSON.parse(captured);
    assert.equal(result.id, null);
  } finally {
    cleanup(tmpDir);
  }
});

// --- Summary ---

console.log('');
console.log('Results: ' + passed + ' passed, ' + failed + ' failed');

if (failed > 0) {
  process.exit(1);
}
