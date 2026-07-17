/**
 * bin/lib/state-check.cjs — STATE.md diagnostics and schema normalization
 *
 * `state check` is what /sf:health calls. The arithmetic lives in Node on purpose: a
 * health check that asked the agent to eyeball STATE.md's size would itself be subject to
 * the Read cap it is meant to detect — it would read a truncated file and pronounce it
 * healthy.
 *
 * Exports: cmdStateCheck(), cmdStateNormalize(), checkState()
 */

'use strict';

const path = require('path');
const { output, error, safeReadFile, atomicWrite } = require('./core.cjs');
const { withStateLock } = require('./lock.cjs');
const { findSection, findTable, splitRow, renderRow, unescapeCell, isSeparator } = require('./state-table.cjs');
const { loadSizeConfig, integrity } = require('./state-size.cjs');
const { colIndex } = require('./state-decisions.cjs');

/** Canonical schemas, per templates/state.md. */
const CANONICAL = {
  'Active Specifications': ['SPEC-ID', 'Status', 'Next Step'],
  'Queue': ['#', 'ID', 'Title', 'Priority', 'Status'],
  'Decisions': ['Date', 'Decision'],
};

/** Column aliases that count as "the same column" when comparing against canonical. */
const ALIASES = {
  'SPEC-ID': ['spec-id', 'spec id', 'id', 'spec'],
  'ID': ['id', 'spec-id', 'spec id', 'spec'],
  'Status': ['status', 'state'],
  'Next Step': ['next step', 'next_step', 'next'],
  'Title': ['title', 'name'],
  'Priority': ['priority', 'prio', 'p'],
  'Date': ['date'],
  'Decision': ['decision', 'summary', 'text', 'note'],
  '#': ['#', 'num', 'no'],
};

/**
 * Full diagnostic sweep. Pure — takes content, returns findings.
 *
 * @param {string} content - STATE.md content
 * @param {Object} cfg - from loadSizeConfig
 * @returns {Object} findings
 */
function checkState(content, cfg) {
  const lines = content.split('\n');
  const bytes = Buffer.byteLength(content, 'utf8');

  const findings = {
    bytes,
    limit: cfg.stateMaxBytes,
    over_limit: bytes > cfg.stateMaxBytes,
    approaching_limit: bytes > cfg.stateMaxBytes * 0.8 && bytes <= cfg.stateMaxBytes,
    oversized_rows: [],
    oversized_cells: [],
    missing_sections: [],
    schema_drift: [],
    broken_tables: [],
    truncation_scar: null,
    integrity: integrity(content, cfg),
  };

  // ── Oversized rows (informational: the >2 KB fingerprint) ──
  lines.forEach((l, i) => {
    const b = Buffer.byteLength(l, 'utf8');
    if (b > cfg.oversizeRowBytes) {
      findings.oversized_rows.push({ line: i + 1, bytes: b, preview: l.slice(0, 60) });
    }
  });

  // ── Sections, schemas, table structure ──
  for (const [name, canonical] of Object.entries(CANONICAL)) {
    const sec = findSection(lines, name);
    if (!sec) {
      findings.missing_sections.push(name);
      continue;
    }

    const tbl = findTable(lines, sec.start, sec.end);
    if (!tbl) {
      findings.broken_tables.push({ section: name, reason: 'no table (header/separator missing)' });
      continue;
    }

    // Oversized cells — the ACTIONABLE finding: exactly what `state rotate` compresses.
    // Reported separately from oversized_rows so health never flags something rotate
    // would decline to fix.
    for (const li of tbl.rowIdxs) {
      const cells = splitRow(lines[li], tbl.columns.length) || [];
      cells.forEach((c, i) => {
        const v = unescapeCell(c || '');
        if (v.length > cfg.cellHardCap) {
          findings.oversized_cells.push({
            section: name,
            line: li + 1,
            column: String(tbl.columns[i] || '').trim(),
            chars: v.length,
          });
        }
      });
    }

    const actual = tbl.columns.map(c => c.trim());
    const same =
      actual.length === canonical.length &&
      canonical.every((c, i) => {
        const a = String(actual[i] || '').toLowerCase();
        return a === c.toLowerCase() || (ALIASES[c] || []).includes(a);
      });

    if (!same) {
      findings.schema_drift.push({ section: name, expected: canonical, actual });
    }

    // Rows whose cell count exceeds the header's → unescaped `|` inside a cell.
    for (const li of tbl.rowIdxs) {
      const parts = splitRow(lines[li], null) || [];
      if (parts.length > actual.length) {
        findings.broken_tables.push({
          section: name,
          reason: `row at line ${li + 1} has ${parts.length} cells vs ${actual.length} columns ` +
                  '(unescaped `|` inside a cell)',
        });
      }
    }
  }

  // ── Truncation scar ──
  // A full-file Write after a truncated Read tends to leave the file ending mid-table or
  // missing its tail sections. Either is a fingerprint worth surfacing loudly.
  const nonEmpty = lines.filter(l => l.trim() !== '');
  const last = nonEmpty[nonEmpty.length - 1] || '';
  if (last.trim().startsWith('|') && !last.trim().endsWith('|') && !isSeparator(last)) {
    findings.truncation_scar = 'file ends mid-row — a truncated read may have been written back';
  } else if (findings.missing_sections.length >= 2) {
    findings.truncation_scar =
      `missing sections (${findings.missing_sections.join(', ')}) — a truncated read may have been written back`;
  }

  return findings;
}

