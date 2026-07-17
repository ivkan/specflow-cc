/**
 * bin/lib/state-queue.cjs — Row writers for STATE.md's Queue and Execution Status tables
 *
 * `spec-creator` adds specs to the Queue, `spec-splitter` swaps a parent for its children,
 * and the executor orchestrators stamp Execution Status once per wave. All of them did it
 * by rewriting STATE.md wholesale with the Write tool — the path that destroyed the file
 * twice. These commands give those flows a surgical alternative, which is what makes the
 * prohibition in the agent files actionable rather than aspirational.
 *
 * Like every STATE.md writer here, columns come from the header row ON DISK — the Queue
 * schema has drifted in the wild (`| ID | Title | Priority | Created |` in a field project
 * vs `| # | ID | Title | Priority | Status |` in templates/state.md).
 *
 * Exports: cmdQueueAdd(), cmdQueueRemove(), cmdSetExecution(), cmdClearExecution()
 */

'use strict';

const path = require('path');
const { output, error, safeReadFile, atomicWrite } = require('./core.cjs');
const { withStateLock } = require('./lock.cjs');
const { findSection, findTable, splitRow, renderRow, unescapeCell } = require('./state-table.cjs');
const { loadSizeConfig, checkCell, integrity } = require('./state-size.cjs');
const { colIndex, formatIntegrity } = require('./state-decisions.cjs');

const ID_ALIASES = ['id', 'spec-id', 'spec id', 'spec'];

function today() {
  return new Date().toISOString().slice(0, 10);
}

/** Is this row a `| — | — | … |` placeholder? */
function isPlaceholder(cells) {
  return cells.every(c => !c || c === '—' || c === '-');
}

/**
 * Locate a table row in a section by its key column value.
 * @returns {{tbl, keyIdx, lineIdx, cells}|null} lineIdx -1 when the row is absent
 */
function locateRow(lines, section, keyAliases, key) {
  const sec = findSection(lines, section);
  if (!sec) return null;

  const tbl = findTable(lines, sec.start, sec.end);
  if (!tbl) return null;

  const keyIdx = colIndex(tbl.columns, keyAliases);
  if (keyIdx === -1) return { tbl, keyIdx: -1, lineIdx: -1 };

  for (const li of tbl.rowIdxs) {
    const cells = splitRow(lines[li], tbl.columns.length);
    if (!cells) continue;
    if (unescapeCell(cells[keyIdx]) === key) return { tbl, keyIdx, lineIdx: li, cells };
  }

  return { tbl, keyIdx, lineIdx: -1 };
}

/**
 * Insert or update one row, editing a single LINE so untouched bytes stay untouched.
 *
 * @param {string[]} lines
 * @param {Object} found - from locateRow
 * @param {Object} updates - {aliases: value} to set
 * @param {string} key
 * @param {Object} [onInsert] - {aliases: value} applied only when creating the row
 * @returns {string[]} new lines
 */
function upsertRow(lines, found, updates, key, onInsert) {
  const cols = found.tbl.columns;
  const set = (cells, aliases, value) => {
    if (value === undefined || value === null) return;
    const i = colIndex(cols, aliases);
    if (i !== -1) cells[i] = String(value);
  };

  let cells;
  if (found.lineIdx !== -1) {
    cells = found.cells.map(unescapeCell);
  } else {
    cells = cols.map(() => '');
    cells[found.keyIdx] = key;
    for (const [aliases, value] of onInsert || []) set(cells, aliases, value);
  }

  for (const [aliases, value] of updates) set(cells, aliases, value);

  const line = renderRow(cells);

  if (found.lineIdx !== -1) {
    const out = lines.slice();
    out[found.lineIdx] = line;
    return out;
  }

  const t = found.tbl;
  const placeholders = t.rowIdxs.filter(li => isPlaceholder(splitRow(lines[li], cols.length) || []));
  const insertAt = t.rowIdxs.length ? t.rowIdxs[t.rowIdxs.length - 1] + 1 : t.sepIdx + 1;

  let out = lines.slice(0, insertAt).concat([line], lines.slice(insertAt));
  const shifted = new Set(placeholders.map(li => (li >= insertAt ? li + 1 : li)));
  if (shifted.size) out = out.filter((_, i) => !shifted.has(i));
  return out;
}

// ─── Queue ────────────────────────────────────────────────────────────────────

/**
 * Add or update one row in the Queue table.
 *
 * @param {string} cwd
 * @param {string} id - SPEC-ID
 * @param {Object} fields - {title, priority, status, complexity, dependsOn}
 * @param {boolean} raw
 */
async function cmdQueueAdd(cwd, id, fields, raw) {
  if (!id) error('Missing arguments. Usage: queue add <SPEC-ID> [--title T] [--priority P] [--status S]');

  const cfg = loadSizeConfig(cwd);
  for (const [k, v] of Object.entries(fields)) {
    if (v !== undefined && v !== null && v !== true) {
      checkCell(String(v), k, cfg, { hint: 'Queue cells are short labels, not descriptions.' });
    }
  }

  const statePath = path.join(cwd, '.specflow', 'STATE.md');

  const result = await withStateLock(async () => {
    const content = safeReadFile(statePath);
    if (!content) error('STATE.md not found at ' + statePath);

    const lines = content.split('\n');
    const found = locateRow(lines, 'Queue', ID_ALIASES, id);

    if (!found) error('STATE.md has no `## Queue` section. Run: sf-tools state normalize');
    if (found.keyIdx === -1) error('The `## Queue` table has no ID column. Run: sf-tools state normalize');

    const updated = upsertRow(lines, found, [
      [['title', 'name'], fields.title],
      [['priority', 'prio'], fields.priority],
      [['status', 'state'], fields.status],
      [['complexity', 'size'], fields.complexity],
      [['depends on', 'depends_on', 'deps'], fields.dependsOn],
    ], id, [
      // A `Created` column exists only in some schemas; stamp it only on insert.
      [['created', 'added'], today()],
    ]).join('\n');

    atomicWrite(statePath, updated);
    return { queued: true, id, created: found.lineIdx === -1, integrity: integrity(updated, cfg) };
  });

  output(result, raw, formatIntegrity(result));
}

