/**
 * test/integration.test.cjs — Integration tests for SPEC-011
 *
 * Tests:
 *   1. state add-active / state list-active / state remove-active round-trip
 *   2. state resolve against legacy STATE.md (auto-migrates, returns use/ask/error)
 *   3. state migrate idempotency on real STATE.md fixture
 *   4. Single-spec compatibility: state get shim still works
 *   5. AskUserQuestion picker data shape: state resolve with N>1 active specs
 *   6. state resolve with explicit SPEC-ID match and miss
 *
 * Each test runs in its own os.tmpdir()-based directory so the project's
 * real .specflow/STATE.md is never touched and tests can run in parallel
 * across files (Node 22's default test runner).
 */

'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const PROJECT_ROOT = path.join(__dirname, '..');
const SF_TOOLS = path.join(PROJECT_ROOT, 'bin', 'sf-tools.cjs');

// ─── Helpers ─────────────────────────────────────────────────────────────────

function setupTmpDir() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sf-integration-'));
  fs.mkdirSync(path.join(tmpDir, '.specflow'), { recursive: true });
  return tmpDir;
}

function teardownTmpDir(tmpDir) {
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
}

function sfTools(cwd, ...args) {
  const result = execSync(
    `node ${JSON.stringify(SF_TOOLS)} ${args.join(' ')}`,
    { cwd, encoding: 'utf8', timeout: 10000 }
  );
  return JSON.parse(result.trim());
}

function makeMinimalMigratedState(extraRows = []) {
  let rows = extraRows.map(r => `| ${r.id} | ${r.status} | ${r.next} |`).join('\n');
  if (rows) rows = '\n' + rows;
  return `# SpecFlow State

## Active Specifications

| SPEC-ID | Status | Next Step |
|---------|--------|-----------|${rows}

## Queue

| Priority | ID | Title | Status | Complexity | Depends On |
|----------|-----|-------|--------|------------|------------|

## Decisions

| Date | Decision |
|------|----------|

---
*Last updated: integration-test*
`;
}

function makeLegacyFormatAState(specId, status, nextStep) {
  return `# SpecFlow State

## Active Specification

${specId}

**Status:** ${status}
**Next Step:** ${nextStep}

## Queue

| Priority | ID | Title | Status | Complexity | Depends On |
|----------|-----|-------|--------|------------|------------|

## Decisions

| Date | Decision |
|------|----------|
`;
}

