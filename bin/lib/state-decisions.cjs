/**
 * bin/lib/state-decisions.cjs — Decisions table writer + byte-based rotation
 *
 * Why this module exists: the Decisions table was the heaviest section of a field
 * STATE.md (119 KB / 55 rows) and had NO CLI writer at all — agents appended to it with
 * the Write tool, which is exactly the path that read a truncated file and destroyed the
 * tail twice. `state add-decision` closes that write-path; `state rotate` bounds it.
 *
 * Rotation triggers on BYTES, not lines. The old guidance ("keep STATE.md under ~100
 * lines") never fired on the field file: it was 91 lines and 205 KB, because markdown
 * table rows grow in WIDTH, not count.
 *
 * Exports: cmdStateAddDecision(), cmdStateRotate(), rotateContent()
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { output, error, safeReadFile, atomicWrite } = require('./core.cjs');
const { withStateLock } = require('./lock.cjs');
const {
  findSection, findTable, splitRow, renderRow, unescapeCell, detectOrder,
} = require('./state-table.cjs');
const { loadSizeConfig, SizeError, checkCell, compressCell, integrity } = require('./state-size.cjs');

const ARCHIVE_NAME = 'DECISIONS_ARCHIVE.md';

function today() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Index of a column by any of the given aliases. -1 when absent.
 * @param {string[]} columns
 * @param {string[]} aliases
 */
function colIndex(columns, aliases) {
  const lower = columns.map(c => String(c).toLowerCase().trim());
  for (const a of aliases) {
    const i = lower.indexOf(a);
    if (i !== -1) return i;
  }
  return -1;
}

const DATE_ALIASES = ['date'];
const SPEC_ALIASES = ['spec', 'spec-id', 'spec id'];
const TEXT_ALIASES = ['decision', 'summary', 'text', 'note'];

/**
 * Lay an entry out over whatever columns the table on disk actually has.
 *
 * Handles both shapes seen in the wild: the 2-column template
 * (`| Date | Decision |`, spec folded into the text as a `SPEC-XXX: ` prefix) and the
 * 3-column drift found in a field project (`| Date | Spec | Decision |`).
 *
 * @param {string[]} columns
 * @param {{date: string, spec: string, text: string}} entry
 * @returns {string[]} cell values, unescaped (renderRow escapes them)
 */
function layoutEntry(columns, entry) {
  const specIdx = colIndex(columns, SPEC_ALIASES);

  return columns.map((_, i) => {
    if (i === colIndex(columns, DATE_ALIASES)) return entry.date;
    if (i === specIdx) return entry.spec || '';
    if (i === colIndex(columns, TEXT_ALIASES)) {
      // No dedicated Spec column → keep the established "SPEC-XXX: text" convention.
      return specIdx === -1 && entry.spec ? entry.spec + ': ' + entry.text : entry.text;
    }
    return '';
  });
}

/**
 * Read an entry back out of a row, whatever the schema.
 * @param {string[]} columns
 * @param {string[]} cells
 * @returns {{date: string, spec: string, text: string}}
 */
function readEntry(columns, cells) {
  const di = colIndex(columns, DATE_ALIASES);
  const si = colIndex(columns, SPEC_ALIASES);
  const ti = colIndex(columns, TEXT_ALIASES);

  return {
    date: di === -1 ? '' : unescapeCell(cells[di] || ''),
    spec: si === -1 ? '' : unescapeCell(cells[si] || ''),
    text: ti === -1 ? '' : unescapeCell(cells[ti] || ''),
  };
}

/** Is this row a placeholder (`| — | — |`)? */
function isPlaceholder(cells) {
  return cells.every(c => !c || c === '—' || c === '-');
}

// ─── Archive ──────────────────────────────────────────────────────────────────

/**
 * Append entries to DECISIONS_ARCHIVE.md, matching whatever table shape it already has.
 *
 * The archive is append-only and never read whole by an agent, so it has no size limit —
 * it is where the bytes we take out of STATE.md go to stay safe. A field archive was
 * found holding 762 lines of prose followed by a 3-column table, so the target table is
 * located rather than assumed.
 *
 * @param {string} cwd
 * @param {Array<{date, spec, text}>} entries
 * @param {string[]} fallbackColumns - schema to create if the archive has no table yet
 * @returns {number} rows appended
 */
