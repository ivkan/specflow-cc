/**
 * tests/todo-next-id.test.cjs — Tests for cmdTodoNextId
 *
 * Covers:
 *   - Empty state baseline
 *   - Active TODO-*.md scan
 *   - Legacy TODO.md scan
 *   - Promoted-spec scan (specs/ and archive/) via `source: TODO-XXX` frontmatter
 *   - Combined scan picks max across all sources
 *   - `source:` line in spec body (not at line start) is ignored
 *
 * Run: node tests/todo-next-id.test.cjs
 */

'use strict';

const assert = require('assert').strict;
const fs = require('fs');
const path = require('path');
const os = require('os');

const { cmdTodoNextId } = require('../bin/lib/todo.cjs');

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
    console.log('    ' + (e.stack || e.message));
  }
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

function makeTmpProject() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sf-todo-next-id-test-'));
  fs.mkdirSync(path.join(tmpDir, '.specflow', 'todos'), { recursive: true });
  fs.mkdirSync(path.join(tmpDir, '.specflow', 'specs'), { recursive: true });
  fs.mkdirSync(path.join(tmpDir, '.specflow', 'archive'), { recursive: true });
  return tmpDir;
}

function cleanup(tmpDir) {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

function nextIdRaw(cwd) {
  return captureStdout(() => cmdTodoNextId(cwd, true)).trim();
}

console.log('todo-next-id.test.cjs');
console.log('');

console.log('cmdTodoNextId:');

test('baseline: empty .specflow/todos/ returns TODO-001', () => {
  const tmpDir = makeTmpProject();
  try {
    assert.equal(nextIdRaw(tmpDir), 'TODO-001');
  } finally {
    cleanup(tmpDir);
  }
});

test('active scan: TODO-005.md present → TODO-006', () => {
  const tmpDir = makeTmpProject();
  try {
    fs.writeFileSync(
      path.join(tmpDir, '.specflow', 'todos', 'TODO-005.md'),
      '---\nid: TODO-005\n---\n',
      'utf8'
    );
    assert.equal(nextIdRaw(tmpDir), 'TODO-006');
  } finally {
    cleanup(tmpDir);
  }
});

test('legacy scan: TODO.md referencing TODO-010 → TODO-011', () => {
  const tmpDir = makeTmpProject();
  try {
    fs.writeFileSync(
      path.join(tmpDir, '.specflow', 'todos', 'TODO.md'),
      '# Legacy\n\n- TODO-010 something\n',
      'utf8'
    );
    assert.equal(nextIdRaw(tmpDir), 'TODO-011');
  } finally {
    cleanup(tmpDir);
  }
});

test('promoted scan via specs/: source: TODO-020 in spec frontmatter → TODO-021', () => {
  const tmpDir = makeTmpProject();
  try {
    fs.writeFileSync(
      path.join(tmpDir, '.specflow', 'specs', 'SPEC-001.md'),
      '---\nid: SPEC-001\nsource: TODO-020\n---\n\nbody\n',
      'utf8'
    );
    assert.equal(nextIdRaw(tmpDir), 'TODO-021');
  } finally {
    cleanup(tmpDir);
  }
});

test('promoted scan via archive/: source: TODO-030 in archived spec → TODO-031', () => {
  const tmpDir = makeTmpProject();
  try {
    fs.writeFileSync(
      path.join(tmpDir, '.specflow', 'archive', 'SPEC-042.md'),
      '---\nid: SPEC-042\nsource: TODO-030\n---\n\nbody\n',
      'utf8'
    );
    assert.equal(nextIdRaw(tmpDir), 'TODO-031');
  } finally {
    cleanup(tmpDir);
  }
});

test('combined: TODO-005.md + archived source: TODO-088 → TODO-089 (skip gap)', () => {
  const tmpDir = makeTmpProject();
  try {
    fs.writeFileSync(
      path.join(tmpDir, '.specflow', 'todos', 'TODO-005.md'),
      '---\nid: TODO-005\n---\n',
      'utf8'
    );
    fs.writeFileSync(
      path.join(tmpDir, '.specflow', 'archive', 'SPEC-056.md'),
      '---\nid: SPEC-056\nsource: TODO-088\n---\n\nbody\n',
      'utf8'
    );
    assert.equal(nextIdRaw(tmpDir), 'TODO-089');
  } finally {
    cleanup(tmpDir);
  }
});

test('multiple source lines across files: picks max', () => {
  const tmpDir = makeTmpProject();
  try {
    fs.writeFileSync(
      path.join(tmpDir, '.specflow', 'specs', 'SPEC-001.md'),
      '---\nid: SPEC-001\nsource: TODO-040\n---\n',
      'utf8'
    );
    fs.writeFileSync(
      path.join(tmpDir, '.specflow', 'archive', 'SPEC-002.md'),
      '---\nid: SPEC-002\nsource: TODO-100\n---\n',
      'utf8'
    );
    fs.writeFileSync(
      path.join(tmpDir, '.specflow', 'archive', 'SPEC-003.md'),
      '---\nid: SPEC-003\nsource: TODO-050\n---\n',
      'utf8'
    );
    assert.equal(nextIdRaw(tmpDir), 'TODO-101');
  } finally {
    cleanup(tmpDir);
  }
});

test('source: with trailing context is parsed correctly', () => {
  const tmpDir = makeTmpProject();
  try {
    fs.writeFileSync(
      path.join(tmpDir, '.specflow', 'archive', 'SPEC-055.md'),
      '---\nid: SPEC-055\nsource: TODO-083 (retired at SPEC-055 split; canonical spec)\n---\n',
      'utf8'
    );
    assert.equal(nextIdRaw(tmpDir), 'TODO-084');
  } finally {
    cleanup(tmpDir);
  }
});

test('split suffix does not consume a number: TODO-093a + TODO-093b → TODO-094', () => {
  const tmpDir = makeTmpProject();
  try {
    for (const id of ['TODO-093', 'TODO-093a', 'TODO-093b']) {
      fs.writeFileSync(
        path.join(tmpDir, '.specflow', 'todos', id + '.md'),
        '---\nid: ' + id + '\n---\n',
        'utf8'
      );
    }
    assert.equal(nextIdRaw(tmpDir), 'TODO-094');
  } finally {
    cleanup(tmpDir);
  }
});

test('suffixed source: in an archived spec is read by its number', () => {
  const tmpDir = makeTmpProject();
  try {
    fs.writeFileSync(
      path.join(tmpDir, '.specflow', 'archive', 'SPEC-070.md'),
      '---\nid: SPEC-070\nsource: TODO-093a\n---\n',
      'utf8'
    );
    assert.equal(nextIdRaw(tmpDir), 'TODO-094');
  } finally {
    cleanup(tmpDir);
  }
});

test('unrecognized TODO filename is named on stderr, not counted silently', () => {
  const tmpDir = makeTmpProject();
  const origWrite = process.stderr.write;
  let stderrOutput = '';
  try {
    fs.writeFileSync(
      path.join(tmpDir, '.specflow', 'todos', 'TODO-007 copy.md'),
      '---\nid: TODO-007\n---\n',
      'utf8'
    );
    process.stderr.write = (s) => { stderrOutput += s; };
    const id = nextIdRaw(tmpDir);
    process.stderr.write = origWrite;

    assert.equal(id, 'TODO-001', 'a rejected name contributes no number');
    assert.ok(stderrOutput.includes('TODO-007 copy.md'), 'stderr must name the file');
  } finally {
    process.stderr.write = origWrite;
    cleanup(tmpDir);
  }
});

test('source: in spec body (not at line start) does NOT influence next-id', () => {
  const tmpDir = makeTmpProject();
  try {
    // The literal text " source: TODO-999" appears mid-line in spec body.
    // Anchored regex requires `source:` to follow ^ or \n, so this must be skipped.
    fs.writeFileSync(
      path.join(tmpDir, '.specflow', 'specs', 'SPEC-001.md'),
      '---\nid: SPEC-001\n---\n\nThe old source: TODO-999 reference was retired.\n',
      'utf8'
    );
    assert.equal(nextIdRaw(tmpDir), 'TODO-001');
  } finally {
    cleanup(tmpDir);
  }
});

console.log('');
console.log('Results: ' + passed + ' passed, ' + failed + ' failed');

if (failed > 0) {
  process.exit(1);
}