/**
 * Remove one row from the Queue table.
 * @param {string} cwd
 * @param {string} id - SPEC-ID
 * @param {boolean} raw
 */
async function cmdQueueRemove(cwd, id, raw) {
  if (!id) error('Missing arguments. Usage: queue remove <SPEC-ID>');

  const cfg = loadSizeConfig(cwd);
  const statePath = path.join(cwd, '.specflow', 'STATE.md');

  const result = await withStateLock(async () => {
    const content = safeReadFile(statePath);
    if (!content) error('STATE.md not found at ' + statePath);

    const lines = content.split('\n');
    const found = locateRow(lines, 'Queue', ID_ALIASES, id);

    if (found && found.keyIdx !== -1 && found.lineIdx !== -1) {
      const updated = lines.filter((_, i) => i !== found.lineIdx).join('\n');
      atomicWrite(statePath, updated);
      return { removed: true, id, was_present: true, integrity: integrity(updated, cfg) };
    }

    return { removed: true, id, was_present: false, integrity: integrity(content, cfg) };
  });

  output(result, raw, formatIntegrity(result));
}

// ─── Execution Status ─────────────────────────────────────────────────────────

/**
 * Append an empty `## Execution Status` table if the file has none.
 * Appended at end of file (after any trailing footer), matching templates/state.md.
 * @param {string[]} lines
 * @returns {string[]}
 */
function ensureExecutionSection(lines) {
  if (findSection(lines, 'Execution Status')) return lines;

  const out = lines.slice();
  // Insert before a trailing `--- / *Last updated* / ` footer if one exists, else at end.
  let at = out.length;
  for (let i = out.length - 1; i >= 0 && i >= out.length - 4; i--) {
    if (out[i].trim() === '---' || /^\*.*\*$/.test(out[i].trim())) at = i;
  }

  const block = [
    '## Execution Status',
    '',
    '| Spec ID | Mode | Progress | Last Updated |',
    '|---------|------|----------|--------------|',
  ];

  while (at > 0 && out[at - 1].trim() === '') at--;
  return out.slice(0, at).concat(['', ...block, ''], out.slice(at));
}


/**
 * Set one Execution Status row (orchestrated runs stamp this once per wave).
 *
 * @param {string} cwd
 * @param {string} id - SPEC-ID
 * @param {Object} fields - {mode, progress}
 * @param {boolean} raw
 */
async function cmdSetExecution(cwd, id, fields, raw) {
  if (!id) error('Missing arguments. Usage: state set-execution <SPEC-ID> [--mode M] [--progress P]');

  const cfg = loadSizeConfig(cwd);
  for (const [k, v] of Object.entries(fields)) {
    if (v !== undefined && v !== null && v !== true) {
      checkCell(String(v), k, cfg, { hint: 'Progress is a short label like "Wave 2/5 (40%)".' });
    }
  }

  const statePath = path.join(cwd, '.specflow', 'STATE.md');

  const result = await withStateLock(async () => {
    let content = safeReadFile(statePath);
    if (!content) error('STATE.md not found at ' + statePath);

    let lines = content.split('\n');
    let found = locateRow(lines, 'Execution Status', ID_ALIASES, id);

    // The section is optional and older files predate it — create it on first use rather
    // than erroring, since orchestrators call this once per wave and cannot pre-seed it.
    if (!found || found.keyIdx === -1) {
      lines = ensureExecutionSection(lines);
      found = locateRow(lines, 'Execution Status', ID_ALIASES, id);
      if (!found || found.keyIdx === -1) {
        error('Could not create the `## Execution Status` table in STATE.md.');
      }
    }

    const updated = upsertRow(lines, found, [
      [['mode'], fields.mode],
      [['progress'], fields.progress],
      [['last updated', 'last_updated', 'updated'], new Date().toISOString()],
    ], id).join('\n');

    atomicWrite(statePath, updated);
    return { updated: true, id, integrity: integrity(updated, cfg) };
  });

  output(result, raw, formatIntegrity(result));
}

/**
 * Remove one Execution Status row (single-mode runs never create one).
 * @param {string} cwd
 * @param {string} id
 * @param {boolean} raw
 */
async function cmdClearExecution(cwd, id, raw) {
  if (!id) error('Missing arguments. Usage: state clear-execution <SPEC-ID>');

  const cfg = loadSizeConfig(cwd);
  const statePath = path.join(cwd, '.specflow', 'STATE.md');

  const result = await withStateLock(async () => {
    const content = safeReadFile(statePath);
    if (!content) error('STATE.md not found at ' + statePath);

    const lines = content.split('\n');
    const found = locateRow(lines, 'Execution Status', ID_ALIASES, id);

    if (found && found.keyIdx !== -1 && found.lineIdx !== -1) {
      const updated = lines.filter((_, i) => i !== found.lineIdx).join('\n');
      atomicWrite(statePath, updated);
      return { cleared: true, id, was_present: true, integrity: integrity(updated, cfg) };
    }

    return { cleared: true, id, was_present: false, integrity: integrity(content, cfg) };
  });

  output(result, raw, formatIntegrity(result));
}

module.exports = {
  cmdQueueAdd,
  cmdQueueRemove,
  cmdSetExecution,
  cmdClearExecution,
  locateRow,
  upsertRow,
};
