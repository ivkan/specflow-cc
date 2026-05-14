/**
 * bin/lib/todo.cjs — TODO operations
 *
 * Exports: cmdTodoLoad(), cmdTodoList(), cmdTodoNextId()
 *
 * Mirrors the pattern of bin/lib/spec.cjs.
 * Supports both per-file format (TODO-XXX.md) and legacy monolithic TODO.md.
 * Format detection is based on presence of TODO-*.md files — INDEX.md is NOT
 * the detection signal (it may not exist until sf:todos is first run).
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { output, error, safeReadFile, parseFrontmatter } = require('./core.cjs');

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
  let perFiles;
  try {
    perFiles = fs.readdirSync(todosDir).filter(f => /^TODO-\d+\.md$/.test(f)).sort();
  } catch (e) {
    perFiles = [];
  }

  if (perFiles.length > 0) {
    // Per-file format
    const todos = [];

    for (const file of perFiles) {
      const content = safeReadFile(path.join(todosDir, file));
      if (!content) continue;

      const parsed = parseFrontmatter(content);
      const fm = parsed.frontmatter;

      // Filter eliminated unless showAll
      if (!showAll && fm.status === 'eliminated') continue;

      todos.push({
        id: fm.id || file.replace('.md', ''),
        title: fm.title || '',
        priority: fm.priority || '—',
        status: fm.status || 'open',
        complexity: fm.complexity || '—',
        created: fm.created || '',
      });
    }

    // Sort by priority (high > medium > low > unset), then by created date (oldest first)
    todos.sort((a, b) => {
      const pa = priorityKey(a.priority);
      const pb = priorityKey(b.priority);
      if (pa !== pb) return pa - pb;
      // Compare dates lexicographically (ISO dates sort correctly as strings)
      if (a.created < b.created) return -1;
      if (a.created > b.created) return 1;
      return 0;
    });

    output(todos, raw, todos.map(t => t.id).join('\n'));
    return;
  }

  // Legacy format: check for monolithic TODO.md
  const legacyPath = path.join(todosDir, 'TODO.md');
  const legacyContent = safeReadFile(legacyPath);

  if (legacyContent) {
    // Parse legacy TODO blocks: ## TODO-XXX — YYYY-MM-DD
    const todos = [];
    const blockRegex = /^## (TODO-\d+) — (\d{4}-\d{2}-\d{2})\s*\n([\s\S]*?)(?=^## TODO-|\Z)/gm;
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
 * 2. .specflow/todos/TODO.md for legacy IDs using fs.readFileSync() + /TODO-(\d+)/g
 *
 * NOTE: Does NOT use grep -oP (GNU-only, unavailable on macOS).
 *
 * @param {string} cwd - Working directory
 * @param {boolean} raw - Output raw string
 */