/**
 * `state check` — emit diagnostics as JSON for /sf:health to render.
 * @param {string} cwd
 * @param {boolean} raw
 */
function cmdStateCheck(cwd, raw) {
  const cfg = loadSizeConfig(cwd);
  const statePath = path.join(cwd, '.specflow', 'STATE.md');
  const content = safeReadFile(statePath);

  if (content === null) {
    output({ ok: false, code: 'STATE_MISSING', path: statePath }, raw, 'STATE_MISSING');
    return;
  }

  const f = checkState(content, cfg);
  // Schema drift is NOT counted as a problem: every reader here resolves columns by name,
  // so a drifted table is handled correctly. It is reported for visibility, and
  // `state normalize` is opt-in.
  const problems =
    (f.over_limit ? 1 : 0) + f.oversized_cells.length + f.missing_sections.length +
    f.broken_tables.length + (f.truncation_scar ? 1 : 0);

  const result = Object.assign({ ok: problems === 0, problems }, f);
  output(result, raw,
    `bytes=${f.bytes}/${f.limit} oversized_cells=${f.oversized_cells.length} ` +
    `fat_rows=${f.oversized_rows.length} drift=${f.schema_drift.length}` +
    (f.truncation_scar ? ' SCAR' : ''));
}

/**
 * `state normalize` — bring drifted tables back to the canonical schema.
 *
 * Dry-run by default: drift is usually harmless (every reader here is schema-adaptive),
 * so rewriting a user's columns is opt-in rather than automatic. `--apply` performs it,
 * and it REFUSES to drop a column that holds data unless `--force` — a field Queue had a
 * `Created` column with no canonical home, and silently deleting it would be exactly the
 * kind of quiet data loss this whole change exists to prevent.
 *
 * @param {string} cwd
 * @param {Object} opts - {apply, force, raw}
 */
async function cmdStateNormalize(cwd, opts) {
  const cfg = loadSizeConfig(cwd);
  const statePath = path.join(cwd, '.specflow', 'STATE.md');

  const run = async () => {
    const content = safeReadFile(statePath);
    if (content === null) error('STATE.md not found at ' + statePath);

    let lines = content.split('\n');
    const planned = [];
    const blockers = [];

    for (const [name, canonical] of Object.entries(CANONICAL)) {
      const sec = findSection(lines, name);
      if (!sec) continue;

      const tbl = findTable(lines, sec.start, sec.end);
      if (!tbl) continue;

      const actual = tbl.columns.map(c => c.trim());
      const target = canonical.map(c => {
        const i = colIndex(actual, [c.toLowerCase()].concat(ALIASES[c] || []));
        return { name: c, from: i };
      });

      // Columns present on disk that canonical has no slot for.
      const claimed = new Set(target.map(t => t.from).filter(i => i !== -1));
      const orphans = actual
        .map((c, i) => ({ c, i }))
        .filter(o => !claimed.has(o.i));

      const orphansWithData = orphans.filter(o =>
        tbl.rowIdxs.some(li => {
          const cells = splitRow(lines[li], actual.length) || [];
          const v = unescapeCell(cells[o.i] || '').trim();
          return v && v !== '—' && v !== '-';
        })
      );

      const drifted = actual.length !== canonical.length ||
        canonical.some((c, i) => String(actual[i] || '').toLowerCase() !== c.toLowerCase() &&
          !(ALIASES[c] || []).includes(String(actual[i] || '').toLowerCase()));

      if (!drifted) continue;

      planned.push({
        section: name,
        from: actual,
        to: canonical,
        drops: orphansWithData.map(o => o.c),
      });

      if (orphansWithData.length && !opts.force) {
        blockers.push(
          `${name}: normalizing would drop column(s) [${orphansWithData.map(o => o.c).join(', ')}] ` +
          'which hold data. Re-run with --force to accept the loss, or leave the drift ' +
          '(all sf-tools readers are schema-adaptive and handle it correctly).'
        );
        continue;
      }

      if (!opts.apply) continue;

      const newRows = tbl.rowIdxs.map(li => {
        const cells = splitRow(lines[li], actual.length) || [];
        return renderRow(target.map(t => (t.from === -1 ? '' : unescapeCell(cells[t.from] || ''))));
      });

      lines[tbl.headerIdx] = renderRow(canonical);
      lines[tbl.sepIdx] = '|' + canonical.map(() => '------').join('|') + '|';
      tbl.rowIdxs.forEach((li, n) => { lines[li] = newRows[n]; });
    }

    if (!opts.apply) {
      return {
        applied: false,
        drift: planned,
        blockers,
        message: planned.length
          ? 'Drift detected (dry-run). Re-run with --apply to normalize.'
          : 'No schema drift — nothing to normalize.',
      };
    }

    if (blockers.length) {
      return { applied: false, drift: planned, blockers, message: 'Refused: normalizing would drop data.' };
    }

    const updated = lines.join('\n');
    if (updated !== content) atomicWrite(statePath, updated);

    return {
      applied: planned.length > 0,
      drift: planned,
      blockers: [],
      message: planned.length ? 'Normalized to canonical schema.' : 'No schema drift — no-op.',
      integrity: integrity(updated, cfg),
    };
  };

  const result = opts.apply ? await withStateLock(run) : await run();
  output(result, opts.raw, result.message);
}

module.exports = { cmdStateCheck, cmdStateNormalize, checkState, CANONICAL };
