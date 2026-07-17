/**
 * bin/lib/state.cjs — STATE.md CRUD operations
 *
 * Exports:
 *   cmdStateGet()          — legacy shim (returns single active spec)
 *   cmdStateSetActive()    — legacy shim (delegates to cmdStateAddActive)
 *   cmdStateListActive()   — list all active specs; lazy migration on first call
 *   cmdStateAddActive()    — append/update one row under withStateLock
 *   cmdStateRemoveActive() — remove one row under withStateLock
 *   cmdStateResolve()      — invoke resolveActiveSpec, emit JSON contract
 *   cmdStateMigrate()      — explicit one-shot migration
 *   cmdQueueNext()         — first actionable spec from queue
 *   extractActiveSpec()    — legacy helper (exported for backwards compat)
 *
 * ALL writes to STATE.md go through withStateLock per SPEC-011 AC 14.
 * Read paths remain lock-free (reads are safe to do concurrently).
 */

'use strict';

const path = require('path');
const { output, error, safeReadFile, atomicWrite } = require('./core.cjs');
const { withStateLock } = require('./lock.cjs');
const { resolveActiveSpec, parseActiveSpecsTable } = require('./resolve.cjs');
const { migrateStateMd } = require('./migrate-state.cjs');
const {
  findSection, findTable, splitRow, renderRow, unescapeCell,
} = require('./state-table.cjs');
const { loadSizeConfig, checkCell, integrity } = require('./state-size.cjs');
const { colIndex, formatIntegrity } = require('./state-decisions.cjs');

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Extract a bold-field value from STATE.md content.
 * Matches patterns like: **Field:** value
 * @param {string} content - STATE.md content
 * @param {string} field - Field name (e.g., "Status")
 * @returns {string|null}
 */
function extractBoldField(content, field) {
  const regex = new RegExp(`\\*\\*${field}:\\*\\*\\s*(.+)`, 'i');
  const match = content.match(regex);
  return match ? match[1].trim() : null;
}

/**
 * Extract the active spec ID from STATE.md (legacy single-spec format).
 * The spec ID is on the line immediately after "## Active Specification".
 * @param {string} content - STATE.md content
 * @returns {string|null}
 */
function extractActiveSpec(content) {
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === '## Active Specification') {
      for (let j = i + 1; j < lines.length; j++) {
        const line = lines[j].trim();
        if (line && !line.startsWith('**') && !line.startsWith('#')) {
          return line;
        }
      }
    }
  }
  return null;
}

/**
 * Parse the queue table from STATE.md.
 *
 * Columns are resolved BY NAME from the header row on disk, never by position. Three
 * incompatible queue schemas exist in the wild — `templates/state.md` ships
 * `| # | ID | Title | Priority | Status |`, this repo's tests use
 * `| Priority | ID | Title | Status | Complexity | Depends On |`, and a field project had
 * drifted to `| ID | Title | Priority | Created |`. The previous positional parser
 * accepted any header containing "id" and "priority", then read cells[0] as priority and
 * cells[1] as id — so on the field file every field came back shifted by one column, and
 * `queue next` silently returned a title where the caller expected a SPEC-ID.
 *
 * Missing columns yield '' rather than borrowing the neighbouring cell's value.
 *
 * @param {string} content - STATE.md content
 * @returns {Array<Object>}
 */