function appendArchive(cwd, entries, fallbackColumns) {
  if (entries.length === 0) return 0;

  const archivePath = path.join(cwd, '.specflow', ARCHIVE_NAME);
  let content = safeReadFile(archivePath);

  if (content === null) {
    const tpl = path.join(__dirname, '..', '..', 'templates', 'decisions-archive.md');
    content = safeReadFile(tpl);
    if (content === null) {
      content = '# SpecFlow Decisions Archive\n\n' +
        'Historical decisions rotated from STATE.md to maintain compactness.\n\n' +
        '## Archived Decisions\n\n';
    }
  }

  let lines = content.split('\n');

  // Find the LAST table in the archive — that is the live append target.
  let target = null;
  for (let i = 0; i < lines.length; i++) {
    const t = findTable(lines, i, lines.length);
    if (!t) break;
    target = t;
    i = (t.rowIdxs.length ? t.rowIdxs[t.rowIdxs.length - 1] : t.sepIdx);
  }

  let columns;
  let insertAt;

  if (target) {
    columns = target.columns;
    insertAt = target.rowIdxs.length
      ? target.rowIdxs[target.rowIdxs.length - 1] + 1
      : target.sepIdx + 1;
  } else {
    columns = fallbackColumns;
    while (lines.length && lines[lines.length - 1].trim() === '') lines.pop();
    lines.push('', renderRow(columns), '|' + columns.map(() => '------').join('|') + '|');
    insertAt = lines.length;
  }

  const rows = entries.map(e => renderRow(layoutEntry(columns, e)));
  lines = lines.slice(0, insertAt).concat(rows, lines.slice(insertAt));

  atomicWrite(archivePath, lines.join('\n'));
  return rows.length;
}

// ─── Rotation ─────────────────────────────────────────────────────────────────

/** Identity columns — short keys that must never be compressed away. */
const KEY_ALIASES = ['spec-id', 'spec id', 'id', 'date', '#'];

/**
 * Compress every cell in one section that exceeds the hard cap: the full text goes to the
 * archive, a pointer stays behind.
 *
 * Applied to EVERY table, not just Decisions. Each of the three tables was found holding
 * a narrative in the field: an 80 KB `Next Step` in Active Specifications, a 3.4 KB
 * `Title` in the Queue, and multi-KB `Decision` cells. Compressing only the section you
 * expect to be fat leaves `state check` reporting a problem that `state rotate` refuses to
 * fix — so the rule is uniform: any cell over the cap, anywhere, becomes a pointer.
 *
 * @param {string[]} lines - mutated in place
 * @param {string} section
 * @param {Object} cfg
 * @param {Array} archived - appended to
 * @param {Array} compressed - appended to
 */
function compressSection(lines, section, cfg, archived, compressed) {
  const sec = findSection(lines, section);
  if (!sec) return;

  const tbl = findTable(lines, sec.start, sec.end);
  if (!tbl) return;

  const keyIdx = colIndex(tbl.columns, KEY_ALIASES);

  for (const li of tbl.rowIdxs) {
    const cells = splitRow(lines[li], tbl.columns.length);
    if (!cells || isPlaceholder(cells)) continue;

    const key = keyIdx === -1 ? '' : unescapeCell(cells[keyIdx]);
    const out = cells.map(unescapeCell);
    let touched = false;

    for (let i = 0; i < out.length; i++) {
      if (i === keyIdx) continue;
      const value = out[i];
      if (value.length <= cfg.cellHardCap) continue;

      const label = String(tbl.columns[i] || `col${i}`).trim();
      const ref = `${today()} ${key || section}`;

      archived.push({
        date: today(),
        spec: key ? `${key} (${label})` : label,
        text: value,
      });
      out[i] = compressCell(value, ref, cfg);
      compressed.push({ section, key, column: label, was: value.length });
      touched = true;
    }

    if (touched) lines[li] = renderRow(out);
  }
}

