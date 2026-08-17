/**
 * bin/lib/todo.cjs — TODO operations
 *
 * Exports: cmdTodoLoad(), cmdTodoList(), cmdTodoNextId()
 *
 * Mirrors the pattern of bin/lib/spec.cjs.
 * Supports both per-file format (TODO-XXX.md, plus split ids such as
 * TODO-XXXa.md — see TODO_ID_SRC) and legacy monolithic TODO.md.
 * Format detection is based on presence of TODO-*.md files — INDEX.md is NOT
 * the detection signal (it may not exist until sf:todos is first run).
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { output, error, safeReadFile, parseFrontmatter } = require('./core.cjs');

/**
 * Required YAML frontmatter fields for each TODO file.
 * When any of these is absent or blank, the reindex records the file as MALFORMED
 * rather than silently defaulting to empty values (which would hide drift).
 */
const REQUIRED_TODO_FIELDS = ['id', 'title', 'created'];

/**
 * Single source of truth for the TODO id grammar.
 *
 * An id is `TODO-` + digits + an optional lowercase-letter suffix. The suffix
 * appears when an oversized TODO is split in place (TODO-093 -> TODO-093a,
 * TODO-093b). The suffix belongs to the id, it is NOT a new number: next-id
 * derives from the digits alone, so splitting never consumes an unused number.
 *
 * Every id and filename match in this file is built from these two atoms. Do
 * not inline a fresh /TODO-\d+/ literal anywhere — nine hand-copied variants
 * of that literal are exactly how TODO-093a.md came to be dropped from
 * INDEX.md while `todo reindex` still reported success.
 */
const TODO_NUM_SRC = '\\d+';
const TODO_SUFFIX_SRC = '[a-z]*';

/** Capturing form: group 1 = digits, group 2 = suffix (possibly empty). */
const TODO_ID_SRC = 'TODO-(' + TODO_NUM_SRC + ')(' + TODO_SUFFIX_SRC + ')';

/** Group-free form, for callers that want to capture the id as a whole. */
const TODO_ID_SRC_ATOMIC = 'TODO-(?:' + TODO_NUM_SRC + TODO_SUFFIX_SRC + ')';

/** Human-readable expectation, used in rejection messages. */
const TODO_FILENAME_SHAPE = 'TODO-<digits>[<lowercase suffix>].md';

/**
 * Parse a directory entry as a TODO filename.
 * @param {string} file - Bare filename, e.g. "TODO-093a.md"
 * @returns {{file: string, id: string, num: number, suffix: string}|null}
 *          null when the name is not a well-formed TODO filename.
 */
function parseTodoFilename(file) {
  const m = new RegExp('^' + TODO_ID_SRC + '\\.md$').exec(file);
  if (!m) return null;
  return {
    file,
    id: 'TODO-' + m[1] + m[2],
    num: parseInt(m[1], 10),
    suffix: m[2],
  };
}

/**
 * Canonical id ordering: numeric part first, then suffix, so a split TODO
 * sorts immediately after its parent — TODO-093, TODO-093a, TODO-093b,
 * TODO-094. Used as the final tie-breaker everywhere TODOs are listed, so the
 * order of equal-priority entries is deterministic rather than readdir order.
 *
 * @param {{num: number, suffix: string}} a
 * @param {{num: number, suffix: string}} b
 * @returns {number}
 */
function compareTodoEntries(a, b) {
  if (a.num !== b.num) return a.num - b.num;
  if (a.suffix < b.suffix) return -1;
  if (a.suffix > b.suffix) return 1;
  return 0;
}

/**
 * Enumerate TODO files in a todos directory.
 *
 * Splits the directory into three groups so nothing can be dropped in silence:
 *  - accepted: parsed entries, sorted by {@link compareTodoEntries}
 *  - rejected: names that clearly mean to be TODO files (`TODO-*.md`) but do
 *    not match the id grammar. Callers MUST surface these; they are the class
 *    of failure this helper exists to make visible.
 *  - everything else (INDEX.md, the legacy TODO.md, stray notes) is ignored
 *    without comment, since it never claimed to be a per-file TODO.
 *
 * @param {string} todosDir
 * @returns {{accepted: Array<object>, rejected: Array<{file: string, reason: string}>}}
 */