function parseQueueTable(content) {
  const lines = content.split('\n');
  const sec = findSection(lines, 'Queue');
  if (!sec) return [];

  const tbl = findTable(lines, sec.start, sec.end);
  if (!tbl) return [];

  const at = (aliases) => colIndex(tbl.columns, aliases);
  const idx = {
    priority: at(['priority', 'prio', 'p']),
    id: at(['id', 'spec-id', 'spec id', 'spec']),
    title: at(['title', 'name']),
    status: at(['status', 'state']),
    complexity: at(['complexity', 'size']),
    depends_on: at(['depends on', 'depends_on', 'deps']),
  };

  const queue = [];

  for (const li of tbl.rowIdxs) {
    const cells = splitRow(lines[li], tbl.columns.length);
    if (!cells) continue;

    const get = (k) => (idx[k] === -1 ? '' : unescapeCell(cells[idx[k]] || ''));
    const row = {
      priority: get('priority'),
      id: get('id'),
      title: get('title'),
      status: get('status'),
      complexity: get('complexity'),
      depends_on: get('depends_on'),
    };

    // Skip placeholder rows (`| — | — | … |`) and rows with no identity.
    const meaningful = Object.values(row).some(v => v && v !== '—' && v !== '-');
    if (!meaningful) continue;
    if (!row.id || row.id === '—' || row.id === '-') continue;

    queue.push(row);
  }

  return queue;
}

/**
 * Build the new Active Specifications table section from rows.
 * @param {Array<{id,status,nextStep}>} rows
 * @returns {string} Table markdown (no trailing newline)
 */
function buildActiveSpecsTable(rows) {
  let table =
    '## Active Specifications\n\n' +
    '| SPEC-ID | Status | Next Step |\n' +
    '|---------|--------|-----------|';

  for (const row of rows) {
    table += '\n| ' + row.id + ' | ' + row.status + ' | ' + row.nextStep + ' |';
  }

  return table;
}

/**
 * Rewrite the Active Specifications table in STATE.md content with new rows.
 * If table section does not exist, appends it before ## Queue.
 * Returns updated content string.
 *
 * @param {string} content - STATE.md content
 * @param {Array<{id,status,nextStep}>} rows - New rows for the table
 * @returns {string}
 */
function rewriteActiveSpecsTable(content, rows) {
  const newTableSection = buildActiveSpecsTable(rows);

  // Find existing ## Active Specifications section
  const lines = content.split('\n');
  let sectionStart = -1;
  let sectionEnd = lines.length;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === '## Active Specifications') {
      sectionStart = i;
      continue;
    }
    if (sectionStart !== -1 && lines[i].trim().startsWith('## ') && i > sectionStart) {
      sectionEnd = i;
      break;
    }
  }

  if (sectionStart !== -1) {
    // Replace existing section
    const before = lines.slice(0, sectionStart);
    const after = lines.slice(sectionEnd);
    // Trim trailing blank lines from before
    while (before.length > 0 && before[before.length - 1].trim() === '') before.pop();
    // Trim leading blank lines from after
    while (after.length > 0 && after[0].trim() === '') after.shift();
    return [...before, ...newTableSection.split('\n'), '', ...after].join('\n');
  }

  // No existing section — insert before ## Queue
  const queueIdx = lines.findIndex(l => l.trim() === '## Queue');
  if (queueIdx !== -1) {
    const before = lines.slice(0, queueIdx);
    // Trim trailing blank lines from before
    while (before.length > 0 && before[before.length - 1].trim() === '') before.pop();
    const after = lines.slice(queueIdx);
    return [...before, ...newTableSection.split('\n'), '', ...after].join('\n');
  }

  // Fallback: append to end
  return content.trimEnd() + '\n\n' + newTableSection + '\n';
}

// ─── Public commands ──────────────────────────────────────────────────────────

/**
 * List all active specifications from STATE.md.
 * Runs lazy migration if legacy format detected.
 * @param {string} cwd - Working directory
 * @param {boolean} raw - Output raw string
 */
function cmdStateListActive(cwd, raw) {
  const statePath = path.join(cwd, '.specflow', 'STATE.md');
  let content = safeReadFile(statePath);

  if (!content) {
    error('STATE.md not found at ' + statePath);
  }

  // Lazy migration safety net
  if (!content.includes('## Active Specifications')) {
    const migrated = migrateStateMd(content);
    if (migrated !== content) {
      // Write migrated content under lock
      withStateLock(() => {
        // Re-read after acquiring lock (another process may have migrated already)
        const fresh = safeReadFile(statePath) || content;
        if (!fresh.includes('## Active Specifications')) {
          atomicWrite(statePath, migrated);
        }
      }).catch(() => {}); // non-fatal if lock fails
      content = migrated;
    }
  }

  const rows = parseActiveSpecsTable(content);
  output({ active_specs: rows }, raw, rows.map(r => r.id).join('\n'));
}

