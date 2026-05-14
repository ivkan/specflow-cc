/**
 * tests/todo-index.test.cjs — Tests for INDEX.md regen and freshness checks
 *
 * Covers:
 *   - cmdTodoReindex idempotency
 *   - cmdTodoReindex header contents
 *   - cmdTodoCheckStale: fresh, missing-from-index, extra-in-index, no-index
 *
 * Run: node tests/todo-index.test.cjs
 */

'use strict';

const assert = require('assert').strict;
const fs = require('fs');
const path = require('path');
const os = require('os');

const { cmdTodoReindex, cmdTodoCheckStale } = require('../bin/lib/todo.cjs');

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

function makeTodo(id, priority, status, created) {
  return [
    '---',
    'id: ' + id,
    'title: "Todo ' + id + '"',
    'priority: ' + priority,
    'complexity: —',
    'status: ' + status,
    'effort: —',
    'depends_on: —',
    'created: ' + created,
    '---',
    '',
    '## Description',
    'Body for ' + id + '.',
    '',
    '## Notes',
    '—',
    '',
  ].join('\n');
}

function fixture(todoMap) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sf-todo-index-test-'));
  const todosDir = path.join(tmpDir, '.specflow', 'todos');
  fs.mkdirSync(todosDir, { recursive: true });
  for (const [id, content] of Object.entries(todoMap || {})) {
    fs.writeFileSync(path.join(todosDir, id + '.md'), content, 'utf8');
  }
  return { tmpDir, todosDir };
}