/**
 * Compute the rotated STATE.md content.
 *
 * Pure: returns the new content plus the entries to archive, so tests can assert the
 * transformation without touching disk.
 *
 * Two distinct jobs:
 *  1. Decisions overflow → move all but the N newest rows to the archive.
 *  2. Oversized cells that must STAY (a live active spec, a queued spec, a kept decision)
 *     → copy the full text to the archive and leave a pointer behind. This is the half the
 *     original plan missed: the field file's 80 KB row was an ACTIVE SPEC row, which no
 *     amount of decision-rotation would ever touch.
 *
 * @param {string} content
 * @param {Object} cfg
 * @param {number} keep
 * @returns {{content: string, archived: Array, compressed: Array, columns: string[]}}
 */
function rotateContent(content, cfg, keep) {
  let lines = content.split('\n');
  const archived = [];
  const compressed = [];
  let decisionColumns = ['Date', 'Decision'];

  // ── 1. Rotate the Decisions table: keep the N newest rows ──
  const dec = findSection(lines, 'Decisions');
  if (dec) {
    const tbl = findTable(lines, dec.start, dec.end);
    if (tbl) {
      decisionColumns = tbl.columns;

      const rows = tbl.rowIdxs
        .map(li => ({ li, cells: splitRow(lines[li], tbl.columns.length) }))
        .filter(r => r.cells && !isPlaceholder(r.cells));

      const order = detectOrder(rows.map(r => readEntry(tbl.columns, r.cells).date));

      // Newest first, whatever the on-disk order.
      const byAge = order === 'desc' ? rows : rows.slice().reverse();
      const dropLines = new Set(byAge.slice(keep).map(r => r.li));

      // Archive dropped rows in file order, then remove their lines.
      for (const r of rows) {
        if (dropLines.has(r.li)) archived.push(readEntry(tbl.columns, r.cells));
      }
      if (dropLines.size) {
        lines = lines.filter((_, i) => !dropLines.has(i));
      }
    }
  }

  // ── 2. Compress oversized cells that remain, in every table ──
  for (const section of ['Active Specifications', 'Queue', 'Decisions']) {
    compressSection(lines, section, cfg, archived, compressed);
  }

  return { content: lines.join('\n'), archived, compressed, columns: decisionColumns };
}

/**
 * Perform rotation on disk.
 *
 * Write ordering is deliberate: the ARCHIVE is written before STATE.md. A crash between
 * the two leaves duplicate archive rows (harmless, recoverable). The reverse ordering
 * would drop rows from STATE.md that never reached the archive — silent data loss, the
 * very thing this whole change exists to stop.
 *
 * @param {string} cwd
 * @param {Object} opts - {keep, raw}
 */
async function cmdStateRotate(cwd, opts) {
  const cfg = loadSizeConfig(cwd);
  const keep = Number.isInteger(opts.keep) ? opts.keep : cfg.keepDecisions;
  const statePath = path.join(cwd, '.specflow', 'STATE.md');

  const result = await withStateLock(async () => {
    const content = safeReadFile(statePath);
    if (content === null) error('STATE.md not found at ' + statePath);

    const before = Buffer.byteLength(content, 'utf8');
    const rot = rotateContent(content, cfg, keep);

    if (rot.archived.length === 0 && rot.content === content) {
      return Object.assign(
        { rotated: false, message: 'Nothing to rotate (no-op)', bytes_before: before },
        { integrity: integrity(content, cfg) }
      );
    }

    appendArchive(cwd, rot.archived, rot.columns);   // archive first — see above
    atomicWrite(statePath, rot.content);

    return {
      rotated: true,
      archived_rows: rot.archived.length,
      compressed_cells: rot.compressed.length,
      bytes_before: before,
      bytes_after: Buffer.byteLength(rot.content, 'utf8'),
      integrity: integrity(rot.content, cfg),
    };
  });

  output(result, opts.raw, formatIntegrity(result));
  return result;
}

