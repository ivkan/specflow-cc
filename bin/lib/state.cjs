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
 * Expects pipe-delimited markdown table with columns:
 * Priority | ID | Title | Status | Complexity | Depends On
 * @param {string} content - STATE.md content
 * @returns {Array<Object>}
 */
function parseQueueTable(content) {
  const lines = content.split('\n');
  const queue = [];
  let inQueue = false;
  let headerFound = false;
  let separatorFound = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed === '## Queue') {
      inQueue = true;
      continue;
    }

    if (inQueue && trimmed.startsWith('##') && trimmed !== '## Queue') {
      break;
    }

    if (!inQueue) continue;

    if (trimmed.startsWith('|') && !headerFound) {
      if (trimmed.toLowerCase().includes('priority') && trimmed.toLowerCase().includes('id')) {
        headerFound = true;
        continue;
      }
    }

    if (headerFound && !separatorFound && trimmed.startsWith('|') && trimmed.includes('---')) {
      separatorFound = true;
      continue;
    }

    if (headerFound && separatorFound && trimmed.startsWith('|')) {
      const cells = trimmed.split('|').map(c => c.trim()).filter(c => c !== '');
      if (cells.length >= 4) {
        queue.push({
          priority: cells[0] || '',
          id: cells[1] || '',
          title: cells[2] || '',
          status: cells[3] || '',
          complexity: cells[4] || '',
          depends_on: cells[5] || '',
        });
      }
    }
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
 * Add or update one spec row in the Active Specifications table.
 * All writes execute under withStateLock.
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

  const statePath = path.join(cwd, '.specflow', 'STATE.md');

  const result = await withStateLock(async () => {
    let content = safeReadFile(statePath);
    if (!content) error('STATE.md not found at ' + statePath);

    // Lazy migration if needed
    if (!content.includes('## Active Specifications')) {
      content = migrateStateMd(content);
    }

    const rows = parseActiveSpecsTable(content);

    // Update existing row or append new row
    const existingIdx = rows.findIndex(r => r.id === id);
    const newRow = { id, status, nextStep: nextStep || '' };

    if (existingIdx !== -1) {
      rows[existingIdx] = newRow;
    } else {
      rows.push(newRow);
    }

    const updated = rewriteActiveSpecsTable(content, rows);
    atomicWrite(statePath, updated);

    return { updated: true, id, status, next_step: nextStep || '' };
  });

  output(result, raw, 'updated');
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

  const result = await withStateLock(async () => {
    let content = safeReadFile(statePath);
    if (!content) error('STATE.md not found at ' + statePath);

    if (!content.includes('## Active Specifications')) {
      content = migrateStateMd(content);
    }

    const rows = parseActiveSpecsTable(content);
    const filtered = rows.filter(r => r.id !== id);

    const updated = rewriteActiveSpecsTable(content, filtered);
    atomicWrite(statePath, updated);

    return { removed: true, id, was_present: rows.length !== filtered.length };
  });

  output(result, raw, 'removed');
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
  cmdStateRemoveActive,
  cmdStateResolve,
  cmdStateMigrate,
  cmdQueueNext,
  extractActiveSpec,
};
