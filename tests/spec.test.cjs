/**
 * tests/spec.test.cjs — Tests for bin/lib/spec.cjs
 *
 * Run: node tests/spec.test.cjs
 */

'use strict';

const assert = require('assert').strict;
const { cmdSpecLoad, cmdSpecList, cmdSpecNextId } = require('../bin/lib/spec.cjs');
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
 * Helper: create a temp .specflow structure with spec files
 */
function createFixture(specs, archiveSpecs) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sf-spec-test-'));
  const specsDir = path.join(tmpDir, '.specflow', 'specs');
  const archiveDir = path.join(tmpDir, '.specflow', 'archive');
  fs.mkdirSync(specsDir, { recursive: true });
  fs.mkdirSync(archiveDir, { recursive: true });

  for (const [name, content] of Object.entries(specs || {})) {
    fs.writeFileSync(path.join(specsDir, name), content, 'utf8');
  }

  for (const [name, content] of Object.entries(archiveSpecs || {})) {
    fs.writeFileSync(path.join(archiveDir, name), content, 'utf8');
  }

  return tmpDir;
}

function cleanup(tmpDir) {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

function captureStdout(fn) {
  const origWrite = process.stdout.write;
  let captured = '';
  process.stdout.write = (s) => { captured += s; };
  try {
    fn();
  } finally {
    process.stdout.write = origWrite;
  }
  return captured;
}

const SPEC_CONTENT = `---
id: SPEC-001
type: feature
status: draft
complexity: medium
priority: p1
created: 2026-03-01
---

# My Test Feature

## Context

Some context here.
`;

const SPEC_002_CONTENT = `---
id: SPEC-002
type: bugfix
status: running
complexity: small
priority: p2
---

# Another Feature

Body text.
`;

console.log('spec.test.cjs');
console.log('');

// --- cmdSpecNextId tests ---

console.log('cmdSpecNextId:');

test('next-id with existing specs', () => {
  const tmpDir = createFixture({
    'SPEC-001.md': SPEC_CONTENT,
    'SPEC-002.md': SPEC_002_CONTENT,
  });
  try {
    const out = captureStdout(() => cmdSpecNextId(tmpDir, false));
    const result = JSON.parse(out);
    assert.equal(result.next_id, 'SPEC-003');
    assert.equal(result.next_number, 3);
  } finally {
    cleanup(tmpDir);
  }
});

test('next-id considers archive', () => {
  const tmpDir = createFixture(
    { 'SPEC-001.md': SPEC_CONTENT },
    { 'SPEC-005.md': '---\nid: SPEC-005\ntype: feature\nstatus: done\n---\n\n# Archived' }
  );
  try {
    const out = captureStdout(() => cmdSpecNextId(tmpDir, false));
    const result = JSON.parse(out);
    assert.equal(result.next_id, 'SPEC-006');
    assert.equal(result.next_number, 6);
  } finally {
    cleanup(tmpDir);
  }
});

test('next-id with empty dirs returns SPEC-001', () => {
  const tmpDir = createFixture({}, {});
  try {
    const out = captureStdout(() => cmdSpecNextId(tmpDir, false));
    const result = JSON.parse(out);
    assert.equal(result.next_id, 'SPEC-001');
    assert.equal(result.next_number, 1);
  } finally {
    cleanup(tmpDir);
  }
});

test('next-id ignores legacy named specs', () => {
  const tmpDir = createFixture({
    'SPEC-003.md': SPEC_CONTENT,
    'SPEC-GSD-A.md': '---\nid: SPEC-GSD-A\ntype: feature\nstatus: done\n---\n\n# Legacy',
  });
  try {
    const out = captureStdout(() => cmdSpecNextId(tmpDir, false));
    const result = JSON.parse(out);
    assert.equal(result.next_id, 'SPEC-004');
  } finally {
    cleanup(tmpDir);
  }
});

// --- cmdSpecLoad tests ---

console.log('');
console.log('cmdSpecLoad:');

test('loads valid spec', () => {
  const tmpDir = createFixture({ 'SPEC-001.md': SPEC_CONTENT });
  try {
    const out = captureStdout(() => cmdSpecLoad(tmpDir, 'SPEC-001', false));
    const result = JSON.parse(out);
    assert.equal(result.frontmatter.id, 'SPEC-001');
    assert.equal(result.frontmatter.type, 'feature');
    assert.equal(result.frontmatter.status, 'draft');
    assert.ok(result.body.includes('# My Test Feature'));
  } finally {
    cleanup(tmpDir);
  }
});

test('missing spec exits with error', () => {
  const tmpDir = createFixture({});
  try {
    const origExit = process.exit;
    const origStderr = process.stderr.write;
    let exitCode = null;
    let stderrOut = '';
    process.exit = (code) => { exitCode = code; throw new Error('EXIT'); };
    process.stderr.write = (s) => { stderrOut += s; };
    try {
      cmdSpecLoad(tmpDir, 'SPEC-999', false);
    } catch (e) {
      if (e.message !== 'EXIT') throw e;
    } finally {
      process.exit = origExit;
      process.stderr.write = origStderr;
    }
    assert.equal(exitCode, 1);
    assert.ok(stderrOut.includes('not found'));
  } finally {
    cleanup(tmpDir);
  }
});

// --- cmdSpecList tests ---

console.log('');
console.log('cmdSpecList:');

test('lists all specs', () => {
  const tmpDir = createFixture({
    'SPEC-001.md': SPEC_CONTENT,
    'SPEC-002.md': SPEC_002_CONTENT,
  });
  try {
    const out = captureStdout(() => cmdSpecList(tmpDir, false));
    const result = JSON.parse(out);
    assert.equal(result.length, 2);
    assert.equal(result[0].id, 'SPEC-001');
    assert.equal(result[0].title, 'My Test Feature');
    assert.equal(result[0].status, 'draft');
    assert.equal(result[0].complexity, 'medium');
    assert.equal(result[0].priority, 'p1');
    assert.equal(result[1].id, 'SPEC-002');
    assert.equal(result[1].title, 'Another Feature');
  } finally {
    cleanup(tmpDir);
  }
});

test('lists empty when no specs', () => {
  const tmpDir = createFixture({});
  try {
    const out = captureStdout(() => cmdSpecList(tmpDir, false));
    const result = JSON.parse(out);
    assert.equal(result.length, 0);
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