function cleanup(tmpDir) {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

console.log('todo-index.test.cjs');
console.log('');

// ---------- cmdTodoReindex ----------

console.log('cmdTodoReindex:');

test('writes INDEX.md with new header text', () => {
  const { tmpDir, todosDir } = fixture({
    'TODO-001': makeTodo('TODO-001', 'high', 'open', '2026-05-14'),
  });
  try {
    captureStdout(() => cmdTodoReindex(tmpDir, false));
    const indexContent = fs.readFileSync(path.join(todosDir, 'INDEX.md'), 'utf8');

    // New header text — describes real behaviour (cache, refreshed by either path).
    assert.ok(
      indexContent.includes('Cache of individual TODO files'),
      'INDEX.md must call itself a cache'
    );
    assert.ok(
      indexContent.includes('INDEX-mutating command explicitly invokes the regen helper'),
      'INDEX.md must mention helper-driven refresh path'
    );
    // Old (misleading) header must NOT appear.
    assert.ok(
      !indexContent.includes('Auto-generated from individual TODO files'),
      'old misleading header must be gone'
    );
  } finally {
    cleanup(tmpDir);
  }
});

test('is idempotent across repeated runs', () => {
  const { tmpDir, todosDir } = fixture({
    'TODO-001': makeTodo('TODO-001', 'high', 'open', '2026-05-14'),
    'TODO-002': makeTodo('TODO-002', 'low', 'open', '2026-05-14'),
  });
  try {
    captureStdout(() => cmdTodoReindex(tmpDir, false));
    const indexPath = path.join(todosDir, 'INDEX.md');
    const first = fs.readFileSync(indexPath, 'utf8');

    // Strip the trailing "Last regenerated: ..." line — only that line is allowed
    // to change between identical runs.
    const stripTimestamp = s => s.replace(/\*Last regenerated:[^*]*\*/g, '*Last regenerated: <ts>*');

    captureStdout(() => cmdTodoReindex(tmpDir, false));
    const second = fs.readFileSync(indexPath, 'utf8');

    assert.equal(stripTimestamp(first), stripTimestamp(second), 'reindex must be idempotent');
  } finally {
    cleanup(tmpDir);
  }
});

test('drops deleted TODOs from INDEX.md after rerun', () => {
  const { tmpDir, todosDir } = fixture({
    'TODO-001': makeTodo('TODO-001', 'high', 'open', '2026-05-14'),
    'TODO-002': makeTodo('TODO-002', 'low', 'open', '2026-05-14'),
  });
  try {
    captureStdout(() => cmdTodoReindex(tmpDir, false));
    let indexContent = fs.readFileSync(path.join(todosDir, 'INDEX.md'), 'utf8');
    assert.ok(indexContent.includes('TODO-001'));
    assert.ok(indexContent.includes('TODO-002'));

    fs.unlinkSync(path.join(todosDir, 'TODO-001.md'));

    captureStdout(() => cmdTodoReindex(tmpDir, false));
    indexContent = fs.readFileSync(path.join(todosDir, 'INDEX.md'), 'utf8');

    assert.ok(!indexContent.includes('TODO-001'), 'deleted TODO must be absent after reindex');
    assert.ok(indexContent.includes('TODO-002'), 'remaining TODO must stay in INDEX');
  } finally {
    cleanup(tmpDir);
  }
});

// ---------- cmdTodoCheckStale ----------

console.log('cmdTodoCheckStale:');

test('reports FRESH after reindex with matching files', () => {
  const { tmpDir } = fixture({
    'TODO-001': makeTodo('TODO-001', 'high', 'open', '2026-05-14'),
    'TODO-002': makeTodo('TODO-002', 'low', 'open', '2026-05-14'),
  });
  try {
    captureStdout(() => cmdTodoReindex(tmpDir, false));
    const out = captureStdout(() => cmdTodoCheckStale(tmpDir, false));
    const result = JSON.parse(out);
    assert.equal(result.stale, false);
    assert.equal(result.index_exists, true);
    assert.equal(result.todo_count, 2);
    assert.equal(result.index_count, 2);
    assert.deepEqual(result.missing_from_index, []);
    assert.deepEqual(result.extra_in_index, []);
  } finally {
    cleanup(tmpDir);
  }
});

test('detects extra_in_index when TODO file deleted without reindex', () => {
  const { tmpDir, todosDir } = fixture({
    'TODO-001': makeTodo('TODO-001', 'high', 'open', '2026-05-14'),
    'TODO-002': makeTodo('TODO-002', 'low', 'open', '2026-05-14'),
  });
  try {
    captureStdout(() => cmdTodoReindex(tmpDir, false));
    fs.unlinkSync(path.join(todosDir, 'TODO-001.md'));

    const out = captureStdout(() => cmdTodoCheckStale(tmpDir, false));
    const result = JSON.parse(out);
    assert.equal(result.stale, true);
    assert.deepEqual(result.extra_in_index, ['TODO-001']);
    assert.deepEqual(result.missing_from_index, []);
    assert.equal(result.todo_count, 1);
    assert.equal(result.index_count, 2);
  } finally {
    cleanup(tmpDir);
  }
});

test('detects missing_from_index when TODO created without reindex', () => {
  const { tmpDir, todosDir } = fixture({
    'TODO-001': makeTodo('TODO-001', 'high', 'open', '2026-05-14'),
  });
  try {
    captureStdout(() => cmdTodoReindex(tmpDir, false));

    // External edit: add a TODO file, do not reindex.
    fs.writeFileSync(
      path.join(todosDir, 'TODO-007.md'),
      makeTodo('TODO-007', 'medium', 'open', '2026-05-14'),
      'utf8'
    );

    const out = captureStdout(() => cmdTodoCheckStale(tmpDir, false));
    const result = JSON.parse(out);
    assert.equal(result.stale, true);
    assert.deepEqual(result.missing_from_index, ['TODO-007']);
    assert.deepEqual(result.extra_in_index, []);
  } finally {
    cleanup(tmpDir);
  }
});

test('reports stale when INDEX.md absent but TODO files exist', () => {
  const { tmpDir } = fixture({
    'TODO-001': makeTodo('TODO-001', 'high', 'open', '2026-05-14'),
  });
  try {
    const out = captureStdout(() => cmdTodoCheckStale(tmpDir, false));
    const result = JSON.parse(out);
    assert.equal(result.stale, true);
    assert.equal(result.index_exists, false);
    assert.equal(result.todo_count, 1);
    assert.equal(result.index_count, 0);
    assert.deepEqual(result.missing_from_index, ['TODO-001']);
  } finally {
    cleanup(tmpDir);
  }
});

test('reports FRESH when both INDEX.md absent and no TODO files', () => {
  const { tmpDir } = fixture({});
  try {
    const out = captureStdout(() => cmdTodoCheckStale(tmpDir, false));
    const result = JSON.parse(out);
    assert.equal(result.stale, false);
    assert.equal(result.index_exists, false);
    assert.equal(result.todo_count, 0);
    assert.equal(result.index_count, 0);
  } finally {
    cleanup(tmpDir);
  }
});

test('raw output is FRESH/STALE marker', () => {
  const { tmpDir } = fixture({
    'TODO-001': makeTodo('TODO-001', 'high', 'open', '2026-05-14'),
  });
  try {
    captureStdout(() => cmdTodoReindex(tmpDir, false));
    let out = captureStdout(() => cmdTodoCheckStale(tmpDir, true));
    assert.equal(out.trim(), 'FRESH');

    fs.unlinkSync(path.join(tmpDir, '.specflow', 'todos', 'TODO-001.md'));
    out = captureStdout(() => cmdTodoCheckStale(tmpDir, true));
    assert.equal(out.trim(), 'STALE');
  } finally {
    cleanup(tmpDir);
  }
});

// ---------- Summary ----------

console.log('');
console.log('Results: ' + passed + ' passed, ' + failed + ' failed');

if (failed > 0) {
  process.exit(1);
}