/**
 * Locate one spec's row in the Active Specifications table.
 * @returns {{lineIdx, cells, columns, table, lines}|null}
 */
function locateActiveRow(lines, id) {
  const sec = findSection(lines, 'Active Specifications');
  if (!sec) return null;

  const tbl = findTable(lines, sec.start, sec.end);
  if (!tbl) return null;

  const idIdx = colIndex(tbl.columns, ['spec-id', 'spec id', 'id']);
  if (idIdx === -1) return { table: tbl, lineIdx: -1, idIdx: -1 };

  for (const li of tbl.rowIdxs) {
    const cells = splitRow(lines[li], tbl.columns.length);
    if (!cells) continue;
    if (unescapeCell(cells[idIdx]) === id) {
      return { table: tbl, lineIdx: li, cells, idIdx };
    }
  }

  return { table: tbl, lineIdx: -1, idIdx };
}

/**
 * Add or update one spec row in the Active Specifications table.
 * All writes execute under withStateLock.
 *
 * The row is edited as a single LINE — the section is never re-rendered. That keeps every
 * untouched byte (HTML comments, spacing, sibling rows) exactly as it was, and it keeps
 * the on-disk column layout intact when it has drifted from templates/state.md.
 *
 * `next_step` is capped: this command already existed as a CLI call, yet a caller still
 * managed to write an 80 KB audit narrative into this cell and push STATE.md past every
 * agent's Read cap. Routing writes through Node was necessary but not sufficient — the
 * cell itself needs a bound.
 *
 * @param {string} cwd - Working directory
 * @param {string} id - SPEC-ID
 * @param {string} status - Status value
 * @param {string} nextStep - Next step value
 * @param {boolean} raw - Output raw string
 */
async function cmdStateAddActive(cwd, id, status, nextStep, raw) {
  if (!id || !status) {
    error('Missing arguments. Usage: state add-active <id> <status> <next_step>');
  }

  const cfg = loadSizeConfig(cwd);
  checkCell(nextStep || '', 'next_step', cfg, {
    hint: 'Next Step is a POINTER to the next command (e.g. "/sf:audit"). Keep audit ' +
          'narratives in the spec\'s Audit History and record verdicts with ' +
          '`state add-decision`.',
  });

  const statePath = path.join(cwd, '.specflow', 'STATE.md');

  const result = await withStateLock(async () => {
    let content = safeReadFile(statePath);
    if (!content) error('STATE.md not found at ' + statePath);

    // Lazy migration if needed
    if (!content.includes('## Active Specifications')) {
      content = migrateStateMd(content);
    }

    let lines = content.split('\n');
    const found = locateActiveRow(lines, id);

    if (!found || found.idIdx === -1) {
      // No usable table on disk — fall back to rendering the canonical section.
      const rows = parseActiveSpecsTable(content);
      const i = rows.findIndex(r => r.id === id);
      const row = { id, status, nextStep: nextStep || '' };
      if (i !== -1) rows[i] = row; else rows.push(row);
      const updated = rewriteActiveSpecsTable(content, rows);
      atomicWrite(statePath, updated);
      return { updated: true, id, status, next_step: nextStep || '', integrity: integrity(updated, cfg) };
    }

    const cols = found.table.columns;
    const statusIdx = colIndex(cols, ['status', 'state']);
    const nextIdx = colIndex(cols, ['next step', 'next_step', 'next']);

    let cells;
    if (found.lineIdx !== -1) {
      cells = found.cells.map(unescapeCell);
    } else {
      cells = cols.map(() => '');
      cells[found.idIdx] = id;
    }

    if (statusIdx !== -1) cells[statusIdx] = status;
    if (nextIdx !== -1 && nextStep !== undefined && nextStep !== null) cells[nextIdx] = nextStep;

    const line = renderRow(cells);

    if (found.lineIdx !== -1) {
      lines[found.lineIdx] = line;
    } else {
      const t = found.table;
      // Drop a `| — | — | — |` placeholder instead of appending beside it.
      const placeholders = t.rowIdxs.filter(li => {
        const c = splitRow(lines[li], cols.length) || [];
        return c.every(x => !x || x === '—' || x === '-');
      });
      const insertAt = t.rowIdxs.length ? t.rowIdxs[t.rowIdxs.length - 1] + 1 : t.sepIdx + 1;
      lines = lines.slice(0, insertAt).concat([line], lines.slice(insertAt));
      const shifted = new Set(placeholders.map(li => (li >= insertAt ? li + 1 : li)));
      if (shifted.size) lines = lines.filter((_, i) => !shifted.has(i));
    }

    const updated = lines.join('\n');
    atomicWrite(statePath, updated);

    return {
      updated: true,
      id,
      status,
      next_step: nextStep || '',
      integrity: integrity(updated, cfg),
    };
  });

  output(result, raw, formatIntegrity(result));
}

