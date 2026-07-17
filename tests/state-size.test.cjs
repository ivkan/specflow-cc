/**
 * tests/state-size.test.cjs — STATE.md size discipline, rotation, and schema-adaptive I/O
 *
 * Run: node tests/state-size.test.cjs
 *
 * The fixture reproduces the shape of a real field STATE.md that reached 205 KB at 92
 * lines and was destroyed twice by agents doing a full-file Write after a truncated Read:
 *
 *   - one ~80 KB `Next Step` cell in Active Specifications (NOT in Decisions — the
 *     rotation-only fix everyone reaches for first would never touch it)
 *   - raw, unescaped `|` inside that cell, which shifted every column right
 *   - a Queue whose `Title` holds a 3 KB narrative
 *   - 55 decision rows, several multi-KB
 *   - table schemas drifted away from templates/state.md (3-column Decisions,
 *     4-column Queue) because agents reconstructing the file invented columns
 *   - blockquote prose between the heading and the table
 */

'use strict';

const assert = require('assert').strict;
const fs = require('fs');
const path = require('path');
const os = require('os');

const { rotateContent } = require('../bin/lib/state-decisions.cjs');
const { loadSizeConfig, checkCell, integrity, SizeError } = require('../bin/lib/state-size.cjs');
const { checkState } = require('../bin/lib/state-check.cjs');
const { splitRow, escapeCell, unescapeCell, renderRow, detectOrder, findSection } = require('../bin/lib/state-table.cjs');
const { parseActiveSpecsTable } = require('../bin/lib/resolve.cjs');
const { parseQueueTable } = require('../bin/lib/state.cjs');
const { cmdSetExecution } = require('../bin/lib/state-queue.cjs');

/**
 * Rough bytes at which a markdown file stops fitting in one agent Read (~25k tokens).
 * A fixture above this is one no agent could read whole — the precondition for the
 * truncated-read → full-Write destruction this suite guards against.
 */
const READ_CAP_BYTES = 100000;

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log('  PASS: ' + name);
  } catch (e) {
    failed++;
    console.log('  FAIL: ' + name);
    console.log('    ' + e.message);
  }
}

// ─── Fixture ──────────────────────────────────────────────────────────────────

/**
 * An audit narrative containing raw pipes — the exact hazard found in the field, where
 * the 80 KB `Next Step` cell held two unescaped `|`.
 *
 * Only used for TRAILING columns. A raw pipe in a middle column is unrecoverable by any
 * parser (nothing distinguishes it from a column separator); `state check` reports such
 * rows as broken tables instead of guessing. The field file's fat Queue `Title` — a
 * middle column — happened to contain no pipes, so `pipeFree` mirrors it.
 */
function narrative(n) {
  return '**Audit v9 → NEEDS_REVISION** — 3 CRITICALS in `write_behind.rs` ' +
         '| routing after revision | split trigger does NOT fire. ' +
         'x'.repeat(Math.max(0, n - 130));
}

/** Same bulk, no raw pipes — for cells that are not the trailing column. */
function pipeFree(n) {
  return '**POLICY (user decision): NO RUSH on the full 72h soak — re-run G4b first.** ' +
         'x'.repeat(Math.max(0, n - 80));
}

function fieldFixture() {
  const decisions = [];
  // 55 rows, newest-first (the field file's order), several of them multi-KB.
  // Decision is the trailing column, so these carry raw pipes like the real ones did.
  for (let i = 0; i < 55; i++) {
    const day = String(28 - (i % 28)).padStart(2, '0');
    const text = i < 12 ? narrative(3500) : `Verdict ${i} — see spec Audit History`;
    decisions.push(`| 2026-07-${day} | SPEC-${300 + i} | ${text} |`);
  }

  return [
    '## Active Specifications',
    '',
    '| SPEC-ID | Status | Next Step |',
    '|---------|--------|-----------|',
    `| SPEC-350 | revision_requested | ${narrative(80000)} |`,
    '| SPEC-349 | auditing | /sf:audit |',
    '',
    '## Queue',
    '',
    '| ID | Title | Priority | Created |',
    '|----|-------|----------|---------|',
    `| SPEC-348 | ${pipeFree(3000)} | high | 2026-06-24 |`,
    '| SPEC-351 | Short title | medium | 2026-07-01 |',
    '',
    '## Decisions',
    '',
    '> Older decisions are rotated into DECISIONS_ARCHIVE.md (table format preserved).',
    '> INCIDENT 2026-07-12: a truncated read was written back and destroyed the tail.',
    '',
    '| Date | Spec | Decision |',
    '|------|------|----------|',
    ...decisions,
    '',
  ].join('\n');
}