function listTodoFiles(todosDir) {
  let entries;
  try {
    entries = fs.readdirSync(todosDir);
  } catch (e) {
    return { accepted: [], rejected: [] };
  }

  const accepted = [];
  const rejected = [];

  for (const file of entries) {
    const parsed = parseTodoFilename(file);
    if (parsed) {
      accepted.push(parsed);
    } else if (/^TODO-.+\.md$/.test(file)) {
      rejected.push({
        file,
        reason: 'unrecognized TODO filename (expected ' + TODO_FILENAME_SHAPE + ')',
      });
    }
  }

  accepted.sort(compareTodoEntries);
  rejected.sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : 0));

  return { accepted, rejected };
}

/**
 * Name every rejected file on stderr, together with what the caller did about
 * it. Skipping a file is allowed; skipping it quietly is not.
 *
 * @param {Array<{file: string, reason: string}>} rejected
 * @param {string} consequence - What this command did with the file.
 */
function warnRejected(rejected, consequence) {
  for (const r of rejected) {
    process.stderr.write('warn: ' + r.file + ' — ' + r.reason + ' — ' + consequence + '\n');
  }
}

/**
 * Priority sort order (lower number = higher priority in sort).
 */
const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };

/**
 * Get sort key for a priority value.
 * @param {string} priority
 * @returns {number}
 */
function priorityKey(priority) {
  if (priority && PRIORITY_ORDER[priority] !== undefined) {
    return PRIORITY_ORDER[priority];
  }
  return 3; // unset / —
}

/**
 * Load and parse a TODO file.
 * @param {string} cwd - Working directory
 * @param {string} id - TODO ID (e.g., "TODO-007")
 * @param {boolean} raw - Output raw string
 */
function cmdTodoLoad(cwd, id, raw) {
  if (!id) {
    error('Missing TODO ID. Usage: todo load <id>');
  }

  const todoPath = path.join(cwd, '.specflow', 'todos', id + '.md');
  const content = safeReadFile(todoPath);

  if (!content) {
    error('TODO not found: ' + todoPath);
  }

  const parsed = parseFrontmatter(content);

  output({
    frontmatter: parsed.frontmatter,
    body: parsed.body,
  }, raw, parsed.body);
}

/**
 * List all TODOs.
 *
 * Format detection:
 * 1. If TODO-*.md files exist in .specflow/todos/ — use per-file format
 * 2. If no per-file TODOs but TODO.md exists — use legacy format
 * 3. If neither — return empty list
 *
 * @param {string} cwd - Working directory
 * @param {boolean} raw - Output raw string
 * @param {object} options - Options
 * @param {boolean} options.showAll - If true, include eliminated items
 */
