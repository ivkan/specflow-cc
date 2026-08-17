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

function captureStderr(fn) {
  const origWrite = process.stderr.write;
  let captured = '';
  process.stderr.write = (s) => { captured += s; };
  try {
    fn();
  } finally {
    process.stderr.write = origWrite;
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

// ---------- cmdTodoReindex — frontmatter validation ----------

console.log('cmdTodoReindex (validation):');

test('no frontmatter block — row MALFORMED, stderr warning, exit code 1', () => {
  process.exitCode = 0;
  const proseBody = [
    '## TODO-099',
    '',
    '**Status:** open',
    '**Priority:** high',
    '',
    'Some prose body without a YAML frontmatter block.',
  ].join('\n');

  const { tmpDir, todosDir } = fixture({ 'TODO-099': proseBody });
  let stderrOutput = '';
  try {
    captureStdout(() => {
      stderrOutput = captureStderr(() => cmdTodoReindex(tmpDir, false));
    });
    const indexContent = fs.readFileSync(path.join(todosDir, 'INDEX.md'), 'utf8');

    assert.ok(indexContent.includes('MALFORMED:'), 'INDEX row must contain MALFORMED:');
    assert.ok(indexContent.includes('no frontmatter block'), 'INDEX row must mention no frontmatter block');
    assert.ok(stderrOutput.includes('TODO-099.md'), 'stderr must mention the filename');
    assert.ok(stderrOutput.includes('no frontmatter block'), 'stderr must mention the reason');
    assert.equal(process.exitCode, 1, 'exit code must be 1');
  } finally {
    process.exitCode = 0;
    cleanup(tmpDir);
  }
});

test('missing id field — row MALFORMED, reason mentions id', () => {
  process.exitCode = 0;
  const content = [
    '---',
    'title: "No ID Todo"',
    'priority: medium',
    'status: open',
    'created: 2026-05-27',
    '---',
    '',
    'Body text.',
  ].join('\n');

  const { tmpDir, todosDir } = fixture({ 'TODO-100': content });
  let stderrOutput = '';
  try {
    captureStdout(() => {
      stderrOutput = captureStderr(() => cmdTodoReindex(tmpDir, false));
    });
    const indexContent = fs.readFileSync(path.join(todosDir, 'INDEX.md'), 'utf8');

    assert.ok(indexContent.includes('MALFORMED:'), 'INDEX row must contain MALFORMED:');
    assert.ok(stderrOutput.includes('id'), 'stderr reason must mention id');
    assert.equal(process.exitCode, 1, 'exit code must be 1');
  } finally {
    process.exitCode = 0;
    cleanup(tmpDir);
  }
});

test('missing title field — row MALFORMED, reason mentions title', () => {
  process.exitCode = 0;
  const content = [
    '---',
    'id: TODO-101',
    'priority: low',
    'status: open',
    'created: 2026-05-27',
    '---',
    '',
    'Body text.',
  ].join('\n');

  const { tmpDir, todosDir } = fixture({ 'TODO-101': content });
  let stderrOutput = '';
  try {
    captureStdout(() => {
      stderrOutput = captureStderr(() => cmdTodoReindex(tmpDir, false));
    });
    const indexContent = fs.readFileSync(path.join(todosDir, 'INDEX.md'), 'utf8');

    assert.ok(indexContent.includes('MALFORMED:'), 'INDEX row must contain MALFORMED:');
    assert.ok(stderrOutput.includes('title'), 'stderr reason must mention title');
    assert.equal(process.exitCode, 1, 'exit code must be 1');
  } finally {
    process.exitCode = 0;
    cleanup(tmpDir);
  }
});

test('missing created field — row MALFORMED, reason mentions created', () => {
  process.exitCode = 0;
  const content = [
    '---',
    'id: TODO-102',
    'title: "No Created Todo"',
    'priority: high',
    'status: open',
    '---',
    '',
    'Body text.',
  ].join('\n');

  const { tmpDir, todosDir } = fixture({ 'TODO-102': content });
  let stderrOutput = '';
  try {
    captureStdout(() => {
      stderrOutput = captureStderr(() => cmdTodoReindex(tmpDir, false));
    });
    const indexContent = fs.readFileSync(path.join(todosDir, 'INDEX.md'), 'utf8');

    assert.ok(indexContent.includes('MALFORMED:'), 'INDEX row must contain MALFORMED:');
    assert.ok(stderrOutput.includes('created'), 'stderr reason must mention created');
    assert.equal(process.exitCode, 1, 'exit code must be 1');
  } finally {
    process.exitCode = 0;
    cleanup(tmpDir);
  }
});

test('malformed YAML in frontmatter block — treated as malformed, warning + exit code 1', () => {
  process.exitCode = 0;
  // A "---" block whose content has no valid key:value lines breaks parsing;
  // parseFrontmatter() returns {}, so all required fields are missing.
  const content = [
    '---',
    'this line has no colon so the parser sees no fields',
    'another bad line',
    '---',
    '',
    'Body text.',
  ].join('\n');

  const { tmpDir, todosDir } = fixture({ 'TODO-103': content });
  let stderrOutput = '';
  try {
    captureStdout(() => {
      stderrOutput = captureStderr(() => cmdTodoReindex(tmpDir, false));
    });
    const indexContent = fs.readFileSync(path.join(todosDir, 'INDEX.md'), 'utf8');

    assert.ok(indexContent.includes('MALFORMED:'), 'INDEX row must contain MALFORMED:');
    assert.ok(stderrOutput.length > 0, 'stderr must receive a warning');
    assert.equal(process.exitCode, 1, 'exit code must be 1');
  } finally {
    process.exitCode = 0;
    cleanup(tmpDir);
  }
});

test('regression guard — well-formed TODOs: no warnings, no MALFORMED rows, legacy Total: format', () => {
  process.exitCode = 0;
  const { tmpDir, todosDir } = fixture({
    'TODO-001': makeTodo('TODO-001', 'high', 'open', '2026-05-14'),
    'TODO-002': makeTodo('TODO-002', 'medium', 'open', '2026-05-15'),
    'TODO-003': makeTodo('TODO-003', 'low', 'open', '2026-05-16'),
  });
  let stderrOutput = '';
  try {
    captureStdout(() => {
      stderrOutput = captureStderr(() => cmdTodoReindex(tmpDir, false));
    });
    const indexContent = fs.readFileSync(path.join(todosDir, 'INDEX.md'), 'utf8');

    assert.equal(stderrOutput, '', 'no stderr warnings for well-formed TODOs');
    assert.ok(!indexContent.includes('MALFORMED:'), 'no MALFORMED rows for well-formed TODOs');
    assert.equal(process.exitCode, 0, 'exit code must remain 0 for well-formed runs');
    // Assert exact legacy Total: format (no trailing ', X malformed' component).
    assert.ok(
      indexContent.includes('**Total:** 3 items (1 high, 1 medium, 1 low, 0 unset)'),
      'Total: line must match exact legacy format with no malformed component'
    );
  } finally {
    process.exitCode = 0;
    cleanup(tmpDir);
  }
});

// ---------- Split ids (TODO-093a) ----------

console.log('cmdTodoReindex (split ids):');

test('suffixed TODO files are indexed, ordered TODO-093, 093a, 093b, 094', () => {
  process.exitCode = 0;
  const { tmpDir, todosDir } = fixture({
    // Same priority and created date for all four, so the tie-breaker alone
    // decides the order.
    'TODO-094': makeTodo('TODO-094', 'high', 'open', '2026-04-08'),
    'TODO-093b': makeTodo('TODO-093b', 'high', 'open', '2026-04-08'),
    'TODO-093': makeTodo('TODO-093', 'high', 'open', '2026-04-08'),
    'TODO-093a': makeTodo('TODO-093a', 'high', 'open', '2026-04-08'),
  });
  let stderrOutput = '';
  let stdout = '';
  try {
    stdout = captureStdout(() => {
      stderrOutput = captureStderr(() => cmdTodoReindex(tmpDir, false));
    });
    const result = JSON.parse(stdout);
    const indexContent = fs.readFileSync(path.join(todosDir, 'INDEX.md'), 'utf8');

    assert.equal(result.reindexed, 4, 'all four files must be indexed');
    assert.deepEqual(result.rejected, [], 'well-formed split ids are not rejections');
    assert.equal(stderrOutput, '', 'no warnings for well-formed split ids');
    assert.equal(process.exitCode, 0, 'split ids must not set a failure exit code');

    for (const id of ['TODO-093', 'TODO-093a', 'TODO-093b', 'TODO-094']) {
      assert.ok(indexContent.includes('| ' + id + ' |'), id + ' must appear in INDEX.md');
    }

    // Locked-in order: a split TODO sits directly after its parent.
    const order = indexContent
      .split('\n')
      .map(l => l.match(/^\|\s*\d+\s*\|\s*(TODO-\S+)\s*\|/))
      .filter(Boolean)
      .map(m => m[1]);
    assert.deepEqual(order, ['TODO-093', 'TODO-093a', 'TODO-093b', 'TODO-094']);
  } finally {
    process.exitCode = 0;
    cleanup(tmpDir);
  }
});

test('check-stale is FRESH for suffixed TODOs after reindex', () => {
  process.exitCode = 0;
  const { tmpDir } = fixture({
    'TODO-093': makeTodo('TODO-093', 'high', 'open', '2026-04-08'),
    'TODO-093a': makeTodo('TODO-093a', 'high', 'open', '2026-04-08'),
    'TODO-093b': makeTodo('TODO-093b', 'low', 'open', '2026-04-08'),
  });
  try {
    captureStdout(() => cmdTodoReindex(tmpDir, false));
    process.exitCode = 0;
    const out = captureStdout(() => cmdTodoCheckStale(tmpDir, false));
    const result = JSON.parse(out);
    assert.equal(result.stale, false, 'suffixed ids must not read as drift');
    assert.equal(result.todo_count, 3);
    assert.equal(result.index_count, 3);
    assert.deepEqual(result.missing_from_index, []);
    assert.equal(process.exitCode, 0);
  } finally {
    process.exitCode = 0;
    cleanup(tmpDir);
  }
});

test('frontmatter id disagreeing with filename — row MALFORMED, exit code 1', () => {
  process.exitCode = 0;
  // A split that renamed the file but left the parent id inside: INDEX would
  // otherwise list TODO-093 twice while TODO-093a.md sits unreferenced.
  const { tmpDir, todosDir } = fixture({
    'TODO-093a': makeTodo('TODO-093', 'high', 'open', '2026-04-08'),
  });
  let stderrOutput = '';
  try {
    captureStdout(() => {
      stderrOutput = captureStderr(() => cmdTodoReindex(tmpDir, false));
    });
    const indexContent = fs.readFileSync(path.join(todosDir, 'INDEX.md'), 'utf8');

    assert.ok(indexContent.includes('MALFORMED:'), 'INDEX row must contain MALFORMED:');
    assert.ok(indexContent.includes('TODO-093a'), 'row must carry the filename id');
    assert.ok(stderrOutput.includes('id mismatch'), 'stderr must name the mismatch');
    assert.equal(process.exitCode, 1, 'exit code must be 1');
  } finally {
    process.exitCode = 0;
    cleanup(tmpDir);
  }
});

// ---------- Unindexable filenames must never be dropped in silence ----------

console.log('cmdTodoReindex (rejected filenames):');

test('reindex does not report plain success when a TODO-*.md file is dropped', () => {
  process.exitCode = 0;
  const { tmpDir, todosDir } = fixture({
    'TODO-001': makeTodo('TODO-001', 'high', 'open', '2026-05-14'),
    'TODO-002 copy': makeTodo('TODO-002', 'high', 'open', '2026-05-14'),
  });
  let stderrOutput = '';
  let stdout = '';
  try {
    stdout = captureStdout(() => {
      stderrOutput = captureStderr(() => cmdTodoReindex(tmpDir, false));
    });
    const result = JSON.parse(stdout);
    const indexContent = fs.readFileSync(path.join(todosDir, 'INDEX.md'), 'utf8');

    // The count alone used to be the whole story, and it said "success".
    assert.equal(result.reindexed, 1, 'only the valid file is indexed');
    assert.equal(result.rejected.length, 1, 'the dropped file must be reported');
    assert.equal(result.rejected[0].file, 'TODO-002 copy.md', 'reported by name');
    assert.ok(result.rejected[0].reason, 'reported with a reason');
    assert.equal(process.exitCode, 1, 'a dropped file is a non-zero exit');
    assert.ok(stderrOutput.includes('TODO-002 copy.md'), 'stderr must name the file');
    assert.ok(
      indexContent.includes('Not indexed') && indexContent.includes('TODO-002 copy.md'),
      'INDEX.md itself must say which files it does not cover'
    );
  } finally {
    process.exitCode = 0;
    cleanup(tmpDir);
  }
});

test('raw reindex output names dropped files instead of claiming success', () => {
  process.exitCode = 0;
  const { tmpDir } = fixture({
    'TODO-001': makeTodo('TODO-001', 'high', 'open', '2026-05-14'),
    'TODO-XYZ': makeTodo('TODO-XYZ', 'high', 'open', '2026-05-14'),
  });
  try {
    let out = '';
    captureStderr(() => {
      out = captureStdout(() => cmdTodoReindex(tmpDir, true));
    });
    assert.ok(out.includes('NOT indexed'), 'raw summary must flag the omission');
    assert.ok(out.includes('TODO-XYZ.md'), 'raw summary must name the file');
    assert.equal(process.exitCode, 1);
  } finally {
    process.exitCode = 0;
    cleanup(tmpDir);
  }
});

test('check-stale reports an unindexable file rather than FRESH', () => {
  process.exitCode = 0;
  const { tmpDir, todosDir } = fixture({
    'TODO-001': makeTodo('TODO-001', 'high', 'open', '2026-05-14'),
  });
  try {
    captureStderr(() => captureStdout(() => cmdTodoReindex(tmpDir, false)));
    process.exitCode = 0;

    // Appears after the reindex: INDEX.md is complete for every id it can see,
    // which is exactly the situation the old check-stale called FRESH.
    fs.writeFileSync(
      path.join(todosDir, 'TODO-002-old.md'),
      makeTodo('TODO-002', 'high', 'open', '2026-05-14'),
      'utf8'
    );

    let out = '';
    const stderrOutput = captureStderr(() => {
      out = captureStdout(() => cmdTodoCheckStale(tmpDir, false));
    });
    const result = JSON.parse(out);

    assert.equal(result.stale, true, 'a file no reindex can pick up is drift');
    assert.equal(result.unindexable_files.length, 1);
    assert.equal(result.unindexable_files[0].file, 'TODO-002-old.md');
    assert.ok(stderrOutput.includes('TODO-002-old.md'), 'stderr must name the file');
    assert.equal(process.exitCode, 1);
  } finally {
    process.exitCode = 0;
    cleanup(tmpDir);
  }
});

test('non-TODO files in the directory are ignored without noise', () => {
  process.exitCode = 0;
  const { tmpDir } = fixture({
    'TODO-001': makeTodo('TODO-001', 'high', 'open', '2026-05-14'),
    'NOTES': '# scratch\n',
    'TODO': '# legacy monolithic file\n',
  });
  let stderrOutput = '';
  try {
    captureStdout(() => {
      stderrOutput = captureStderr(() => cmdTodoReindex(tmpDir, false));
    });
    assert.equal(stderrOutput, '', 'only TODO-*.md names are held to the id grammar');
    assert.equal(process.exitCode, 0);
  } finally {
    process.exitCode = 0;
    cleanup(tmpDir);
  }
});

// ---------- Summary ----------

console.log('');
console.log('Results: ' + passed + ' passed, ' + failed + ' failed');

if (failed > 0) {
  process.exit(1);
}
