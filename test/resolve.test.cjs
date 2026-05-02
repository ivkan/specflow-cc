/**
 * test/resolve.test.cjs — Unit tests for bin/lib/resolve.cjs
 *
 * Covers all 5 resolution scenarios:
 *   1. N=0: empty table → NO_ACTIVE_SPEC error
 *   2. N=1 implicit: one row, no specId arg → use that row's ID
 *   3. N=1 explicit-match: one row, specId matches → use specId
 *   4. N=1 explicit-miss: one row, specId does NOT match → SPEC_NOT_ACTIVE error
 *   5. N=2 implicit: two rows, no specId arg → ask with both options
 *   6. N=2 explicit: two rows, specId matches one → use specId
 */

'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { resolveActiveSpec, parseActiveSpecsTable } = require('../bin/lib/resolve.cjs');

// ─── Fixtures ────────────────────────────────────────────────────────────────

const STATE_EMPTY = `# SpecFlow State

## Active Specifications

| SPEC-ID | Status | Next Step |
|---------|--------|-----------|

## Queue
`;

const STATE_ONE = `# SpecFlow State

## Active Specifications

| SPEC-ID | Status | Next Step |
|---------|--------|-----------|
| SPEC-006 | running | /sf:review |

## Queue
`;

const STATE_TWO = `# SpecFlow State

## Active Specifications

| SPEC-ID | Status | Next Step |
|---------|--------|-----------|
| SPEC-T01 | running | /sf:review |
| SPEC-T02 | draft | /sf:audit |

## Queue
`;

const STATE_NO_SECTION = `# SpecFlow State

## Active Specification

SPEC-006

**Status:** running
**Next Step:** /sf:review

## Queue
`;

// ─── parseActiveSpecsTable tests ─────────────────────────────────────────────

test('parseActiveSpecsTable: empty table body returns []', () => {
  const rows = parseActiveSpecsTable(STATE_EMPTY);
  assert.deepEqual(rows, []);
});

test('parseActiveSpecsTable: one data row returns one entry', () => {
  const rows = parseActiveSpecsTable(STATE_ONE);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, 'SPEC-006');
  assert.equal(rows[0].status, 'running');
  assert.equal(rows[0].nextStep, '/sf:review');
});

test('parseActiveSpecsTable: two data rows returns two entries', () => {
  const rows = parseActiveSpecsTable(STATE_TWO);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].id, 'SPEC-T01');
  assert.equal(rows[1].id, 'SPEC-T02');
});

test('parseActiveSpecsTable: legacy section (no Active Specifications table) returns []', () => {
  const rows = parseActiveSpecsTable(STATE_NO_SECTION);
  assert.deepEqual(rows, []);
});

test('parseActiveSpecsTable: null/undefined content returns []', () => {
  assert.deepEqual(parseActiveSpecsTable(null), []);
  assert.deepEqual(parseActiveSpecsTable(undefined), []);
  assert.deepEqual(parseActiveSpecsTable(''), []);
});

// ─── resolveActiveSpec tests ──────────────────────────────────────────────────

// Scenario 1: N=0 — no active specs
test('resolve N=0: returns NO_ACTIVE_SPEC error', () => {
  const result = resolveActiveSpec(undefined, STATE_EMPTY);
  assert.deepEqual(result, { action: 'error', code: 'NO_ACTIVE_SPEC' });
});

// Scenario 2: N=1 implicit — one row, no specId
test('resolve N=1 implicit: returns use with single row ID', () => {
  const result = resolveActiveSpec(undefined, STATE_ONE);
  assert.deepEqual(result, { action: 'use', id: 'SPEC-006' });
});

// Scenario 3: N=1 explicit-match — specId matches the one row
test('resolve N=1 explicit-match: returns use with provided ID', () => {
  const result = resolveActiveSpec('SPEC-006', STATE_ONE);
  assert.deepEqual(result, { action: 'use', id: 'SPEC-006' });
});

// Scenario 4: N=1 explicit-miss — specId does NOT match the row
test('resolve N=1 explicit-miss: returns SPEC_NOT_ACTIVE error', () => {
  const result = resolveActiveSpec('SPEC-999', STATE_ONE);
  assert.deepEqual(result, { action: 'error', code: 'SPEC_NOT_ACTIVE', id: 'SPEC-999' });
});

// Scenario 5: N=2 implicit — two rows, no specId
// Uses SPEC-T01 and SPEC-T02 which do not exist on disk → title fallback = id
test('resolve N=2 implicit: returns ask with options array', () => {
  const result = resolveActiveSpec(undefined, STATE_TWO);
  assert.equal(result.action, 'ask');
  assert.ok(Array.isArray(result.options));
  assert.equal(result.options.length, 2);
  // IDs must be present
  const ids = result.options.map(o => o.id);
  assert.ok(ids.includes('SPEC-T01'));
  assert.ok(ids.includes('SPEC-T02'));
  // Each option has id, title, status fields
  for (const opt of result.options) {
    assert.ok('id' in opt);
    assert.ok('title' in opt);
    assert.ok('status' in opt);
    // Title fallback: spec files don't exist, so title === id
    assert.equal(opt.title, opt.id);
  }
});

// Scenario 6: N=2 explicit — specId matches one of the rows
test('resolve N=2 explicit: returns use with matched ID', () => {
  const result = resolveActiveSpec('SPEC-T02', STATE_TWO);
  assert.deepEqual(result, { action: 'use', id: 'SPEC-T02' });
});

// Edge case: specId not in multi-row table
test('resolve N=2 explicit-miss: returns SPEC_NOT_ACTIVE error', () => {
  const result = resolveActiveSpec('SPEC-999', STATE_TWO);
  assert.deepEqual(result, { action: 'error', code: 'SPEC_NOT_ACTIVE', id: 'SPEC-999' });
});

// Edge case: null/undefined content with specId
test('resolve null content with specId: returns SPEC_NOT_ACTIVE', () => {
  const result = resolveActiveSpec('SPEC-006', null);
  assert.deepEqual(result, { action: 'error', code: 'SPEC_NOT_ACTIVE', id: 'SPEC-006' });
});

test('resolve null content without specId: returns NO_ACTIVE_SPEC', () => {
  const result = resolveActiveSpec(undefined, null);
  assert.deepEqual(result, { action: 'error', code: 'NO_ACTIVE_SPEC' });
});
