/**
 * bin/lib/resolve.cjs — Active spec resolver helper
 *
 * Exports: resolveActiveSpec(specId?, stateMdContent)
 *
 * Reads the `## Active Specifications` table from STATE.md and resolves
 * which spec the caller intends to act on.
 *
 * Resolution logic:
 *   - specId provided AND in table → {action:'use', id:specId}
 *   - specId provided AND NOT in table → {action:'error', code:'SPEC_NOT_ACTIVE', id:specId}
 *   - specId omitted AND table empty → {action:'error', code:'NO_ACTIVE_SPEC'}
 *   - specId omitted AND exactly 1 row → {action:'use', id:rowId}
 *   - specId omitted AND >1 rows → {action:'ask', options:[{id, title, status}, ...]}
 *
 * The `options[].title` field is loaded from the spec's frontmatter H1 or `title:`
 * field at resolution time. If the spec file cannot be read, SPEC-ID is used as
 * the fallback title (per Constraint: tolerate missing spec files gracefully).
 * At most N spec files are read (N = number of active rows; no directory scan).
 *
 * CLI usage (preferred — command files must use this, not require() directly):
 *   node bin/sf-tools.cjs state resolve [SPEC-ID]
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { findSection, findTable, splitRow, unescapeCell } = require('./state-table.cjs');

/**
 * Parse the `## Active Specifications` table from STATE.md content.
 * Returns an array of {id, status, nextStep} objects.
 * Returns empty array if section or table is missing.
 *
 * Columns are resolved by header name, not position, so a table that has drifted from
 * templates/state.md still parses correctly instead of silently mis-mapping fields.
 *
 * @param {string} content - STATE.md file content
 * @returns {Array<{id: string, status: string, nextStep: string}>}
 */
function parseActiveSpecsTable(content) {
  if (!content) return [];

  const lines = content.split('\n');
  const sec = findSection(lines, 'Active Specifications');
  if (!sec) return [];

  const tbl = findTable(lines, sec.start, sec.end);
  if (!tbl) return [];

  const lower = tbl.columns.map(c => String(c).toLowerCase().trim());
  const find = (aliases) => {
    for (const a of aliases) {
      const i = lower.indexOf(a);
      if (i !== -1) return i;
    }
    return -1;
  };

  const idIdx = find(['spec-id', 'spec id', 'id']);
  const statusIdx = find(['status', 'state']);
  const nextIdx = find(['next step', 'next_step', 'next']);
  if (idIdx === -1) return [];

  const rows = [];

  for (const li of tbl.rowIdxs) {
    // splitRow() lets the trailing column absorb surplus `|`, so a Next Step holding
    // raw pipes round-trips instead of shifting Status/Next Step out of alignment.
    const cells = splitRow(lines[li], tbl.columns.length);
    if (!cells) continue;

    const id = unescapeCell(cells[idIdx] || '');
    // Skip empty placeholder rows (e.g. "| — | — | — |")
    if (!id || id === '—' || id === '-' || !/^SPEC-/i.test(id)) continue;

    rows.push({
      id,
      status: statusIdx === -1 ? '' : unescapeCell(cells[statusIdx] || ''),
      nextStep: nextIdx === -1 ? '' : unescapeCell(cells[nextIdx] || ''),
    });
  }

  return rows;
}

/**
 * Attempt to read a spec's title from its frontmatter or first H1.
 * Falls back to the spec ID if the file cannot be read.
 *
 * @param {string} cwd - Working directory
 * @param {string} specId - e.g. "SPEC-007"
 * @returns {string} Title or specId as fallback
 */
function readSpecTitle(cwd, specId) {
  try {
    const specPath = path.join(cwd, '.specflow', 'specs', specId + '.md');
    const content = fs.readFileSync(specPath, 'utf8');

    // Try frontmatter title: field
    const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
    if (frontmatterMatch) {
      const yaml = frontmatterMatch[1];
      const titleLine = yaml.split('\n').find(l => l.trim().startsWith('title:'));
      if (titleLine) {
        const title = titleLine.replace(/^title:\s*/, '').trim().replace(/^["']|["']$/g, '');
        if (title) return title;
      }
    }

    // Try first H1
    const h1Match = content.match(/^#\s+(.+)$/m);
    if (h1Match) return h1Match[1].trim();

    return specId;
  } catch (_) {
    return specId;
  }
}

/**
 * Resolve the active spec to act on.
 *
 * @param {string|undefined} specId - Optional explicit SPEC-ID argument
 * @param {string} stateMdContent - Contents of .specflow/STATE.md
 * @param {string} [cwd] - Working directory (for spec title lookups; defaults to process.cwd())
 * @returns {{action: string, id?: string, code?: string, options?: Array}}
 */
function resolveActiveSpec(specId, stateMdContent, cwd) {
  const workDir = cwd || process.cwd();
  const rows = parseActiveSpecsTable(stateMdContent);

  if (specId) {
    // Explicit ID provided
    const found = rows.find(r => r.id === specId);
    if (found) {
      return { action: 'use', id: specId };
    } else {
      return { action: 'error', code: 'SPEC_NOT_ACTIVE', id: specId };
    }
  }

  // No explicit ID
  if (rows.length === 0) {
    return { action: 'error', code: 'NO_ACTIVE_SPEC' };
  }

  if (rows.length === 1) {
    return { action: 'use', id: rows[0].id };
  }

  // Multiple active specs — need disambiguation
  const options = rows.map(r => ({
    id: r.id,
    title: readSpecTitle(workDir, r.id),
    status: r.status,
  }));

  return { action: 'ask', options };
}

module.exports = { resolveActiveSpec, parseActiveSpecsTable };
