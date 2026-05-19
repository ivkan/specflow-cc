/**
 * test/spec-validate.test.cjs — Tests for `node bin/sf-tools.cjs spec validate`
 *
 * Covers:
 * - Success: valid spec exits 0 with no stdout
 * - Failure: non-existent spec → "spec file not found"
 * - Failure: missing frontmatter → "invalid or missing frontmatter"
 * - Failure: missing required frontmatter field (id, type, status, priority)
 * - Failure: missing ## Requirements heading
 */

'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const ROOT = path.resolve(__dirname, '..');
const SPECFLOW_DIR = path.join(ROOT, '.specflow', 'specs');

/**
 * Create a temporary spec file for testing.
 * Returns the spec ID (filename without .md).
 */
function createTempSpec(content) {
  const id = 'SPEC-TEST-' + Date.now() + '-' + Math.floor(Math.random() * 10000);
  const filePath = path.join(SPECFLOW_DIR, id + '.md');
  fs.writeFileSync(filePath, content, 'utf8');
  return { id, filePath };
}

function spawnValidate(specId) {
  return spawnSync('node', [
    path.join(ROOT, 'bin/sf-tools.cjs'),
    'spec', 'validate', specId,
  ], { cwd: ROOT, encoding: 'utf8' });
}

// ─── Success case ─────────────────────────────────────────────────────────────

test('spec validate: valid spec exits 0 with no stdout', () => {
  const tempId = 'SPEC-TEST-VALID-' + Date.now();
  const { id, filePath } = createTempSpec(`---
id: ${tempId}
type: feature
status: draft
priority: p1
---

# Test Spec

## Context

Test context.

## Requirements

- R1: requirement one
`);
  try {
    const result = spawnValidate(id);
    assert.equal(result.status, 0, `Expected exit 0, got ${result.status}. stderr: ${result.stderr}`);
    assert.equal(result.stdout.trim(), '', `Expected no stdout, got: "${result.stdout}"`);
  } finally {
    fs.unlinkSync(filePath);
  }
});

// ─── Failure: spec not found ──────────────────────────────────────────────────

test('spec validate: non-existent spec exits 1 with "spec file not found"', () => {
  const result = spawnValidate('SPEC-NONEXISTENT-99999');
  assert.equal(result.status, 1, `Expected exit 1, got ${result.status}`);
  assert.match(result.stderr, /spec file not found/);
});

// ─── Failure: invalid/missing frontmatter ────────────────────────────────────

test('spec validate: no frontmatter delimiters exits 1 with "invalid or missing frontmatter"', () => {
  const { id, filePath } = createTempSpec(`# Just a heading

## Requirements

No frontmatter here.
`);
  try {
    const result = spawnValidate(id);
    assert.equal(result.status, 1, `Expected exit 1, got ${result.status}`);
    assert.match(result.stderr, /invalid or missing frontmatter/);
  } finally {
    fs.unlinkSync(filePath);
  }
});

// ─── Failure: missing required fields ────────────────────────────────────────

test('spec validate: missing "id" field exits 1 with "missing frontmatter field \'id\'"', () => {
  const specName = 'SPEC-TEST-MISSING-ID-' + Date.now();
  const { id, filePath } = createTempSpec(`---
type: feature
status: draft
priority: p1
---

# ${specName}

## Requirements

- R1
`);
  try {
    const result = spawnValidate(id);
    assert.equal(result.status, 1, `Expected exit 1, got ${result.status}`);
    assert.match(result.stderr, /missing frontmatter field 'id'/);
  } finally {
    fs.unlinkSync(filePath);
  }
});

test('spec validate: missing "type" field exits 1 with "missing frontmatter field \'type\'"', () => {
  const tempId2 = 'SPEC-TEST-NOTYPE-' + Date.now();
  const { id, filePath } = createTempSpec(`---
id: ${tempId2}
status: draft
priority: p1
---

# Test

## Requirements

- R1
`);
  try {
    const result = spawnValidate(id);
    assert.equal(result.status, 1, `Expected exit 1, got ${result.status}`);
    assert.match(result.stderr, /missing frontmatter field 'type'/);
  } finally {
    fs.unlinkSync(filePath);
  }
});

test('spec validate: missing "status" field exits 1 with "missing frontmatter field \'status\'"', () => {
  const tempId3 = 'SPEC-TEST-NOSTATUS-' + Date.now();
  const { id, filePath } = createTempSpec(`---
id: ${tempId3}
type: feature
priority: p1
---

# Test

## Requirements

- R1
`);
  try {
    const result = spawnValidate(id);
    assert.equal(result.status, 1, `Expected exit 1, got ${result.status}`);
    assert.match(result.stderr, /missing frontmatter field 'status'/);
  } finally {
    fs.unlinkSync(filePath);
  }
});

test('spec validate: missing "priority" field exits 1 with "missing frontmatter field \'priority\'"', () => {
  const tempId4 = 'SPEC-TEST-NOPRI-' + Date.now();
  const { id, filePath } = createTempSpec(`---
id: ${tempId4}
type: feature
status: draft
---

# Test

## Requirements

- R1
`);
  try {
    const result = spawnValidate(id);
    assert.equal(result.status, 1, `Expected exit 1, got ${result.status}`);
    assert.match(result.stderr, /missing frontmatter field 'priority'/);
  } finally {
    fs.unlinkSync(filePath);
  }
});

// ─── Failure: missing ## Requirements heading ────────────────────────────────

test('spec validate: missing ## Requirements heading exits 1', () => {
  const tempId5 = 'SPEC-TEST-NOREQ-' + Date.now();
  const { id, filePath } = createTempSpec(`---
id: ${tempId5}
type: feature
status: draft
priority: p1
---

# Test Spec

## Context

Some context. No Requirements section.
`);
  try {
    const result = spawnValidate(id);
    assert.equal(result.status, 1, `Expected exit 1, got ${result.status}`);
    assert.match(result.stderr, /missing required heading/);
  } finally {
    fs.unlinkSync(filePath);
  }
});

test('spec validate: "## requirements" (lowercase) exits 1 — heading is case-sensitive', () => {
  const tempId6 = 'SPEC-TEST-LOWERCASE-' + Date.now();
  const { id, filePath } = createTempSpec(`---
id: ${tempId6}
type: feature
status: draft
priority: p1
---

# Test Spec

## requirements

- R1
`);
  try {
    const result = spawnValidate(id);
    assert.equal(result.status, 1, `Expected exit 1, got ${result.status}`);
    assert.match(result.stderr, /missing required heading/);
  } finally {
    fs.unlinkSync(filePath);
  }
});

// ─── Missing spec ID argument ─────────────────────────────────────────────────

test('spec validate: missing spec ID exits 1', () => {
  const result = spawnSync('node', [
    path.join(ROOT, 'bin/sf-tools.cjs'),
    'spec', 'validate',
  ], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(result.status, 1, `Expected exit 1, got ${result.status}`);
  assert.match(result.stderr, /spec validation failed/);
});