/**
 * Update only the Status (and optionally Next Step) cells of one active row.
 * Narrower than add-active: it refuses to create a row that does not exist, so a typo'd
 * SPEC-ID surfaces as an error instead of silently registering a phantom active spec.
 *
 * @param {string} cwd
 * @param {string} id - SPEC-ID
 * @param {string} status - New status
 * @param {string|undefined} nextStep - New next step, or undefined to leave as-is
 * @param {boolean} raw
 */
async function cmdStateSetStatus(cwd, id, status, nextStep, raw) {
  if (!id || !status) {
    error('Missing arguments. Usage: state set-status <SPEC-ID> <status> [--next <step>]');
  }

  const cfg = loadSizeConfig(cwd);
  if (nextStep !== undefined && nextStep !== null) {
    checkCell(nextStep, 'next_step', cfg, {
      hint: 'Next Step is a POINTER to the next command. Record verdicts with `state add-decision`.',
    });
  }

  const statePath = path.join(cwd, '.specflow', 'STATE.md');

  const result = await withStateLock(async () => {
    const content = safeReadFile(statePath);
    if (!content) error('STATE.md not found at ' + statePath);

    const lines = content.split('\n');
    const found = locateActiveRow(lines, id);

    if (!found || found.idIdx === -1 || found.lineIdx === -1) {
      error(`${id} is not in the Active Specifications table. ` +
            `Use \`state add-active ${id} <status> <next_step>\` to add it.`);
    }

    const cols = found.table.columns;
    const statusIdx = colIndex(cols, ['status', 'state']);
    const nextIdx = colIndex(cols, ['next step', 'next_step', 'next']);
    const cells = found.cells.map(unescapeCell);

    if (statusIdx !== -1) cells[statusIdx] = status;
    if (nextIdx !== -1 && nextStep !== undefined && nextStep !== null) cells[nextIdx] = nextStep;

    lines[found.lineIdx] = renderRow(cells);
    const updated = lines.join('\n');
    atomicWrite(statePath, updated);

    return {
      updated: true,
      id,
      status,
      next_step: nextIdx === -1 ? '' : cells[nextIdx],
      integrity: integrity(updated, cfg),
    };
  });

  output(result, raw, formatIntegrity(result));
}

/**
 * Remove one spec row from the Active Specifications table.
 * All writes execute under withStateLock.
 *
 * @param {string} cwd - Working directory
 * @param {string} id - SPEC-ID to remove
 * @param {boolean} raw - Output raw string
 */
