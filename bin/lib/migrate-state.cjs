/**
 * bin/lib/migrate-state.cjs — One-shot idempotent STATE.md schema migration
 *
 * Exports: migrateStateMd(content) → string
 *
 * Transforms legacy STATE.md formats to the new `## Active Specifications` table schema.
 *
 * Handles TWO known legacy formats:
 *
 *   Format A (real STATE.md — heading-style):
 *     ## Active Specification
 *
 *     SPEC-XXX
 *
 *     **Status:** running
 *     **Next Step:** /sf:review
 *
 *   Format B (templates/state.md — bullet-style):
 *     - **Active Specification:** [none | SPEC-XXX]
 *     - **Status:** ...
 *     - **Next Step:** ...
 *
 * Idempotent: if `## Active Specifications` (plural, table) already present,
 * returns content unchanged.
 *
 * The caller is responsible for writing the result back to disk (under withStateLock).
 * Invoked from:
 *   - `node bin/sf-tools.cjs state migrate`  (explicit)
 *   - `/sf:health` on entry (implicit)
 *   - `node bin/sf-tools.cjs state list-active` (lazy safety net on first read)
 */

'use strict';

/**
 * Build the new Active Specifications table section, optionally seeded with
 * one row if we detected a non-"none" spec ID.
 *
 * @param {string|null} specId - Detected legacy spec ID, or null/empty/"none"
 * @param {string|null} status - Legacy status value
 * @param {string|null} nextStep - Legacy next step value
 * @returns {string} New section text (no trailing newline)
 */
function buildNewSection(specId, status, nextStep) {
  const hasSpec = specId && specId.toLowerCase() !== 'none' && specId !== '—' && specId !== '-';

  let table =
    '## Active Specifications\n' +
    '\n' +
    '| SPEC-ID | Status | Next Step |\n' +
    '|---------|--------|-----------|';

  if (hasSpec) {
    const rowStatus = status || 'running';
    const rowNext = nextStep || '/sf:review';
    table += '\n| ' + specId + ' | ' + rowStatus + ' | ' + rowNext + ' |';
  }

  return table;
}

/**
 * Migrate a STATE.md from legacy format to the new Active Specifications table.
 *
 * Pure function — does NOT read or write files.
 *
 * @param {string} content - Current STATE.md file content
 * @returns {string} Migrated content (unchanged if already new format)
 */
function migrateStateMd(content) {
  if (!content || typeof content !== 'string') {
    return content || '';
  }

  // Idempotency check: if new schema already present, return unchanged
  if (content.includes('## Active Specifications')) {
    return content;
  }

  const lines = content.split('\n');

  // ─── Format A detection: "## Active Specification" heading-style ──────────
  // Pattern:
  //   ## Active Specification
  //   <blank>
  //   SPEC-XXX           (or "—" / empty)
  //   <blank>
  //   **Status:** ...
  //   **Next Step:** ...

  const formatAIdx = lines.findIndex(l => l.trim() === '## Active Specification');

  if (formatAIdx !== -1) {
    return migrateFormatA(lines, formatAIdx);
  }

  // ─── Format B detection: bullet-style "## Current Position" or inline bullets ─
  // Pattern:
  //   - **Active Specification:** [none | SPEC-XXX]
  //   - **Status:** ...
  //   - **Next Step:** ...

  const bulletIdx = lines.findIndex(l => /^\s*-\s+\*\*Active Specification:\*\*/.test(l));

  if (bulletIdx !== -1) {
    return migrateFormatB(lines, bulletIdx);
  }

  // Unknown format — return unchanged (safe fallback)
  return content;
}

/**
 * Migrate Format A (heading-style) STATE.md.
 *
 * @param {string[]} lines
 * @param {number} headingIdx - Line index of "## Active Specification"
 * @returns {string}
 */