function writeState(tmpDir, content) {
  fs.writeFileSync(path.join(tmpDir, '.specflow', 'STATE.md'), content, 'utf8');
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test('integration: state add-active → list-active → remove-active round-trip', async () => {
  const tmpDir = setupTmpDir();
  try {
    writeState(tmpDir, makeMinimalMigratedState());

    const add1 = sfTools(tmpDir, 'state', 'add-active', 'SPEC-INT-1', 'running', '/sf:review');
    assert.equal(add1.updated, true);
    assert.equal(add1.id, 'SPEC-INT-1');

    const add2 = sfTools(tmpDir, 'state', 'add-active', 'SPEC-INT-2', 'draft', '/sf:audit');
    assert.equal(add2.updated, true);

    const list = sfTools(tmpDir, 'state', 'list-active');
    assert.ok(Array.isArray(list.active_specs));
    const ids = list.active_specs.map(r => r.id);
    assert.ok(ids.includes('SPEC-INT-1'), 'SPEC-INT-1 must be in list');
    assert.ok(ids.includes('SPEC-INT-2'), 'SPEC-INT-2 must be in list');

    const remove = sfTools(tmpDir, 'state', 'remove-active', 'SPEC-INT-1');
    assert.equal(remove.removed, true);
    assert.equal(remove.was_present, true);

    const list2 = sfTools(tmpDir, 'state', 'list-active');
    const ids2 = list2.active_specs.map(r => r.id);
    assert.ok(!ids2.includes('SPEC-INT-1'), 'SPEC-INT-1 should be gone');
    assert.ok(ids2.includes('SPEC-INT-2'), 'SPEC-INT-2 should still be there');
  } finally {
    teardownTmpDir(tmpDir);
  }
});

test('integration: state resolve with N=1 implicit (no specId arg)', async () => {
  const tmpDir = setupTmpDir();
  try {
    writeState(tmpDir, makeMinimalMigratedState([
      { id: 'SPEC-INT-3', status: 'running', next: '/sf:review' }
    ]));

    const result = sfTools(tmpDir, 'state', 'resolve');
    assert.equal(result.action, 'use');
    assert.equal(result.id, 'SPEC-INT-3');
  } finally {
    teardownTmpDir(tmpDir);
  }
});

test('integration: state resolve with N=0 returns NO_ACTIVE_SPEC', async () => {
  const tmpDir = setupTmpDir();
  try {
    writeState(tmpDir, makeMinimalMigratedState());

    const result = sfTools(tmpDir, 'state', 'resolve');
    assert.equal(result.action, 'error');
    assert.equal(result.code, 'NO_ACTIVE_SPEC');
  } finally {
    teardownTmpDir(tmpDir);
  }
});

test('integration: state resolve with N>1 returns ask with options', async () => {
  const tmpDir = setupTmpDir();
  try {
    writeState(tmpDir, makeMinimalMigratedState([
      { id: 'SPEC-INT-4', status: 'running', next: '/sf:review' },
      { id: 'SPEC-INT-5', status: 'draft', next: '/sf:audit' }
    ]));

    const result = sfTools(tmpDir, 'state', 'resolve');
    assert.equal(result.action, 'ask');
    assert.ok(Array.isArray(result.options));
    assert.equal(result.options.length, 2);
    for (const opt of result.options) {
      assert.ok('id' in opt, 'option must have id');
      assert.ok('title' in opt, 'option must have title');
      assert.ok('status' in opt, 'option must have status');
    }
    const optIds = result.options.map(o => o.id);
    assert.ok(optIds.includes('SPEC-INT-4'));
    assert.ok(optIds.includes('SPEC-INT-5'));
  } finally {
    teardownTmpDir(tmpDir);
  }
});

test('integration: state resolve with explicit SPEC-ID match', async () => {
  const tmpDir = setupTmpDir();
  try {
    writeState(tmpDir, makeMinimalMigratedState([
      { id: 'SPEC-INT-6', status: 'running', next: '/sf:review' },
      { id: 'SPEC-INT-7', status: 'draft', next: '/sf:audit' }
    ]));

    const result = sfTools(tmpDir, 'state', 'resolve', 'SPEC-INT-7');
    assert.equal(result.action, 'use');
    assert.equal(result.id, 'SPEC-INT-7');
  } finally {
    teardownTmpDir(tmpDir);
  }
});

test('integration: state resolve with explicit SPEC-ID miss', async () => {
  const tmpDir = setupTmpDir();
  try {
    writeState(tmpDir, makeMinimalMigratedState([
      { id: 'SPEC-INT-8', status: 'running', next: '/sf:review' }
    ]));

    const result = sfTools(tmpDir, 'state', 'resolve', 'SPEC-MISSING');
    assert.equal(result.action, 'error');
    assert.equal(result.code, 'SPEC_NOT_ACTIVE');
    assert.equal(result.id, 'SPEC-MISSING');
  } finally {
    teardownTmpDir(tmpDir);
  }
});

test('integration: state migrate on legacy Format A STATE.md', async () => {
  const tmpDir = setupTmpDir();
  try {
    writeState(tmpDir, makeLegacyFormatAState('SPEC-INT-9', 'running', '/sf:review'));

    const result1 = sfTools(tmpDir, 'state', 'migrate');
    assert.equal(result1.migrated, true, 'First migration should change content');

    const statePath = path.join(tmpDir, '.specflow', 'STATE.md');
    const migrated = fs.readFileSync(statePath, 'utf8');
    assert.ok(migrated.includes('## Active Specifications'), 'Must have new schema');
    assert.ok(migrated.includes('SPEC-INT-9'), 'Must preserve spec ID');

    const result2 = sfTools(tmpDir, 'state', 'migrate');
    assert.equal(result2.migrated, false, 'Second migration must be no-op');

    const migrated2 = fs.readFileSync(statePath, 'utf8');
    assert.equal(migrated2, migrated, 'Content must be identical after second migration');
  } finally {
    teardownTmpDir(tmpDir);
  }
});

test('integration: state get shim returns active spec (single-spec backwards compat)', async () => {
  const tmpDir = setupTmpDir();
  try {
    writeState(tmpDir, makeMinimalMigratedState([
      { id: 'SPEC-INT-10', status: 'running', next: '/sf:review' }
    ]));

    const result = sfTools(tmpDir, 'state', 'get');
    assert.equal(result.active_spec, 'SPEC-INT-10');
    assert.equal(result.status, 'running');
    assert.equal(result.next_step, '/sf:review');
  } finally {
    teardownTmpDir(tmpDir);
  }
});

test('integration: state get shim with N>1 returns last-touched (most recently appended)', async () => {
  const tmpDir = setupTmpDir();
  try {
    writeState(tmpDir, makeMinimalMigratedState([
      { id: 'SPEC-INT-11', status: 'running', next: '/sf:review' },
      { id: 'SPEC-INT-12', status: 'draft', next: '/sf:audit' }
    ]));

    const result = sfTools(tmpDir, 'state', 'get');
    // "last touched" = last row = SPEC-INT-12
    assert.equal(result.active_spec, 'SPEC-INT-12');
  } finally {
    teardownTmpDir(tmpDir);
  }
});

test('integration: add-active updates existing row (upsert behavior)', async () => {
  const tmpDir = setupTmpDir();
  try {
    writeState(tmpDir, makeMinimalMigratedState([
      { id: 'SPEC-INT-13', status: 'running', next: '/sf:review' }
    ]));

    sfTools(tmpDir, 'state', 'add-active', 'SPEC-INT-13', 'done', '/sf:done');

    const list = sfTools(tmpDir, 'state', 'list-active');
    const row = list.active_specs.find(r => r.id === 'SPEC-INT-13');
    assert.ok(row, 'Row must still exist');
    assert.equal(row.status, 'done');
    assert.equal(row.nextStep, '/sf:done');
    const count = list.active_specs.filter(r => r.id === 'SPEC-INT-13').length;
    assert.equal(count, 1, 'Must not create duplicate rows on update');
  } finally {
    teardownTmpDir(tmpDir);
  }
});
