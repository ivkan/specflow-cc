/**
 * bin/lib/state.cjs — STATE.md CRUD operations
 *
 * Exports: cmdStateGet(), cmdStateSetActive(), cmdQueueNext()
 */

'use strict';

const path = require('path');
const { output, error, safeReadFile, atomicWrite } = require('./core.cjs');

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
 * Extract the active spec ID from STATE.md.
 * The spec ID is on the line immediately after "## Active Specification".
 * @param {string} content - STATE.md content
 * @returns {string|null}
 */
function extractActiveSpec(content) {
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === '## Active Specification') {
      // Next non-empty line has the spec ID
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
      break; // next section
    }

    if (!inQueue) continue;

    if (trimmed.startsWith('|') && !headerFound) {
      // Check if this is the header row
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
 * Get current active spec, status, and next step from STATE.md.
 * @param {string} cwd - Working directory
 * @param {boolean} raw - Output raw string
 */
function cmdStateGet(cwd, raw) {
  const statePath = path.join(cwd, '.specflow', 'STATE.md');
  const content = safeReadFile(statePath);

  if (!content) {
    error('STATE.md not found at ' + statePath);
  }

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
 * Update active spec, status, and optionally next step in STATE.md.
 * @param {string} cwd - Working directory
 * @param {string} id - Spec ID (e.g., "SPEC-007")
 * @param {string} status - New status
 * @param {string} [nextStep] - Optional new next step
 * @param {boolean} raw - Output raw string
 */
function cmdStateSetActive(cwd, id, status, nextStep, raw) {
  const statePath = path.join(cwd, '.specflow', 'STATE.md');
  const content = safeReadFile(statePath);

  if (!content) {
    error('STATE.md not found at ' + statePath);
  }

  const lines = content.split('\n');
  const result = [];
  let inActiveSection = false;
  let specIdReplaced = false;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();

    if (trimmed === '## Active Specification') {
      inActiveSection = true;
      result.push(lines[i]);
      continue;
    }

    if (inActiveSection && trimmed.startsWith('## ') && trimmed !== '## Active Specification') {
      inActiveSection = false;
    }

    if (inActiveSection && !specIdReplaced && trimmed && !trimmed.startsWith('**') && !trimmed.startsWith('#')) {
      // This is the spec ID line — replace it
      result.push(id);
      specIdReplaced = true;
      continue;
    }

    if (inActiveSection && trimmed.startsWith('**Status:**')) {
      result.push('**Status:** ' + status);
      continue;
    }

    if (inActiveSection && trimmed.startsWith('**Next Step:**')) {
      if (nextStep !== undefined && nextStep !== null) {
        result.push('**Next Step:** ' + nextStep);
      } else {
        result.push(lines[i]); // preserve existing
      }
      continue;
    }

    result.push(lines[i]);
  }

  atomicWrite(statePath, result.join('\n'));

  const resultObj = {
    updated: true,
    active_spec: id,
    status: status,
    next_step: nextStep || extractBoldField(result.join('\n'), 'Next Step'),
  };

  output(resultObj, raw, 'updated');
}

/**
 * Get the first actionable spec from the queue.
 * "Actionable" = status is not "done" or "complete".
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
  cmdQueueNext,
  extractActiveSpec,
};