function migrateFormatA(lines, headingIdx) {
  let specId = null;
  let status = null;
  let nextStep = null;

  // Scan forward from heading to collect values (stop at next ## or end)
  let sectionEnd = lines.length;
  for (let i = headingIdx + 1; i < lines.length; i++) {
    const trimmed = lines[i].trim();

    if (trimmed.startsWith('## ') && i !== headingIdx) {
      sectionEnd = i;
      break;
    }

    // Spec ID line: non-empty, not a bold field, not a comment
    if (trimmed && !trimmed.startsWith('**') && !trimmed.startsWith('#') && !trimmed.startsWith('<!--')) {
      if (!specId) specId = trimmed;
    }

    // Bold field: **Status:** value
    const statusMatch = trimmed.match(/^\*\*Status:\*\*\s*(.+)$/);
    if (statusMatch) status = statusMatch[1].trim();

    const nextMatch = trimmed.match(/^\*\*Next Step:\*\*\s*(.+)$/);
    if (nextMatch) nextStep = nextMatch[1].trim();
  }

  const newSection = buildNewSection(specId, status, nextStep);

  // Replace lines from headingIdx to sectionEnd-1 with new section
  const before = lines.slice(0, headingIdx);
  const after = lines.slice(sectionEnd);

  // Preserve a blank line before the next section if it exists
  const combined = [...before, ...newSection.split('\n'), '', ...after];

  return combined.join('\n');
}

/**
 * Migrate Format B (bullet-style) STATE.md.
 *
 * @param {string[]} lines
 * @param {number} bulletIdx - Line index of the "- **Active Specification:**" bullet
 * @returns {string}
 */
function migrateFormatB(lines, bulletIdx) {
  let specId = null;
  let status = null;
  let nextStep = null;

  // Extract spec ID from the same line: - **Active Specification:** SPEC-XXX
  const activeLine = lines[bulletIdx];
  const activeMatch = activeLine.match(/\*\*Active Specification:\*\*\s*(.+)$/);
  if (activeMatch) specId = activeMatch[1].trim().replace(/^\[|\]$/g, ''); // strip [...] if present

  // Look ahead for Status and Next Step bullets (within the same section)
  // Also locate all three bullet lines so we can remove them
  const bulletLines = [bulletIdx];

  for (let i = bulletIdx + 1; i < Math.min(bulletIdx + 6, lines.length); i++) {
    const trimmed = lines[i].trim();

    if (trimmed.startsWith('## ')) break; // next section

    const statusMatch = trimmed.match(/^-\s+\*\*Status:\*\*\s*(.+)$/);
    if (statusMatch) {
      status = statusMatch[1].trim().replace(/^\[|\]$/g, '');
      bulletLines.push(i);
    }

    const nextMatch = trimmed.match(/^-\s+\*\*Next Step:\*\*\s*(.+)$/);
    if (nextMatch) {
      nextStep = nextMatch[1].trim().replace(/^\[|\]$/g, '');
      bulletLines.push(i);
    }
  }

  const newSection = buildNewSection(specId, status, nextStep);

  // Check if there's a parent heading like "## Current Position" immediately before
  // the bullet lines that we should also replace/remove
  let sectionStart = bulletIdx;
  let headingToRemove = null;

  for (let i = bulletIdx - 1; i >= 0 && i >= bulletIdx - 3; i--) {
    const trimmed = lines[i].trim();
    if (trimmed === '## Current Position') {
      headingToRemove = i;
      sectionStart = i;
      break;
    }
  }

  // Remove: [parent heading if any] + blank lines + bullet lines
  const linesToRemove = new Set(bulletLines);
  if (headingToRemove !== null) linesToRemove.add(headingToRemove);

  // Also remove blank lines immediately surrounding the heading
  if (headingToRemove !== null) {
    if (headingToRemove > 0 && lines[headingToRemove - 1].trim() === '') {
      linesToRemove.add(headingToRemove - 1);
    }
    if (headingToRemove + 1 < lines.length && lines[headingToRemove + 1].trim() === '') {
      linesToRemove.add(headingToRemove + 1);
    }
  }

  // Insert new section at sectionStart position
  const before = lines.slice(0, sectionStart).filter((_, idx) => !linesToRemove.has(idx));
  const removedBefore = lines.slice(0, sectionStart);
  const keptBefore = removedBefore.filter((_, idx) => !linesToRemove.has(idx));

  const maxBullet = Math.max(...bulletLines);
  const after = lines.slice(maxBullet + 1);

  const combined = [...keptBefore, ...newSection.split('\n'), '', ...after];

  return combined.join('\n');
}

module.exports = { migrateStateMd };