async function cmdStateRemoveActive(cwd, id, raw) {
  if (!id) {
    error('Missing arguments. Usage: state remove-active <id>');
  }

  const statePath = path.join(cwd, '.specflow', 'STATE.md');

  const cfg = loadSizeConfig(cwd);

  const result = await withStateLock(async () => {
    let content = safeReadFile(statePath);
    if (!content) error('STATE.md not found at ' + statePath);

    if (!content.includes('## Active Specifications')) {
      content = migrateStateMd(content);
    }

    const lines = content.split('\n');
    const found = locateActiveRow(lines, id);

    // Surgical delete: drop exactly one line, leave every other byte alone.
    if (found && found.idIdx !== -1 && found.lineIdx !== -1) {
      const kept = lines.filter((_, i) => i !== found.lineIdx);
      const updated = kept.join('\n');
      atomicWrite(statePath, updated);
      return { removed: true, id, was_present: true, integrity: integrity(updated, cfg) };
    }

    // Row absent — no write, so the file cannot be disturbed by a no-op.
    return { removed: true, id, was_present: false, integrity: integrity(content, cfg) };
  });

  output(result, raw, formatIntegrity(result));
}

/**
 * Resolve the active spec to act on using the resolver contract.
 * Emits one of the four JSON shapes defined in SPEC-011.
 *
 * @param {string} cwd - Working directory
 * @param {string|undefined} specId - Optional SPEC-ID argument
 * @param {boolean} raw - Output raw string
 */
function cmdStateResolve(cwd, specId, raw) {
  const statePath = path.join(cwd, '.specflow', 'STATE.md');
  const content = safeReadFile(statePath);

  if (!content) {
    output({ action: 'error', code: 'NO_ACTIVE_SPEC' }, raw, '');
    return;
  }

  // Run lazy migration if needed (read-only path, no write needed for resolve)
  let effectiveContent = content;
  if (!content.includes('## Active Specifications')) {
    effectiveContent = migrateStateMd(content);
  }

  const resolution = resolveActiveSpec(specId, effectiveContent, cwd);

  if (raw) {
    output(resolution, false, JSON.stringify(resolution));
  } else {
    output(resolution, false);
  }
}

/**
 * Explicit one-shot migration command.
 * Migrates STATE.md from legacy format to new Active Specifications table.
 * Second invocation is a no-op (idempotent).
 *
 * @param {string} cwd - Working directory
 * @param {boolean} raw - Output raw string
 */
async function cmdStateMigrate(cwd, raw) {
  const statePath = path.join(cwd, '.specflow', 'STATE.md');

  const result = await withStateLock(async () => {
    const content = safeReadFile(statePath);
    if (!content) error('STATE.md not found at ' + statePath);

    const migrated = migrateStateMd(content);
    const changed = migrated !== content;

    if (changed) {
      atomicWrite(statePath, migrated);
    }

    return { migrated: changed, message: changed ? 'Migration complete' : 'Already migrated (no-op)' };
  });

  output(result, raw, result.message);
}

// ─── Legacy commands (preserved for backwards compatibility) ──────────────────

/**
 * Get current active spec, status, and next step from STATE.md.
 * Legacy shim: returns single active spec (or last-touched when N>1).
 * @param {string} cwd - Working directory
 * @param {boolean} raw - Output raw string
 */
function cmdStateGet(cwd, raw) {
  const statePath = path.join(cwd, '.specflow', 'STATE.md');
  const content = safeReadFile(statePath);

  if (!content) {
    error('STATE.md not found at ' + statePath);
  }

  // New schema: read from Active Specifications table
  if (content.includes('## Active Specifications')) {
    const rows = parseActiveSpecsTable(content);
    if (rows.length > 0) {
      // "last touched" = most recently appended = last row
      const last = rows[rows.length - 1];
      const result = {
        active_spec: last.id,
        status: last.status,
        next_step: last.nextStep,
      };
      output(result, raw, result.active_spec);
      return;
    }
    output({ active_spec: null, status: null, next_step: null }, raw, '');
    return;
  }

  // Legacy schema fallback
  const activeSpec = extractActiveSpec(content);
  const status = extractBoldField(content, 'Status');
  const nextStep = extractBoldField(content, 'Next Step');

  const result = {
    active_spec: activeSpec || null,
    status: status || null,
    next_step: nextStep || null,
  };

  output(result, raw, result.active_spec);
}

