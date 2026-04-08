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

module.exports = {
  cmdTodoLoad,
  cmdTodoList,
  cmdTodoNextId,
};