function tmpProject(content) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sf-size-'));
  fs.mkdirSync(path.join(dir, '.specflow'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.specflow', 'STATE.md'), content, 'utf8');
  return dir;
}

const section = (txt, name) => {
  const ls = txt.split('\n');
  const s = ls.findIndex(x => x.trim() === '## ' + name);
  if (s === -1) return null;
  let e = ls.length;
  for (let i = s + 1; i < ls.length; i++) if (ls[i].startsWith('## ')) { e = i; break; }
  return ls.slice(s, e).join('\n');
};

(async () => {
  console.log('state-size.test.cjs');
  console.log('');

  const cfg = loadSizeConfig(tmpProject('x'));

  // ── Table primitives ──
  console.log('state-table primitives:');

  await test('splitRow: last column absorbs unescaped pipes', () => {
    const cells = splitRow('| SPEC-350 | running | a | b | c |', 3);
    assert.equal(cells.length, 3);
    assert.equal(cells[0], 'SPEC-350');
    assert.equal(cells[1], 'running');
    assert.equal(cells[2], 'a | b | c', 'trailing cell must absorb the surplus verbatim');
  });

  await test('splitRow: pads missing cells rather than shifting them', () => {
    const cells = splitRow('| SPEC-1 | done |', 3);
    assert.deepEqual(cells, ['SPEC-1', 'done', '']);
  });

  await test('splitRow: empty middle cell keeps its position', () => {
    // The old parser filtered empty cells out, silently shifting every later column left.
    const cells = splitRow('| SPEC-1 |  | high |', 3);
    assert.deepEqual(cells, ['SPEC-1', '', 'high']);
  });

  await test('escapeCell/unescapeCell round-trip pipes and newlines', () => {
    const raw = 'a | b\nc';
    assert.equal(escapeCell(raw), 'a \\| b c');
    assert.equal(unescapeCell(escapeCell(raw)), 'a | b c');
  });

  await test('escapeCell is idempotent', () => {
    assert.equal(escapeCell(escapeCell('a | b')), escapeCell('a | b'));
  });

  await test('renderRow → splitRow round-trips a pipe-bearing value', () => {
    const line = renderRow(['SPEC-1', 'done', 'x | y']);
    const back = splitRow(line, 3);
    assert.equal(unescapeCell(back[2]), 'x | y');
  });

  await test('detectOrder identifies newest-first vs oldest-first', () => {
    assert.equal(detectOrder(['2026-07-16', '2026-07-01']), 'desc');
    assert.equal(detectOrder(['2026-07-01', '2026-07-16']), 'asc');
    assert.equal(detectOrder(['2026-07-01']), 'asc');
  });

  // ── Schema-adaptive parsing ──
  console.log('');
  console.log('schema-adaptive parsing:');

  await test('parseActiveSpecsTable recovers a pipe-bearing Next Step in full', () => {
    const rows = parseActiveSpecsTable(fieldFixture());
    assert.equal(rows.length, 2);
    assert.equal(rows[0].id, 'SPEC-350');
    assert.equal(rows[0].status, 'revision_requested');
    assert.ok(rows[0].nextStep.length > 70000,
      'Next Step must not be cut at the first internal pipe (got ' + rows[0].nextStep.length + ')');
  });

  await test('parseQueueTable maps drifted columns by name, not position', () => {
    // Field schema: | ID | Title | Priority | Created | — no Status column at all.
    const q = parseQueueTable(fieldFixture());
    assert.equal(q.length, 2);
    assert.equal(q[0].id, 'SPEC-348');
    assert.equal(q[0].priority, 'high');
    assert.equal(q[0].status, '', 'a missing column must be empty, never a borrowed neighbour');
    assert.equal(q[1].title, 'Short title');
  });

  await test('parseQueueTable handles the canonical template schema', () => {
    const q = parseQueueTable([
      '## Queue', '',
      '| # | ID | Title | Priority | Status |',
      '|---|----|-------|----------|--------|',
      '| 1 | SPEC-001 | Thing | high | draft |',
    ].join('\n'));
    assert.equal(q.length, 1);
    assert.deepEqual(
      { id: q[0].id, title: q[0].title, priority: q[0].priority, status: q[0].status },
      { id: 'SPEC-001', title: 'Thing', priority: 'high', status: 'draft' }
    );
  });

  await test('parseQueueTable skips placeholder rows', () => {
    const q = parseQueueTable([
      '## Queue', '',
      '| # | ID | Title | Priority | Status |',
      '|---|----|-------|----------|--------|',
      '| — | — | — | — | — |',
    ].join('\n'));
    assert.equal(q.length, 0);
  });

  // ── Cell cap ──
  console.log('');
  console.log('cell cap (caller error → hard error):');

  await test('checkCell accepts a pointer-sized value', () => {
    assert.equal(checkCell('/sf:audit', 'next_step', cfg), '/sf:audit');
  });

  await test('checkCell rejects a narrative with an actionable code', () => {
    try {
      checkCell('x'.repeat(5000), 'next_step', cfg);
      assert.fail('should have thrown');
    } catch (e) {
      assert.ok(e instanceof SizeError);
      assert.equal(e.code, 'CELL_TOO_LARGE');
      assert.equal(e.details.actual, 5000);
      assert.equal(e.details.cap, cfg.cellHardCap);
    }
  });

  await test('checkCell boundary: exactly at the cap passes, one over fails', () => {
    assert.ok(checkCell('x'.repeat(cfg.cellHardCap), 'c', cfg));
    assert.throws(() => checkCell('x'.repeat(cfg.cellHardCap + 1), 'c', cfg), SizeError);
  });

  // ── Rotation ──
  console.log('');
  console.log('rotation (byte-based):');

  const fixture = fieldFixture();
  const r1 = rotateContent(fixture, cfg, 10);
  const r2 = rotateContent(r1.content, cfg, 10);

  await test('fixture reproduces the field shape', () => {
    const before = integrity(fixture, cfg);
    // The defining property: enormous in BYTES while trivial in LINES. The old
    // "keep it under ~100 lines" guidance is blind to exactly this file.
    assert.ok(before.bytes > READ_CAP_BYTES,
      'fixture must exceed an agent Read cap (got ' + before.bytes + ')');
    assert.ok(before.lines < 100,
      'fixture should be <100 lines — line count never catches this (got ' + before.lines + ')');
    assert.ok(before.max_row_bytes > 70000, 'needs the ~80 KB single row');
    assert.ok(before.decision_rows >= 50);
    assert.ok(before.over_limit);
  });

  await test('rotate brings the field-shaped fixture under the 32 KB limit', () => {
    const after = integrity(r1.content, cfg);
    assert.ok(!after.over_limit, 'still over limit at ' + after.bytes + ' bytes');
  });

  await test('rotate keeps the N newest decision rows', () => {
    assert.equal(integrity(r1.content, cfg).decision_rows, 10);
  });

  await test('rotate compresses the oversized ACTIVE SPEC cell (not just Decisions)', () => {
    const hit = r1.compressed.find(c => c.section === 'Active Specifications');
    assert.ok(hit, 'the 80 KB Next Step must be compressed');
    assert.ok(hit.was > 70000);
  });

  await test('rotate compresses the oversized QUEUE cell', () => {
    const hit = r1.compressed.find(c => c.section === 'Queue');
    assert.ok(hit, 'the 3 KB Title must be compressed');
    assert.equal(hit.column, 'Title');
  });

  await test('no data loss: every compressed cell reaches the archive in full', () => {
    for (const c of r1.compressed) {
      const found = r1.archived.find(e => e.text.length === c.was);
      assert.ok(found, `full text for ${c.section}/${c.column} (${c.was} chars) missing from archive`);
    }
  });

  await test('compressed cells leave a pointer to the archive', () => {
    const row = r1.content.split('\n').find(l => l.startsWith('| SPEC-350'));
    assert.ok(row.includes('[full text: DECISIONS_ARCHIVE.md'));
    assert.ok(Buffer.byteLength(row, 'utf8') < 700, 'pointer row still fat: ' + row.length);
  });

  await test('rotate is idempotent', () => {
    assert.equal(r2.content, r1.content);
    assert.equal(r2.archived.length, 0);
    assert.equal(r2.compressed.length, 0);
  });

  await test('rotate preserves untouched cells byte-for-byte', () => {
    // SPEC-351's queue row has no oversized cell and must survive verbatim.
    const before = fixture.split('\n').find(l => l.startsWith('| SPEC-351'));
    const after = r1.content.split('\n').find(l => l.startsWith('| SPEC-351'));
    assert.equal(after, before);
  });

  await test('rotate preserves prose and blockquotes a re-render would eat', () => {
    const quotes = (t) => t.split('\n').filter(l => l.startsWith('> ')).join('\n');
    assert.equal(quotes(r1.content), quotes(fixture));
  });

  await test('rotate preserves the drifted schema instead of rewriting it', () => {
    assert.ok(r1.content.includes('| Date | Spec | Decision |'), 'Decisions header must survive');
    assert.ok(r1.content.includes('| ID | Title | Priority | Created |'), 'Queue header must survive');
  });

  await test('rotate keeps active spec identity intact', () => {
    const before = parseActiveSpecsTable(fixture).map(r => r.id);
    const after = parseActiveSpecsTable(r1.content).map(r => r.id);
    assert.deepEqual(after, before);
  });

  await test('rotate --keep 0 archives every decision row', () => {
    const r = rotateContent(fixture, cfg, 0);
    assert.equal(integrity(r.content, cfg).decision_rows, 0);
    assert.ok(r.archived.length >= 55);
  });

  await test('rotate is a no-op on an already-small file', () => {
    const small = [
      '## Active Specifications', '',
      '| SPEC-ID | Status | Next Step |',
      '|---------|--------|-----------|',
      '| SPEC-001 | running | /sf:run |', '',
      '## Decisions', '',
      '| Date | Decision |',
      '|------|----------|',
      '| 2026-07-01 | SPEC-001: done |', '',
    ].join('\n');
    const r = rotateContent(small, cfg, 10);
    assert.equal(r.content, small);
    assert.equal(r.archived.length, 0);
  });

  // ── Regression: the "destroyed twice" class ──
  console.log('');
  console.log('regression (the destroyed-twice class):');

  await test('raw pipes in a MIDDLE column are reported, not silently mis-parsed', () => {
    // Known limit: nothing distinguishes a raw `|` in a middle cell from a separator, so
    // it cannot be recovered. What must never happen is a silent wrong answer — the old
    // parser shifted every later column and returned it as fact. Escaping on write
    // prevents new occurrences; `check` surfaces legacy ones.
    const bad = [
      '## Queue', '',
      '| # | ID | Title | Priority | Status |',
      '|---|----|-------|----------|--------|',
      '| 1 | SPEC-001 | a | b | high | draft |',
    ].join('\n');
    const f = checkState(bad, cfg);
    assert.ok(f.broken_tables.some(b => b.section === 'Queue' && /unescaped/.test(b.reason)),
      'a mid-column raw pipe must be reported as a broken table');
  });

  await test('a file larger than any plausible Read cap round-trips losslessly', () => {
    // The tombstone test: every `state` path must survive a file no agent could ever
    // read whole. Node has no Read cap; the agent-side Write path is what killed it.
    const huge = fieldFixture();
    assert.ok(Buffer.byteLength(huge, 'utf8') > READ_CAP_BYTES);

    const specs = parseActiveSpecsTable(huge);
    const queue = parseQueueTable(huge);
    assert.equal(specs.length, 2);
    assert.equal(queue.length, 2);

    // The 80 KB narrative survives a parse → render → parse cycle intact.
    const line = renderRow([specs[0].id, specs[0].status, specs[0].nextStep]);
    const back = splitRow(line, 3);
    assert.equal(unescapeCell(back[2]), specs[0].nextStep,
      'the oversized cell must survive a round-trip unchanged');
  });

  await test('rotation never drops a decision row on the floor', () => {
    const before = integrity(fixture, cfg).decision_rows;
    const after = integrity(r1.content, cfg).decision_rows;
    const archivedDecisions = r1.archived.filter(e => /^SPEC-\d+$/.test(e.spec)).length;
    assert.equal(after + archivedDecisions, before,
      `${before} rows in, ${after} kept + ${archivedDecisions} archived out`);
  });

  // ── Diagnostics ──
  console.log('');
  console.log('state check:');

  await test('check flags the pre-rotate fixture', () => {
    const f = checkState(fixture, cfg);
    assert.ok(f.over_limit);
    assert.ok(f.oversized_cells.length > 0);
    assert.ok(f.oversized_rows.length > 0);
    assert.equal(f.ok, undefined); // ok is added by the command layer, not checkState
  });

  await test('check is quiet on the post-rotate fixture', () => {
    const f = checkState(r1.content, cfg);
    assert.ok(!f.over_limit, 'still over limit');
    assert.equal(f.oversized_cells.length, 0, 'check must not report what rotate declines to fix');
    assert.equal(f.truncation_scar, null);
  });

  await test('check reports schema drift without calling it a problem', () => {
    const f = checkState(fixture, cfg);
    assert.equal(f.schema_drift.length, 2, 'drifted Queue + Decisions');
    const q = f.schema_drift.find(d => d.section === 'Queue');
    assert.deepEqual(q.actual, ['ID', 'Title', 'Priority', 'Created']);
  });

  await test('check detects a truncation scar (file ends mid-row)', () => {
    const scarred = '## Active Specifications\n\n' +
      '| SPEC-ID | Status | Next Step |\n' +
      '|---------|--------|-----------|\n' +
      '| SPEC-001 | running | /sf:run';
    const f = checkState(scarred, cfg);
    assert.ok(f.truncation_scar, 'mid-row ending must be flagged');
    assert.ok(/mid-row/.test(f.truncation_scar));
  });

  await test('check detects a truncation scar (sections lost)', () => {
    const f = checkState('## Active Specifications\n\n| SPEC-ID | Status | Next Step |\n|--|--|--|\n', cfg);
    assert.ok(f.truncation_scar);
    assert.ok(/missing sections/.test(f.truncation_scar));
  });

  await test('check flags a row with unescaped pipes as a broken table', () => {
    const f = checkState(fixture, cfg);
    assert.ok(f.broken_tables.some(b => /unescaped/.test(b.reason)),
      'the raw-pipe row must be reported');
  });

  // ── Execution Status self-heal ──
  console.log('');
  console.log('execution status:');

  await test('set-execution creates the section when the file lacks it', async () => {
    // Field files migrated from an older schema have no `## Execution Status` section.
    // Orchestrators call set-execution once per wave and cannot pre-seed it, so it must
    // self-heal rather than error.
    const dir = tmpProject([
      '## Active Specifications', '',
      '| SPEC-ID | Status | Next Step |',
      '|---------|--------|-----------|',
      '| SPEC-001 | running | /sf:run |', '',
      '## Queue', '',
      '| # | ID | Title | Priority | Status |',
      '|---|----|-------|----------|--------|', '',
      '---', '*Last updated: 2026-07-17*', '',
    ].join('\n'));

    const orig = process.stdout.write;
    process.stdout.write = () => {};
    try {
      await cmdSetExecution(dir, 'SPEC-001', { mode: 'orchestrated', progress: 'Wave 1/3 (33%)' }, true);
    } finally {
      process.stdout.write = orig;
    }

    const after = fs.readFileSync(path.join(dir, '.specflow', 'STATE.md'), 'utf8');
    const lines = after.split('\n');
    assert.ok(findSection(lines, 'Execution Status'), 'section must be created');
    assert.ok(after.includes('SPEC-001'), 'the row must be written');
    assert.ok(after.includes('Wave 1/3 (33%)'));
    // Footer preserved below the new section.
    assert.ok(/\*Last updated: 2026-07-17\*/.test(after), 'footer must survive');
    fs.rmSync(dir, { recursive: true, force: true });
  });

  console.log('');
  console.log(`${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
})();