function cmdTodoList(cwd, raw, { showAll } = {}) {
  const todosDir = path.join(cwd, '.specflow', 'todos');

  // Check for per-file TODOs
  const { accepted: perFiles, rejected } = listTodoFiles(todosDir);

  // A listing must not pretend a file it skipped does not exist. `list` stays
  // exit-code 0 (it feeds interactive command flows); the integrity commands
  // `reindex` and `check-stale` are the ones that fail hard on the same input.
  warnRejected(rejected, 'not listed');

  if (perFiles.length > 0) {
    // Per-file format
    const todos = [];

    for (const entry of perFiles) {
      const content = safeReadFile(path.join(todosDir, entry.file));
      if (!content) continue;

      const parsed = parseFrontmatter(content);
      const fm = parsed.frontmatter;

      // Filter eliminated unless showAll
      if (!showAll && fm.status === 'eliminated') continue;

      todos.push({
        id: fm.id || entry.id,
        title: fm.title || '',
        priority: fm.priority || '—',
        status: fm.status || 'open',
        complexity: fm.complexity || '—',
        created: fm.created || '',
        _entry: entry,
      });
    }

    // Sort by priority (high > medium > low > unset), then by created date
    // (oldest first), then by id so equal-priority entries have a defined order.
    todos.sort((a, b) => {
      const pa = priorityKey(a.priority);
      const pb = priorityKey(b.priority);
      if (pa !== pb) return pa - pb;
      // Compare dates lexicographically (ISO dates sort correctly as strings)
      if (a.created < b.created) return -1;
      if (a.created > b.created) return 1;
      return compareTodoEntries(a._entry, b._entry);
    });

    for (const t of todos) delete t._entry;

    output(todos, raw, todos.map(t => t.id).join('\n'));
    return;
  }

  // Legacy format: check for monolithic TODO.md
  const legacyPath = path.join(todosDir, 'TODO.md');
  const legacyContent = safeReadFile(legacyPath);

  if (legacyContent) {
    // Parse legacy TODO blocks: ## TODO-XXX — YYYY-MM-DD
    const todos = [];
    const blockRegex = new RegExp(
      '^## (' + TODO_ID_SRC_ATOMIC + ') — (\\d{4}-\\d{2}-\\d{2})\\s*\\n([\\s\\S]*?)(?=^## TODO-|\\Z)',
      'gm'
    );
    let match;

    // Append sentinel heading so the last block's lazy [\s\S]*? terminates correctly
    while ((match = blockRegex.exec(legacyContent + '\n## TODO-END')) !== null) {
      const id = match[1];
      const created = match[2];
      const body = match[3];

      // Extract description
      const descMatch = body.match(/\*\*Description:\*\*\s*(.+)/);
      const title = descMatch ? descMatch[1].trim() : '';

      // Extract priority
      const prioMatch = body.match(/\*\*Priority:\*\*\s*(\S+)/);
      const priority = prioMatch ? prioMatch[1].trim() : '—';

      if (!showAll) {
        // Legacy format has no eliminated status — always include
      }

      todos.push({
        id,
        title,
        priority,
        status: 'open',
        complexity: '—',
        created,
      });
    }

    // Sort same way
    todos.sort((a, b) => {
      const pa = priorityKey(a.priority);
      const pb = priorityKey(b.priority);
      if (pa !== pb) return pa - pb;
      if (a.created < b.created) return -1;
      if (a.created > b.created) return 1;
      return 0;
    });

    output(todos, raw, todos.map(t => t.id).join('\n'));
    return;
  }

  // Neither format found — empty list
  output([], raw, '');
}

/**
 * Calculate the next available TODO-XXX number.
 *
 * Scans:
 * 1. .specflow/todos/TODO-*.md filenames using fs.readdirSync() + JS regex
 * 2. .specflow/todos/TODO.md for legacy IDs
 * 3. .specflow/specs/*.md and .specflow/archive/*.md for `source: TODO-XXX`
 *    frontmatter entries (retired IDs from promoted TODOs).
 *
 * Only the numeric part of an id counts. A split suffix (TODO-093a) does not
 * advance the counter — TODO-093a and TODO-093b together still mean "093 is
 * taken", never "094 and 095 are taken".
 *
 * NOTE: Does NOT use grep -oP (GNU-only, unavailable on macOS).
 *
 * @param {string} cwd - Working directory
 * @param {boolean} raw - Output raw string
 */
