/**
 * bin/lib/spec.cjs — Spec operations
 *
 * Exports: cmdSpecLoad(), cmdSpecList(), cmdSpecNextId()
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { output, error, safeReadFile, parseFrontmatter } = require('./core.cjs');

/**
 * Load and parse a spec file.
 * @param {string} cwd - Working directory
 * @param {string} id - Spec ID (e.g., "SPEC-007")
 * @param {boolean} raw - Output raw string
 */
function cmdSpecLoad(cwd, id, raw) {
  if (!id) {
    error('Missing spec ID. Usage: spec load <id>');
  }

  const specPath = path.join(cwd, '.specflow', 'specs', id + '.md');
  const content = safeReadFile(specPath);

  if (!content) {
    error('Spec not found: ' + specPath);
  }

  const parsed = parseFrontmatter(content);

  output({
    frontmatter: parsed.frontmatter,
    body: parsed.body,
  }, raw, parsed.body);
}

/**
 * List all specs in .specflow/specs/.
 * Extracts id, title, status, complexity, priority from each.
 * Title is parsed from the first # heading in the body.
 * @param {string} cwd - Working directory
 * @param {boolean} raw - Output raw string
 */
function cmdSpecList(cwd, raw) {
  const specsDir = path.join(cwd, '.specflow', 'specs');

  let files;
  try {
    files = fs.readdirSync(specsDir).filter(f => f.endsWith('.md')).sort();
  } catch (e) {
    error('Cannot read specs directory: ' + specsDir);
  }

  const specs = [];

  for (const file of files) {
    const content = safeReadFile(path.join(specsDir, file));
    if (!content) continue;

    const parsed = parseFrontmatter(content);
    const fm = parsed.frontmatter;

    // Extract title from first # heading in body
    let title = '';
    const titleMatch = parsed.body.match(/^#\s+(.+)$/m);
    if (titleMatch) {
      title = titleMatch[1].trim();
    }

    specs.push({
      id: fm.id || file.replace('.md', ''),
      title: title,
      status: fm.status || '',
      complexity: fm.complexity || '',
      priority: fm.priority || '',
    });
  }

  output(specs, raw, specs.map(s => s.id).join('\n'));
}

/**
 * Calculate the next available SPEC-XXX number.
 * Scans both .specflow/specs/ and .specflow/archive/ directories.
 * Ignores non-numeric spec IDs (e.g., SPEC-GSD-A).
 * @param {string} cwd - Working directory
 * @param {boolean} raw - Output raw string
 */
function cmdSpecNextId(cwd, raw) {
  const dirs = [
    path.join(cwd, '.specflow', 'specs'),
    path.join(cwd, '.specflow', 'archive'),
  ];

  let maxNum = 0;

  for (const dir of dirs) {
    let files;
    try {
      files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));
    } catch (e) {
      continue; // directory may not exist
    }

    for (const file of files) {
      // Match SPEC-NNN pattern (numeric only)
      const match = file.match(/^SPEC-(\d+)\.md$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    }
  }

  const nextNumber = maxNum + 1;
  const nextId = 'SPEC-' + String(nextNumber).padStart(3, '0');

  output({
    next_id: nextId,
    next_number: nextNumber,
  }, raw, nextId);
}

module.exports = {
  cmdSpecLoad,
  cmdSpecList,
  cmdSpecNextId,
};