/** One-line integrity summary for the calling session. */
function formatIntegrity(result) {
  const i = result.integrity || {};
  const parts = [
    `lines=${i.lines}`,
    `bytes=${i.bytes}`,
    `decisions=${i.decision_rows}`,
    `max_row=${i.max_row_bytes}`,
  ];
  if (result.rotated) parts.unshift(`rotated: archived=${result.archived_rows} compressed=${result.compressed_cells}`);
  if (i.over_limit) parts.push('OVER_LIMIT');
  return parts.join(' ');
}

// ─── add-decision ─────────────────────────────────────────────────────────────

/**
 * Append one decision row to STATE.md.
 *
 * @param {string} cwd
 * @param {string} specId
 * @param {string} summary
 * @param {Object} opts - {force, raw}
 */
async function cmdStateAddDecision(cwd, specId, summary, opts) {
  const cfg = loadSizeConfig(cwd);
  const statePath = path.join(cwd, '.specflow', 'STATE.md');

  // Caller error → refuse before touching anything. Truncating silently here would
  // hand the agent a false success and lose its text.
  if (!opts.force) {
    checkCell(summary, 'summary', cfg, {
      hint: 'Put the full text in the spec\'s Audit History and pass a one-line pointer, ' +
            'or re-run with --force to archive the full text and keep a pointer row.',
    });
  }

  const result = await withStateLock(async () => {
    let content = safeReadFile(statePath);
    if (content === null) error('STATE.md not found at ' + statePath);

    let autoRotated = false;

    // Accumulation → rotate silently but report it. Nobody erred; the log filled up.
    if (Buffer.byteLength(content, 'utf8') > cfg.stateMaxBytes) {
      const rot = rotateContent(content, cfg, cfg.keepDecisions);
      if (rot.archived.length || rot.content !== content) {
        appendArchive(cwd, rot.archived, rot.columns);
        content = rot.content;
        autoRotated = true;
      }
    }

    let lines = content.split('\n');
    let text = summary;

    // --force on an oversized summary: archive the full text, keep a pointer.
    if (opts.force && summary.length > cfg.cellHardCap) {
      appendArchive(cwd, [{ date: today(), spec: specId, text: summary }], ['Date', 'Spec', 'Decision']);
      text = compressCell(summary, `${today()} ${specId}`, cfg);
    }

    const sec = findSection(lines, 'Decisions');
    if (!sec) error('STATE.md has no `## Decisions` section. Run: sf-tools state normalize');

    const tbl = findTable(lines, sec.start, sec.end);
    if (!tbl) error('STATE.md `## Decisions` section has no table. Run: sf-tools state normalize');

    const rows = tbl.rowIdxs
      .map(li => ({ li, cells: splitRow(lines[li], tbl.columns.length) }))
      .filter(r => r.cells);

    const real = rows.filter(r => !isPlaceholder(r.cells));
    const order = detectOrder(real.map(r => readEntry(tbl.columns, r.cells).date));

    const row = renderRow(layoutEntry(tbl.columns, { date: today(), spec: specId, text }));

    // Drop a `| — | — |` placeholder rather than growing the table around it.
    const placeholders = rows.filter(r => isPlaceholder(r.cells)).map(r => r.li);

    let insertAt;
    if (real.length === 0) {
      insertAt = tbl.sepIdx + 1;
    } else if (order === 'desc') {
      insertAt = real[0].li;
    } else {
      insertAt = real[real.length - 1].li + 1;
    }

    lines = lines.slice(0, insertAt).concat([row], lines.slice(insertAt));
    if (placeholders.length) {
      const shifted = new Set(placeholders.map(li => (li >= insertAt ? li + 1 : li)));
      lines = lines.filter((_, i) => !shifted.has(i));
    }

    const updated = lines.join('\n');
    atomicWrite(statePath, updated);

    return {
      added: true,
      spec: specId,
      date: today(),
      auto_rotated: autoRotated,
      integrity: integrity(updated, cfg),
    };
  });

  output(result, opts.raw, formatIntegrity(result));
  return result;
}

module.exports = {
  cmdStateAddDecision,
  cmdStateRotate,
  rotateContent,
  appendArchive,
  layoutEntry,
  readEntry,
  colIndex,
  formatIntegrity,
};
