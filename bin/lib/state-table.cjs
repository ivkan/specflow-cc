/**
 * bin/lib/state-table.cjs — Schema-adaptive markdown table primitives for STATE.md
 *
 * Every STATE.md mutation goes through these helpers. Two invariants drive the design,
 * both learned from a field STATE.md that reached 205 KB and was destroyed twice:
 *
 * 1. SCHEMA-ADAPTIVE. Column layout is read from the header row ON DISK, never assumed
 *    from templates/state.md. Real projects drift (a field file carried
 *    `| Date | Spec | Decision |` where the template says `| Date | Decision |`, and
 *    `| ID | Title | Priority | Created |` where the template says
 *    `| # | ID | Title | Priority | Status |`). Writing template-shaped rows into a
 *    drifted table corrupts it, so we write whatever shape the file already has.
 *
 * 2. SURGICAL. Mutations replace/insert/delete individual LINES and never re-render a
 *    section. Untouched bytes are preserved because they are never parsed and rebuilt —
 *    which also preserves HTML comments, blockquotes, and spacing a re-render would eat.
 *
 * Exports:
 *   findSection()   — locate a `## Heading` block by line range
 *   findTable()     — locate header/separator/data rows inside a line range
 *   splitRow()      — split a row into N cells (last column absorbs surplus `|`)
 *   escapeCell()    — make a value safe to place in a table cell
 *   unescapeCell()  — inverse of escapeCell
 *   renderRow()     — build a table row line from cells
 *   detectOrder()   — 'desc' (newest-first) or 'asc' (append-at-end)
 */

'use strict';

/**
 * Locate a `## Heading` section by name.
 * @param {string[]} lines
 * @param {string} heading - e.g. "Decisions" (without the "## ")
 * @returns {{start: number, end: number}|null} start = heading line index, end = exclusive
 */
function findSection(lines, heading) {
  const want = ('## ' + heading).toLowerCase();
  let start = -1;

  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim().toLowerCase();
    if (start === -1 && t === want) {
      start = i;
      continue;
    }
    if (start !== -1 && t.startsWith('## ')) {
      return { start, end: i };
    }
  }

  return start === -1 ? null : { start, end: lines.length };
}

/**
 * Is this line a table separator (|---|---|)?
 * @param {string} line
 * @returns {boolean}
 */
function isSeparator(line) {
  const t = line.trim();
  if (!t.startsWith('|')) return false;
  return /^\|[\s:|-]+\|?$/.test(t) && t.includes('-');
}

/**
 * Locate the first markdown table within a line range.
 *
 * @param {string[]} lines
 * @param {number} start - inclusive
 * @param {number} end - exclusive
 * @returns {{headerIdx, sepIdx, columns: string[], rowIdxs: number[]}|null}
 */
function findTable(lines, start, end) {
  for (let i = start; i < end - 1; i++) {
    const line = lines[i];
    if (!line.trim().startsWith('|')) continue;
    if (!isSeparator(lines[i + 1])) continue;

    const columns = splitRow(line, null).map(c => c.trim());
    const rowIdxs = [];

    for (let j = i + 2; j < end; j++) {
      const t = lines[j].trim();
      // A blank line or prose ends the table (standard markdown). Stopping on blank also
      // prevents absorbing a second table that follows a blank line in the same section.
      if (!t.startsWith('|')) break;
      if (isSeparator(lines[j])) continue;
      rowIdxs.push(j);
    }

    return { headerIdx: i, sepIdx: i + 1, columns, rowIdxs };
  }

  return null;
}

/**
 * Split a string on `|` characters that are not backslash-escaped.
 * @param {string} s
 * @returns {string[]}
 */
function splitUnescaped(s) {
  const out = [];
  let cur = '';

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '\\' && s[i + 1] === '|') {
      cur += '\\|';
      i++;
      continue;
    }
    if (ch === '|') {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  out.push(cur);

  return out;
}

/**
 * Split a markdown table row into cells.
 *
 * When `ncols` is given, the LAST column absorbs any surplus fragments. This is what
 * makes the parser survive legacy rows holding unescaped `|` inside a trailing
 * narrative cell: the field STATE.md's 80 KB `Next Step` cell contained two raw pipes,
 * so a naive split saw 5 columns in a 3-column table and shifted every field right.
 * Absorbing the tail reconstructs the original cell byte-for-byte instead.
 *
 * Cells are NOT unescaped here — callers that need the logical value call unescapeCell.
 *
 * @param {string} line
 * @param {number|null} ncols - expected column count, or null for "as many as present"
 * @returns {string[]|null} null when the line is not a table row
 */
function splitRow(line, ncols) {
  const t = line.trim();
  if (!t.startsWith('|')) return null;

  let inner = t.slice(1);
  if (inner.endsWith('|') && !inner.endsWith('\\|')) inner = inner.slice(0, -1);

  const parts = splitUnescaped(inner);

  if (ncols === null || ncols === undefined) {
    return parts.map(p => p.trim());
  }

  if (parts.length <= ncols) {
    const out = parts.map(p => p.trim());
    while (out.length < ncols) out.push('');
    return out;
  }

  const head = parts.slice(0, ncols - 1).map(p => p.trim());
  const tail = parts.slice(ncols - 1).join('|').trim();
  return head.concat([tail]);
}

/**
 * Make a value safe to place inside a table cell: no raw pipes, no line breaks.
 * Idempotent — an already-escaped value passes through unchanged.
 *
 * @param {string} s
 * @returns {string}
 */
function escapeCell(s) {
  return String(s === undefined || s === null ? '' : s)
    .replace(/\r\n|\r|\n/g, ' ')
    .replace(/(?<!\\)\|/g, '\\|')
    .trim();
}

/**
 * Inverse of escapeCell (line breaks are not restored — they are lossy by design).
 * @param {string} s
 * @returns {string}
 */
function unescapeCell(s) {
  return String(s === undefined || s === null ? '' : s).replace(/\\\|/g, '|');
}

/**
 * Build a table row line from cell values. Values are escaped.
 * @param {string[]} cells
 * @returns {string}
 */
function renderRow(cells) {
  return '| ' + cells.map(escapeCell).join(' | ') + ' |';
}

/**
 * Detect whether a dated table is newest-first ('desc') or oldest-first ('asc').
 * Drives where a new row is inserted. Defaults to 'asc' (append at end), matching
 * templates/state.md; a field file was found running newest-first, hence the sniff.
 *
 * @param {string[]} dates - date cell of each data row, in file order
 * @returns {'asc'|'desc'}
 */
function detectOrder(dates) {
  const valid = dates.filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d));
  if (valid.length < 2) return 'asc';
  return valid[0] > valid[valid.length - 1] ? 'desc' : 'asc';
}

module.exports = {
  findSection,
  findTable,
  isSeparator,
  splitRow,
  splitUnescaped,
  escapeCell,
  unescapeCell,
  renderRow,
  detectOrder,
};