function cmdTodoNextId(cwd, raw) {
  const todosDir = path.join(cwd, '.specflow', 'todos');

  let maxNum = 0;

  // Scan per-file TODOs. A rejected name may still hold a number, so an
  // unnoticed one could make next-id hand out an id that is already on disk.
  const { accepted, rejected } = listTodoFiles(todosDir);
  warnRejected(rejected, 'not counted toward next-id');
  for (const entry of accepted) {
    if (entry.num > maxNum) maxNum = entry.num;
  }

  // Scan legacy TODO.md for any IDs referenced there
  const legacyPath = path.join(todosDir, 'TODO.md');
  try {
    const legacyContent = fs.readFileSync(legacyPath, 'utf8');
    const regex = new RegExp(TODO_ID_SRC, 'g');
    let match;
    while ((match = regex.exec(legacyContent)) !== null) {
      const num = parseInt(match[1], 10);
      if (num > maxNum) maxNum = num;
    }
  } catch (e) {
    // file may not exist — skip
  }

  // Scan promoted-spec frontmatter for retired TODO IDs.
  // On promotion, the source TODO file is deleted; the only surviving
  // record is `source: TODO-XXX` in the spec's frontmatter. Without this
  // scan, next-id can reissue a retired ID and downstream `/sf:plan` will
  // reject the new TODO because the archive still records the old promotion.
  for (const sub of ['specs', 'archive']) {
    const dir = path.join(cwd, '.specflow', sub);
    let files;
    try {
      files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));
    } catch (e) { continue; }
    for (const file of files) {
      let content;
      try {
        content = fs.readFileSync(path.join(dir, file), 'utf8');
      } catch (e) { continue; }
      const regex = new RegExp('(?:^|\\n)source:\\s*' + TODO_ID_SRC, 'g');
      let match;
      while ((match = regex.exec(content)) !== null) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    }
  }

  const nextNumber = maxNum + 1;
  const nextId = 'TODO-' + String(nextNumber).padStart(3, '0');

  output({
    next_id: nextId,
    next_number: nextNumber,
  }, raw, nextId);
}

/**
 * Reindex: scan TODO-*.md files, regenerate INDEX.md.
 *
 * @param {string} cwd - Working directory
 * @param {boolean} raw - Output raw string
 */
