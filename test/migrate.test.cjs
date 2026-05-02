/**
 * test/migrate.test.cjs — Unit tests for bin/lib/migrate-state.cjs
 *
 * Covers:
 *   1. Format A (heading-style, real STATE.md) with active spec → migrated to table
 *   2. Format A with "—" (no active spec) → migrated with empty table
 *   3. Format B (bullet-style, templates/state.md) with spec → migrated to table
 *   4. Format B with "[none]" → migrated with empty table
 *   5. Already migrated (## Active Specifications present) → unchanged (idempotent)
 *   6. Second invocation on migrated content → zero-diff no-op
 *   7. Unknown format → returned unchanged (safe fallback)
 */

'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { migrateStateMd } = require('../bin/lib/migrate-state.cjs');

// ─── Fixtures ────────────────────────────────────────────────────────────────

// Format A — real STATE.md heading-style
const FORMAT_A_WITH_SPEC = `# SpecFlow State

## Active Specification

SPEC-011

**Status:** running
**Next Step:** (in progress)

## Queue

| Priority | ID | Title |
|----------|-----|-------|
| p1 | SPEC-011 | Test |

## Decisions

| Date | Decision |
|------|----------|
`;

// Format A — heading-style but no active spec (—)
const FORMAT_A_NO_SPEC = `# SpecFlow State

## Active Specification

—

**Status:** idle
**Next Step:** /sf:new

## Queue

| Priority | ID | Title |
|----------|-----|-------|
`;

// Format B — bullet-style (templates/state.md style) with spec
const FORMAT_B_WITH_SPEC = `# STATE.md Template

## Current Position

- **Active Specification:** SPEC-007
- **Status:** review
- **Next Step:** /sf:review

## Queue

| # | ID | Title |
|---|----|-------|
`;

// Format B — bullet-style with "[none]"
const FORMAT_B_NONE = `# STATE.md Template

## Current Position

- **Active Specification:** [none]
- **Status:** idle
- **Next Step:** /sf:new

## Queue

| # | ID | Title |
|---|----|-------|
`;

// Already migrated
const ALREADY_MIGRATED = `# SpecFlow State

## Active Specifications

| SPEC-ID | Status | Next Step |
|---------|--------|-----------|
| SPEC-011 | running | /sf:review |

## Queue

| Priority | ID | Title |
|----------|-----|-------|
`;

// Unknown format — no recognized legacy pattern
const UNKNOWN_FORMAT = `# SpecFlow State

## Some Section

Some content here.
`;

// ─── Tests ────────────────────────────────────────────────────────────────────

test('migrateStateMd: Format A with active spec → contains Active Specifications table', () => {
  const result = migrateStateMd(FORMAT_A_WITH_SPEC);

  assert.ok(result.includes('## Active Specifications'), 'Must contain new heading');
  assert.ok(result.includes('| SPEC-ID | Status | Next Step |'), 'Must contain table header');
  assert.ok(result.includes('| SPEC-011 |'), 'Must preserve SPEC-011 row');
  assert.ok(!result.includes('## Active Specification\n'), 'Must remove old singular heading');
});

test('migrateStateMd: Format A — preserves Queue section', () => {
  const result = migrateStateMd(FORMAT_A_WITH_SPEC);

  assert.ok(result.includes('## Queue'), 'Queue section must be preserved');
  assert.ok(result.includes('SPEC-011'), 'Queue entries must be preserved');
});

test('migrateStateMd: Format A with no active spec (—) → empty table body', () => {
  const result = migrateStateMd(FORMAT_A_NO_SPEC);

  assert.ok(result.includes('## Active Specifications'), 'Must contain new heading');
  assert.ok(result.includes('|---------|--------|-----------|'), 'Must contain separator row');
  // No spec data row (— is not a valid spec ID)
  assert.ok(!result.includes('| — |'), 'Must not include em-dash row in table body');
});

test('migrateStateMd: Format B with active spec → contains Active Specifications table', () => {
  const result = migrateStateMd(FORMAT_B_WITH_SPEC);

  assert.ok(result.includes('## Active Specifications'), 'Must contain new heading');
  assert.ok(result.includes('| SPEC-007 |'), 'Must preserve SPEC-007 row');
  assert.ok(result.includes('review'), 'Must preserve status');
  assert.ok(!result.includes('- **Active Specification:**'), 'Must remove legacy bullet');
});

test('migrateStateMd: Format B with "[none]" → empty table body', () => {
  const result = migrateStateMd(FORMAT_B_NONE);

  assert.ok(result.includes('## Active Specifications'), 'Must contain new heading');
  assert.ok(!result.includes('| none |'), 'Must not include "none" as spec row');
  assert.ok(!result.includes('- **Active Specification:**'), 'Must remove legacy bullet');
});

test('migrateStateMd: already migrated content → returned unchanged (idempotent)', () => {
  const result = migrateStateMd(ALREADY_MIGRATED);

  assert.equal(result, ALREADY_MIGRATED, 'Already-migrated content must be returned unchanged');
});

test('migrateStateMd: second invocation on migrated output → zero diff (no-op)', () => {
  const firstPass = migrateStateMd(FORMAT_A_WITH_SPEC);
  const secondPass = migrateStateMd(firstPass);

  assert.equal(secondPass, firstPass, 'Second migration must produce zero diff');
});

test('migrateStateMd: Format B second invocation → zero diff', () => {
  const firstPass = migrateStateMd(FORMAT_B_WITH_SPEC);
  const secondPass = migrateStateMd(firstPass);

  assert.equal(secondPass, firstPass, 'Second migration of Format B must produce zero diff');
});

test('migrateStateMd: unknown format → returned unchanged', () => {
  const result = migrateStateMd(UNKNOWN_FORMAT);

  assert.equal(result, UNKNOWN_FORMAT, 'Unknown format must be returned unchanged');
});

test('migrateStateMd: null/undefined → returns empty string or unchanged', () => {
  assert.equal(migrateStateMd(null), '');
  assert.equal(migrateStateMd(undefined), '');
  assert.equal(migrateStateMd(''), '');
});