function cmdTodoNextId(cwd, raw) {
  const todosDir = path.join(cwd, '.specflow', 'todos');

  let maxNum = 0;

  // Scan per-file TODOs
  try {
    const files = fs.readdirSync(todosDir);
    for (const file of files) {
      const match = file.match(/^TODO-(\d+)\.md$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    }
  } catch (e) {
    // directory may not exist yet
  }

  // Scan legacy TODO.md for any IDs referenced there
  const legacyPath = path.join(todosDir, 'TODO.md');
  try {
    const legacyContent = fs.readFileSync(legacyPath, 'utf8');
    const regex = /TODO-(\d+)/g;
    let match;
    while ((match = regex.exec(legacyContent)) !== null) {
      const num = parseInt(match[1], 10);
      if (num > maxNum) maxNum = num;
    }
  } catch (e) {
    // file may not exist — skip
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
  let perFiles;
  try {
    perFiles = fs.readdirSync(todosDir).filter(f => /^TODO-\d+\.md$/.test(f)).sort();
  } catch (e) {
    perFiles = [];
  }

  const todos = [];

  for (const file of perFiles) {
    const content = safeReadFile(path.join(todosDir, file));
    if (!content) continue;

    const parsed = parseFrontmatter(content);
    const fm = parsed.frontmatter;

    // Strip surrounding quotes from title (YAML may preserve them)
    let title = fm.title || '';
    if ((title.startsWith('"') && title.endsWith('"')) || (title.startsWith("'") && title.endsWith("'"))) {
      title = title.slice(1, -1);
    }

    todos.push({
      id: fm.id || file.replace('.md', ''),
      title,
      priority: fm.priority || '—',
      status: fm.status || 'open',
      created: fm.created || '',
    });
  }

  // Sort by priority (high > medium > low > unset), then by created date
  todos.sort((a, b) => {
    const pa = priorityKey(a.priority);
    const pb = priorityKey(b.priority);
    if (pa !== pb) return pa - pb;
    if (a.created < b.created) return -1;
    if (a.created > b.created) return 1;
    return 0;
  });

  // Count by priority
  const counts = { high: 0, medium: 0, low: 0, unset: 0 };
  for (const t of todos) {
    if (t.priority === 'high') counts.high++;
    else if (t.priority === 'medium') counts.medium++;
    else if (t.priority === 'low') counts.low++;
    else counts.unset++;
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
    let title = t.title;
    if (title.length > 50) title = title.slice(0, 50) + '...';
    lines.push(`| ${i + 1} | ${t.id} | ${title} | ${t.priority} | ${t.status} | ${t.created} |`);
  }

  lines.push('');
  lines.push(`**Total:** ${todos.length} items (${counts.high} high, ${counts.medium} medium, ${counts.low} low, ${counts.unset} unset)`);
  lines.push('');
  lines.push('---');
  const now = new Date();
  const timestamp = now.toISOString().replace('T', ' ').slice(0, 16);
  lines.push(`*Last regenerated: ${timestamp}*`);
  lines.push('');

  const indexPath = path.join(todosDir, 'INDEX.md');
  fs.writeFileSync(indexPath, lines.join('\n'), 'utf8');

  output({ reindexed: todos.length, path: indexPath }, raw, `Reindexed ${todos.length} TODOs → INDEX.md`);
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
 * Output JSON: { stale, missing_from_index, extra_in_index, index_exists }
 *  - missing_from_index: file exists on disk but not in INDEX.md
 *  - extra_in_index: ID listed in INDEX.md but no file on disk
 *
 * @param {string} cwd - Working directory
 * @param {boolean} raw - Output mode
 */
function cmdTodoCheckStale(cwd, raw) {
  const todosDir = path.join(cwd, '.specflow', 'todos');
  const indexPath = path.join(todosDir, 'INDEX.md');

  // Collect IDs from disk
  const diskIds = new Set();
  try {
    for (const f of fs.readdirSync(todosDir)) {
      const m = f.match(/^(TODO-\d+)\.md$/);
      if (m) diskIds.add(m[1]);
    }
  } catch (e) {
    // todos dir missing — treat as empty
  }

  // Collect IDs referenced in INDEX.md (parse only the table rows)
  const indexIds = new Set();
  const indexContent = safeReadFile(indexPath);
  const indexExists = indexContent !== null;

  if (indexContent) {
    // Match TODO-XXX in pipe-table cells: "| N | TODO-001 | ..."
    const regex = /\|\s*\d+\s*\|\s*(TODO-\d+)\s*\|/g;
    let m;
    while ((m = regex.exec(indexContent)) !== null) {
      indexIds.add(m[1]);
    }
  }

  const missingFromIndex = [...diskIds].filter(id => !indexIds.has(id)).sort();
  const extraInIndex = [...indexIds].filter(id => !diskIds.has(id)).sort();

  // If INDEX.md does not exist but there are TODO files, INDEX is stale.
  // If INDEX.md does not exist and no TODO files, not stale (nothing to track).
  const stale =
    missingFromIndex.length > 0 ||
    extraInIndex.length > 0 ||
    (!indexExists && diskIds.size > 0);

  output(
    {
      stale,
      index_exists: indexExists,
      todo_count: diskIds.size,
      index_count: indexIds.size,
      missing_from_index: missingFromIndex,
      extra_in_index: extraInIndex,
    },
    raw,
    stale ? 'STALE' : 'FRESH'
  );
}

module.exports = {
  cmdTodoLoad,
  cmdTodoList,
  cmdTodoNextId,
  cmdTodoReindex,
  cmdTodoCheckStale,
};