function cmdTodoReindex(cwd, raw) {
  const todosDir = path.join(cwd, '.specflow', 'todos');

  // Collect per-file TODOs
  const { accepted: perFiles, rejected } = listTodoFiles(todosDir);
  warnRejected(rejected, 'NOT indexed');

  const todos = [];

  for (const entry of perFiles) {
    const file = entry.file;
    const content = safeReadFile(path.join(todosDir, file));
    if (!content) continue;

    const parsed = parseFrontmatter(content);
    const fm = parsed.frontmatter;

    // Determine which required fields are absent or blank.
    const missing = REQUIRED_TODO_FIELDS.filter(k => !fm[k] || String(fm[k]).trim() === '');

    // The id in the frontmatter must be the id in the filename. When they
    // disagree, the INDEX row and the on-disk name refer to different TODOs,
    // and check-stale then reports drift that no reindex can ever settle.
    const idMismatch =
      missing.length === 0 && String(fm.id).trim() !== entry.id
        ? 'id mismatch: frontmatter ' + String(fm.id).trim() + ', filename ' + entry.id
        : null;

    if (missing.length > 0 || idMismatch) {
      // Distinguish "no frontmatter block at all" (fm has no keys) from "some
      // fields present but specific ones missing".
      const hasAnyKey = Object.keys(fm).length > 0;
      const reason = idMismatch
        ? idMismatch
        : hasAnyKey
          ? 'missing fields: ' + missing.join(', ')
          : 'no frontmatter block';

      process.stderr.write('warn: ' + file + ' — ' + reason + '\n');

      todos.push({
        malformed: true,
        fileId: entry.id,
        entry,
        reason,
      });
      continue;
    }

    // Strip surrounding quotes from title (YAML may preserve them)
    let title = String(fm.title);
    if ((title.startsWith('"') && title.endsWith('"')) || (title.startsWith("'") && title.endsWith("'"))) {
      title = title.slice(1, -1);
    }

    todos.push({
      id: fm.id,
      title,
      priority: fm.priority || '—',
      status: fm.status || 'open',
      created: fm.created,
      entry,
    });
  }

  // Sort: well-formed records by priority then created date; malformed records
  // always come after all well-formed ones, ordered by id ascending. Ties fall
  // back to id order, which puts a split TODO right after its parent
  // (TODO-093, TODO-093a, TODO-093b, TODO-094).
  todos.sort((a, b) => {
    const am = a.malformed ? 1 : 0;
    const bm = b.malformed ? 1 : 0;
    if (am !== bm) return am - bm; // well-formed before malformed
    if (a.malformed && b.malformed) {
      return compareTodoEntries(a.entry, b.entry);
    }
    // Both well-formed: priority then date
    const pa = priorityKey(a.priority);
    const pb = priorityKey(b.priority);
    if (pa !== pb) return pa - pb;
    if (a.created < b.created) return -1;
    if (a.created > b.created) return 1;
    return compareTodoEntries(a.entry, b.entry);
  });

  // Count by priority — malformed records are excluded from priority breakdown.
  const counts = { high: 0, medium: 0, low: 0, unset: 0 };
  let malformedCount = 0;
  for (const t of todos) {
    if (t.malformed) {
      malformedCount++;
    } else if (t.priority === 'high') {
      counts.high++;
    } else if (t.priority === 'medium') {
      counts.medium++;
    } else if (t.priority === 'low') {
      counts.low++;
    } else {
      counts.unset++;
    }
  }

  // Build INDEX.md
  const lines = [
    '# To-Do Index',
    '',
    '> Cache of individual TODO files. Refreshed when `/sf:todos` runs OR when an',
    '> INDEX-mutating command explicitly invokes the regen helper',
    '> (`node bin/sf-tools.cjs todo reindex`). Do not edit manually — changes will',
    '> be overwritten on the next regen.',
    '',
    '| # | ID | Title | Priority | Status | Created |',
    '|---|-----|-------|----------|--------|---------|',
  ];

  for (let i = 0; i < todos.length; i++) {
    const t = todos[i];
    if (t.malformed) {
      // Render the MALFORMED sentinel row; truncate the reason if very long.
      let marker = 'MALFORMED: ' + t.reason;
      if (marker.length > 50) marker = marker.slice(0, 50) + '...';
      lines.push(`| ${i + 1} | ${t.fileId} | ${marker} | — | — | — |`);
    } else {
      let title = t.title;
      if (title.length > 50) title = title.slice(0, 50) + '...';
      lines.push(`| ${i + 1} | ${t.id} | ${title} | ${t.priority} | ${t.status} | ${t.created} |`);
    }
  }

  lines.push('');
  // Malformed records count toward N items total; they are excluded only from
  // the priority breakdown (H/M/L/unset). When all TODOs are well-formed the
  // summary line is byte-identical to the legacy format so downstream parsers
  // of well-formed runs stay compatible.
  if (malformedCount > 0) {
    lines.push(`**Total:** ${todos.length} items (${counts.high} high, ${counts.medium} medium, ${counts.low} low, ${counts.unset} unset, ${malformedCount} malformed)`);
  } else {
    lines.push(`**Total:** ${todos.length} items (${counts.high} high, ${counts.medium} medium, ${counts.low} low, ${counts.unset} unset)`);
  }

  // Files that could not be indexed at all get named in the artifact itself,
  // not only on stderr — INDEX.md is what a human reads to decide whether the
  // index is complete, and a count alone cannot say "and two files are absent".
  if (rejected.length > 0) {
    lines.push('');
    lines.push(`**Not indexed:** ${rejected.length} file(s) — id does not match \`${TODO_FILENAME_SHAPE}\`:`);
    for (const r of rejected) {
      lines.push(`- \`${r.file}\``);
    }
  }
  lines.push('');
  lines.push('---');
  const now = new Date();
  const timestamp = now.toISOString().replace('T', ' ').slice(0, 16);
  lines.push(`*Last regenerated: ${timestamp}*`);
  lines.push('');

  const indexPath = path.join(todosDir, 'INDEX.md');
  fs.writeFileSync(indexPath, lines.join('\n'), 'utf8');

  // Signal callers that drift was found — set exit code non-zero AFTER writing
  // INDEX.md (so the file is on disk) and BEFORE the output() call (so JSON
  // still flushes). Do NOT call process.exit() here; Node will use exitCode
  // when the event loop drains.
  //
  // A rejected file counts as drift for the same reason a malformed one does:
  // the reindex did less than it claims. `reindexed: N` must never be the only
  // thing a caller sees when a TODO-*.md file was left out.
  if (malformedCount > 0 || rejected.length > 0) {
    process.exitCode = 1;
  }

  const summary = rejected.length > 0
    ? `Reindexed ${todos.length} TODOs → INDEX.md; ${rejected.length} file(s) NOT indexed: ` +
      rejected.map(r => r.file).join(', ')
    : `Reindexed ${todos.length} TODOs → INDEX.md`;

  output(
    {
      reindexed: todos.length,
      malformed: malformedCount,
      rejected: rejected.map(r => ({ file: r.file, reason: r.reason })),
      path: indexPath,
    },
    raw,
    summary
  );
}