/**
 * Legacy shim: update active spec, status, and optionally next step.
 * Delegates to cmdStateAddActive for new schema; falls back to inline for legacy.
 * @param {string} cwd - Working directory
 * @param {string} id - Spec ID
 * @param {string} status - New status
 * @param {string} [nextStep] - Optional new next step
 * @param {boolean} raw - Output raw string
 */
async function cmdStateSetActive(cwd, id, status, nextStep, raw) {
  const statePath = path.join(cwd, '.specflow', 'STATE.md');
  const content = safeReadFile(statePath);

  if (!content) {
    error('STATE.md not found at ' + statePath);
  }

  // If new schema: delegate to add-active
  if (content.includes('## Active Specifications')) {
    return cmdStateAddActive(cwd, id, status, nextStep, raw);
  }

  // Legacy schema path: update in-place under lock
  const result = await withStateLock(async () => {
    const freshContent = safeReadFile(statePath) || content;
    const lines = freshContent.split('\n');
    const resultLines = [];
    let inActiveSection = false;
    let specIdReplaced = false;

    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();

      if (trimmed === '## Active Specification') {
        inActiveSection = true;
        resultLines.push(lines[i]);
        continue;
      }

      if (inActiveSection && trimmed.startsWith('## ') && trimmed !== '## Active Specification') {
        inActiveSection = false;
      }

      if (inActiveSection && !specIdReplaced && trimmed && !trimmed.startsWith('**') && !trimmed.startsWith('#')) {
        resultLines.push(id);
        specIdReplaced = true;
        continue;
      }

      if (inActiveSection && trimmed.startsWith('**Status:**')) {
        resultLines.push('**Status:** ' + status);
        continue;
      }

      if (inActiveSection && trimmed.startsWith('**Next Step:**')) {
        if (nextStep !== undefined && nextStep !== null) {
          resultLines.push('**Next Step:** ' + nextStep);
        } else {
          resultLines.push(lines[i]);
        }
        continue;
      }

      resultLines.push(lines[i]);
    }

    atomicWrite(statePath, resultLines.join('\n'));

    return {
      updated: true,
      active_spec: id,
      status: status,
      next_step: nextStep || extractBoldField(resultLines.join('\n'), 'Next Step'),
    };
  });

  output(result, raw, 'updated');
}

/**
 * Get the first actionable spec from the queue.
 * @param {string} cwd - Working directory
 * @param {boolean} raw - Output raw string
 */
function cmdQueueNext(cwd, raw) {
  const statePath = path.join(cwd, '.specflow', 'STATE.md');
  const content = safeReadFile(statePath);

  if (!content) {
    error('STATE.md not found at ' + statePath);
  }

  const queue = parseQueueTable(content);

  const next = queue.find(entry => {
    const s = entry.status.toLowerCase();
    return s !== 'done' && s !== 'complete';
  });

  if (next) {
    output({
      id: next.id,
      title: next.title,
      status: next.status,
      priority: next.priority,
    }, raw, next.id);
  } else {
    output({ id: null }, raw, '');
  }
}

module.exports = {
  cmdStateGet,
  cmdStateSetActive,
  cmdStateListActive,
  cmdStateAddActive,
  cmdStateSetStatus,
  cmdStateRemoveActive,
  cmdStateResolve,
  cmdStateMigrate,
  cmdQueueNext,
  extractActiveSpec,
  parseQueueTable,
  locateActiveRow,
};
