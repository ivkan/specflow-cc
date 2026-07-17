/**
 * bin/lib/state-size.cjs — Size discipline for STATE.md
 *
 * STATE.md must stay readable by an LLM agent in one Read. A field file reached
 * 205 KB (one 80 KB cell) — far past the ~25k-token Read cap — so agents read a
 * TRUNCATED file and rewrote it from the fragment, destroying the Decisions tail twice.
 * Bounding the file is therefore a correctness property, not tidiness.
 *
 * Two failure modes, deliberately treated differently:
 *
 *   Oversized cell  → CALLER ERROR   → hard error (exit 1). A caller passing a 74 KB
 *                     audit narrative made a mistake; silently truncating it would be
 *                     the same class of invisible data loss we are fixing here. The
 *                     error carries the exact command to fix it.
 *
 *   File over limit → ACCUMULATION   → auto-rotate with a loud notice. Nobody made a
 *                     mistake; the log simply filled up. Rotation is lossless and
 *                     idempotent (rows move to DECISIONS_ARCHIVE.md), so blocking the
 *                     caller here would only lose the decision they tried to record.
 *
 * Exports: loadSizeConfig(), SizeError, checkCell(), compressCell(), integrity()
 */

'use strict';

const path = require('path');
const { safeReadFile } = require('./core.cjs');
const { findSection, findTable, splitRow } = require('./state-table.cjs');

/** Defaults — override via .specflow/config.json or env. */
const DEFAULTS = {
  /** Rotate once STATE.md passes this. 32 KB ≈ 8k tokens, comfortably inside any Read cap. */
  stateMaxBytes: 32768,
  /** A decision/next-step cell should be a POINTER, not a narrative. */
  cellTarget: 300,
  /** Hard ceiling for a single cell. Past this, writes are rejected. */
  cellHardCap: 500,
  /** A row this big is compressed into a pointer during rotation. */
  oversizeRowBytes: 2048,
  /** Decision rows kept in STATE.md by `state rotate`. */
  keepDecisions: 10,
};

/**
 * Load size config: env (SF_STATE_MAX_BYTES) > .specflow/config.json > defaults.
 * @param {string} cwd
 * @returns {typeof DEFAULTS}
 */
function loadSizeConfig(cwd) {
  const cfg = Object.assign({}, DEFAULTS);

  const raw = safeReadFile(path.join(cwd, '.specflow', 'config.json'));
  if (raw) {
    try {
      const json = JSON.parse(raw);
      if (Number.isInteger(json.state_max_bytes) && json.state_max_bytes > 0) {
        cfg.stateMaxBytes = json.state_max_bytes;
      }
      if (Number.isInteger(json.state_cell_hard_cap) && json.state_cell_hard_cap > 0) {
        cfg.cellHardCap = json.state_cell_hard_cap;
      }
      if (Number.isInteger(json.state_keep_decisions) && json.state_keep_decisions >= 0) {
        cfg.keepDecisions = json.state_keep_decisions;
      }
    } catch (_) {
      // Malformed config is not fatal here — defaults still bound the file.
    }
  }

  const env = process.env.SF_STATE_MAX_BYTES;
  if (env !== undefined) {
    const n = Number(env);
    if (Number.isInteger(n) && n > 0) cfg.stateMaxBytes = n;
  }

  return cfg;
}

/**
 * Error carrying a machine-readable code so callers (LLM agents) get an actionable
 * refusal instead of a stack trace.
 */
class SizeError extends Error {
  constructor(code, message, details) {
    super(message);
    this.name = 'SizeError';
    this.code = code;
    this.details = details || {};
  }
}

/**
 * Reject a cell value that exceeds the hard cap.
 *
 * @param {string} value
 * @param {string} label - cell name, for the error message ("next_step", "summary")
 * @param {Object} cfg - from loadSizeConfig
 * @param {Object} [opts]
 * @param {string} [opts.hint] - the command/action that resolves it
 * @throws {SizeError} CELL_TOO_LARGE
 */
function checkCell(value, label, cfg, opts) {
  const text = String(value === undefined || value === null ? '' : value);
  if (text.length <= cfg.cellHardCap) return text;

  const hint = (opts && opts.hint) ||
    'Record the full text in the spec\'s Audit History, then pass a short pointer here.';

  throw new SizeError(
    'CELL_TOO_LARGE',
    `${label} is ${text.length} chars; the cap is ${cfg.cellHardCap} (target ${cfg.cellTarget}). ` +
    `STATE.md cells are POINTERS, not narratives — a file past ~32 KB exceeds an agent's ` +
    `Read cap and gets destroyed on the next full-file write. ${hint}`,
    { label, actual: text.length, cap: cfg.cellHardCap, target: cfg.cellTarget }
  );
}

/**
 * Replace an oversized cell with a pointer to its archived full text.
 * Used by `state rotate` on rows that must stay in STATE.md (e.g. a live active spec).
 *
 * @param {string} value
 * @param {string} ref - archive locator, e.g. "2026-07-17 SPEC-350"
 * @param {Object} cfg
 * @returns {string}
 */
function compressCell(value, ref, cfg) {
  const text = String(value === undefined || value === null ? '' : value);
  if (text.length <= cfg.cellHardCap) return text;

  const head = text.slice(0, cfg.cellTarget).trimEnd();
  return `${head}… [full text: DECISIONS_ARCHIVE.md ${ref}]`;
}

/**
 * Integrity summary — printed after every mutation so the calling session can
 * sanity-check that it did not just blow up the file.
 *
 * @param {string} content - STATE.md content
 * @param {Object} cfg
 * @returns {{lines, bytes, decision_rows, active_rows, max_row_bytes, over_limit}}
 */
function integrity(content, cfg) {
  const lines = content.split('\n');

  let maxRowBytes = 0;
  for (const l of lines) {
    const b = Buffer.byteLength(l, 'utf8');
    if (b > maxRowBytes) maxRowBytes = b;
  }

  const count = (heading) => {
    const sec = findSection(lines, heading);
    if (!sec) return 0;
    const tbl = findTable(lines, sec.start, sec.end);
    if (!tbl) return 0;
    return tbl.rowIdxs.filter(i => {
      const cells = splitRow(lines[i], tbl.columns.length) || [];
      return cells.some(c => c && c !== '—' && c !== '-');
    }).length;
  };

  const bytes = Buffer.byteLength(content, 'utf8');

  return {
    lines: lines.length,
    bytes,
    decision_rows: count('Decisions'),
    active_rows: count('Active Specifications'),
    max_row_bytes: maxRowBytes,
    over_limit: bytes > cfg.stateMaxBytes,
  };
}

module.exports = {
  DEFAULTS,
  loadSizeConfig,
  SizeError,
  checkCell,
  compressCell,
  integrity,
};