/**
 * Check whether INDEX.md is stale relative to TODO-*.md files.
 *
 * Stale = the set of TODO-XXX IDs on disk diverges from the set of TODO-XXX IDs
 * listed in INDEX.md (file deleted but still in INDEX, or file present but missing).
 *
 * NOTE: Eliminated TODOs (`status: eliminated`) still appear in `/sf:todos --all`
 * regenerated INDEX.md output, so they are NOT filtered here — both sides see them.
 *
 * Output JSON: { stale, missing_from_index, extra_in_index, unindexable_files,
 *                index_exists }
 *  - missing_from_index: file exists on disk but not in INDEX.md
 *  - extra_in_index: ID listed in INDEX.md but no file on disk
 *  - unindexable_files: TODO-*.md whose name is not a valid id, so it can
 *    never appear in INDEX.md — stale until renamed
 *
 * @param {string} cwd - Working directory
 * @param {boolean} raw - Output mode
 */
function cmdTodoCheckStale(cwd, raw) {
  const todosDir = path.join(cwd, '.specflow', 'todos');
  const indexPath = path.join(todosDir, 'INDEX.md');

  // Collect IDs from disk
  const { accepted, rejected } = listTodoFiles(todosDir);
  warnRejected(rejected, 'has no valid id, cannot be checked against INDEX.md');
  const diskIds = new Set(accepted.map(e => e.id));

  // Collect IDs referenced in INDEX.md (parse only the table rows)
  const indexIds = new Set();
  const indexContent = safeReadFile(indexPath);
  const indexExists = indexContent !== null;

  if (indexContent) {
    // Match TODO-XXX in pipe-table cells: "| N | TODO-001 | ..."
    const regex = new RegExp('\\|\\s*\\d+\\s*\\|\\s*(' + TODO_ID_SRC_ATOMIC + ')\\s*\\|', 'g');
    let m;
    while ((m = regex.exec(indexContent)) !== null) {
      indexIds.add(m[1]);
    }
  }

  const missingFromIndex = [...diskIds].filter(id => !indexIds.has(id)).sort();
  const extraInIndex = [...indexIds].filter(id => !diskIds.has(id)).sort();

  // If INDEX.md does not exist but there are TODO files, INDEX is stale.
  // If INDEX.md does not exist and no TODO files, not stale (nothing to track).
  //
  // An unindexable filename also counts as stale: this command exists to make
  // INDEX/disk divergence diagnosable, so it must not report FRESH about a
  // directory holding a TODO-*.md file no reindex will ever pick up.
  const stale =
    missingFromIndex.length > 0 ||
    extraInIndex.length > 0 ||
    rejected.length > 0 ||
    (!indexExists && diskIds.size > 0);

  // Exit non-zero when stale so callers can use this as a gate after
  // delete-and-reindex sequences (per SPEC TODO-029). Set exitCode before
  // output() so JSON still flushes; do not call process.exit() directly.
  if (stale) {
    process.exitCode = 1;
  }

  output(
    {
      stale,
      index_exists: indexExists,
      todo_count: diskIds.size,
      index_count: indexIds.size,
      missing_from_index: missingFromIndex,
      extra_in_index: extraInIndex,
      unindexable_files: rejected.map(r => ({ file: r.file, reason: r.reason })),
    },
    raw,
    stale ? 'STALE' : 'FRESH'
  );
}

module.exports = {
  // Id grammar helpers — exported so tests and future callers derive from the
  // same source instead of re-inlining a /TODO-\d+/ literal.
  TODO_ID_SRC,
  TODO_ID_SRC_ATOMIC,
  parseTodoFilename,
  compareTodoEntries,
  listTodoFiles,
  cmdTodoLoad,
  cmdTodoList,
  cmdTodoNextId,
  cmdTodoReindex,
  cmdTodoCheckStale,
};
