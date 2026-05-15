/**
 * bin/lib/archive-summary.cjs — L1 archive summary generator
 *
 * Exports:
 *   parseArchivedSpec(specPath)  → structured summary object
 *   renderSummary(parsed, templatePath) → markdown string
 *   generateSummary(specPath, templatePath, outputPath) → { written, reason? }
 *
 * No npm dependencies — only fs, path from Node standard library.
 * Caller is responsible for providing correct paths.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Parse YAML-style frontmatter from a markdown file.
 * Matches the simple key: value parsing in bin/lib/core.cjs.
 * @param {string} content
 * @returns {{ frontmatter: Object, body: string }}
 */
function _parseFrontmatter(content) {
  if (!content || typeof content !== 'string') {
    return { frontmatter: {}, body: content || '' };
  }
  const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!fmMatch) {
    return { frontmatter: {}, body: content };
  }
  const fm = {};
  fmMatch[1].split('\n').forEach(line => {
    const kv = line.match(/^([^:]+):\s*(.*)$/);
    if (kv) {
      fm[kv[1].trim()] = kv[2].trim();
    }
  });
  return { frontmatter: fm, body: fmMatch[2] };
}

/**
 * Extract a named section's content (between the heading and the next same/higher-level heading).
 * @param {string} body - Full body text
 * @param {string} headingText - Exact heading text (without # prefix)
 * @param {number} level - Heading level (2 = ##, 3 = ###)
 * @returns {string|null}
 */
function _extractSection(body, headingText, level) {
  const hashes = '#'.repeat(level);
  // Match the heading line; content follows until the next heading of same or higher level
  const headingRe = new RegExp(
    `^${hashes}\\s+${headingText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`,
    'm'
  );
  const match = body.match(headingRe);
  if (!match) return null;
  const start = match.index + match[0].length;
  // Next heading at same level or higher (fewer or equal hashes)
  const stopRe = new RegExp(`^#{1,${level}}\\s`, 'm');
  const rest = body.slice(start);
  const stopMatch = rest.match(stopRe);
  return stopMatch ? rest.slice(0, stopMatch.index).trim() : rest.trim();
}

/**
 * Extract bullet list items from a markdown section string.
 * Captures lines that start with `- ` (with optional leading spaces).
 * @param {string} text
 * @returns {string[]}
 */
function _extractBullets(text) {
  if (!text) return [];
  return text
    .split('\n')
    .filter(l => /^\s*-\s+/.test(l))
    .map(l => l.replace(/^\s*-\s+/, '').trim())
    .filter(l => l.length > 0);
}

/**
 * Get the first non-empty, non-heading paragraph from a text block.
 * @param {string} text
 * @returns {string}
 */
function _firstParagraph(text) {
  if (!text) return '';
  const lines = text.split('\n');
  const paragraphLines = [];
  let inParagraph = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('#')) continue; // skip headings
    if (trimmed === '') {
      if (inParagraph) break; // end of first paragraph
      continue;
    }
    inParagraph = true;
    paragraphLines.push(trimmed);
  }
  return paragraphLines.join(' ').trim();
}

/**
 * Extract the title from the first # heading in the body.
 * @param {string} body
 * @returns {string}
 */
function _extractTitle(body) {
  const m = body.match(/^#\s+(.+)$/m);
  return m ? m[1].trim() : '';
}

/**
 * Extract test file references from text.
 * Matches patterns like test/foo.test.cjs
 * @param {string} text
 * @returns {string[]}
 */
function _extractTestRefs(text) {
  if (!text) return [];
  const matches = text.match(/test\/[^\s,)]+\.test\.cjs/g);
  if (!matches) return [];
  return [...new Set(matches)];
}

/**
 * Extract the completion date from a Completion section.
 * Looks for lines like: **Completed:** YYYY-MM-DD
 * @param {string} completionSection
 * @returns {string}
 */
function _extractCompletedDate(completionSection) {
  if (!completionSection) return '';
  const m = completionSection.match(/\*\*Completed:\*\*\s*(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : '';
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse an archived spec file and return a structured summary object.
 *
 * Field extraction strategy:
 *  - goal: from ## Goal Analysis > ### Goal Statement; fallback to first paragraph of ## Context
 *  - decisions: from ## Completion > ### Patterns Established bullets;
 *               fallback to ## Delta ADDED/MODIFIED bullets (top 5)
 *  - keyFiles: from ## Completion > ### Key Files bullets; fallback to ## Delta ADDED bullets (top 6)
 *  - tests: test/*.test.cjs refs found in ### Key Files or elsewhere in ## Completion
 *  - completed: from ## Completion > **Completed:** date line
 *  - title: from first # heading
 *
 * @param {string} specPath - Absolute path to the archived spec file
 * @returns {{
 *   specId: string,
 *   title: string,
 *   type: string,
 *   completed: string,
 *   goal: string,
 *   decisions: string[],
 *   keyFiles: Array<{path: string, purpose: string}>,
 *   tests: string[]
 * }}
 */
function parseArchivedSpec(specPath) {
  const content = fs.readFileSync(specPath, 'utf8');
  const { frontmatter, body } = _parseFrontmatter(content);

  const specId = frontmatter.id || path.basename(specPath, '.md');
  const type = frontmatter.type || 'feature';

  // Title
  const title = _extractTitle(body);

  // --- Goal ---
  let goal = '';
  const goalAnalysisSection = _extractSection(body, 'Goal Analysis', 2);
  if (goalAnalysisSection) {
    const goalStatementSection = _extractSection(goalAnalysisSection, 'Goal Statement', 3);
    if (goalStatementSection) {
      goal = _firstParagraph(goalStatementSection);
    }
  }
  if (!goal) {
    // Fallback: first paragraph of ## Context
    const contextSection = _extractSection(body, 'Context', 2);
    goal = _firstParagraph(contextSection || body);
  }
  // Trim goal to a single sentence if possible (stop at first period followed by space or end)
  const sentenceEnd = goal.match(/^([^.!?]+[.!?])/);
  if (sentenceEnd && sentenceEnd[1].length >= 20) {
    goal = sentenceEnd[1].trim();
  }

  // --- Key Decisions ---
  let decisions = [];
  const completionSection = _extractSection(body, 'Completion', 2);
  if (completionSection) {
    const patternsSection = _extractSection(completionSection, 'Patterns Established', 3);
    if (patternsSection) {
      decisions = _extractBullets(patternsSection);
    }
  }
  if (decisions.length === 0) {
    // Fallback: ADDED/MODIFIED bullets from ## Delta
    const deltaSection = _extractSection(body, 'Delta', 2);
    if (deltaSection) {
      const addedSection = _extractSection(deltaSection, 'ADDED', 3);
      const modifiedSection = _extractSection(deltaSection, 'MODIFIED', 3);
      const addedBullets = _extractBullets(addedSection || '');
      const modifiedBullets = _extractBullets(modifiedSection || '');
      decisions = [...addedBullets, ...modifiedBullets];
    }
  }
  // Cap at 5
  decisions = decisions.slice(0, 5);

  // --- Key Files ---
  let keyFiles = [];
  if (completionSection) {
    const keyFilesSection = _extractSection(completionSection, 'Key Files', 3);
    if (keyFilesSection) {
      const bullets = _extractBullets(keyFilesSection);
      keyFiles = bullets.map(b => {
        // Format: `path/to/file.cjs` — purpose  OR  `path/to/file.cjs` purpose
        const dashSplit = b.match(/^`?([^\s`]+)`?\s+[—–-]+\s+(.+)$/);
        if (dashSplit) {
          return { path: dashSplit[1], purpose: dashSplit[2].trim() };
        }
        // Fallback: first token is path, rest is purpose
        const spaceIdx = b.indexOf(' ');
        if (spaceIdx > 0) {
          return { path: b.slice(0, spaceIdx).replace(/`/g, ''), purpose: b.slice(spaceIdx + 1).trim() };
        }
        return { path: b.replace(/`/g, ''), purpose: '' };
      });
    }
  }
  if (keyFiles.length === 0) {
    // Fallback: ADDED bullets from Delta
    const deltaSection = _extractSection(body, 'Delta', 2);
    if (deltaSection) {
      const addedSection = _extractSection(deltaSection, 'ADDED', 3);
      const bullets = _extractBullets(addedSection || '');
      keyFiles = bullets.map(b => {
        const dashSplit = b.match(/^`?([^\s`]+)`?\s+[—–-]+\s+(.+)$/);
        if (dashSplit) {
          return { path: dashSplit[1], purpose: dashSplit[2].trim() };
        }
        const spaceIdx = b.indexOf(' ');
        if (spaceIdx > 0) {
          return { path: b.slice(0, spaceIdx).replace(/`/g, ''), purpose: b.slice(spaceIdx + 1).trim() };
        }
        return { path: b.replace(/`/g, ''), purpose: '' };
      });
    }
  }
  // Cap at 6
  keyFiles = keyFiles.slice(0, 6);

  // --- Tests ---
  let tests = [];
  if (completionSection) {
    tests = _extractTestRefs(completionSection);
  }
  if (tests.length === 0) {
    tests = _extractTestRefs(body);
  }

  // --- Completed date ---
  const completed = _extractCompletedDate(completionSection || '') ||
    frontmatter.completed || '';

  return {
    specId,
    title,
    type,
    completed,
    goal,
    decisions,
    keyFiles,
    tests,
  };
}

/**
 * Render a summary markdown string from a parsed spec object and a template file.
 * Substitutes placeholders in the template with actual values.
 * Truncates decisions to top 5 and keyFiles to top 6 (already enforced by parser,
 * but re-enforced here for callers who bypass parseArchivedSpec).
 *
 * @param {{ specId, title, type, completed, goal, decisions, keyFiles, tests }} parsed
 * @param {string} templatePath - Absolute path to templates/archive-summary.md
 * @returns {string} Rendered markdown string
 */
function renderSummary(parsed, templatePath) {
  const template = fs.readFileSync(templatePath, 'utf8');

  const {
    specId,
    title,
    type,
    completed,
    goal,
    decisions,
    keyFiles,
    tests,
  } = parsed;

  // Cap arrays
  const cappedDecisions = (decisions || []).slice(0, 5);
  const cappedKeyFiles = (keyFiles || []).slice(0, 6);

  // Build decisions bullet list
  const decisionsBlock = cappedDecisions.length > 0
    ? cappedDecisions.map(d => `- ${d}`).join('\n')
    : '- (none recorded)';

  // Build key files bullet list
  const keyFilesBlock = cappedKeyFiles.length > 0
    ? cappedKeyFiles.map(kf => {
        const p = typeof kf === 'string' ? kf : kf.path;
        const pu = typeof kf === 'string' ? '' : kf.purpose;
        return pu ? `- ${p} — ${pu}` : `- ${p}`;
      }).join('\n')
    : '- (none recorded)';

  // Tests field
  const testsField = (tests && tests.length > 0) ? tests.join(', ') : 'none';

  // Substitute all placeholders
  let output = template
    // Frontmatter fields (replace globally after first-pass)
    .replace(/\{SPEC-ID\}/g, specId)
    .replace('{full title}', title || specId)
    .replace('{feature|refactor|bugfix}', type || 'feature')
    .replace('{YYYY-MM-DD}', completed || 'unknown')
    // Goal
    .replace('{one-sentence goal extracted from Goal Statement or Context}', goal || '(not extracted)')
    // Decisions block — replace the 3-line placeholder block
    .replace(
      /^- \{decision 1\}\n- \{decision 2\}\n- \{decision 3\}$/m,
      decisionsBlock
    )
    // Key files block — replace the 2-line placeholder block
    .replace(
      /^- \{path 1\} — \{one-line purpose\}\n- \{path 2\} — \{one-line purpose\}$/m,
      keyFilesBlock
    )
    // Tests
    .replace('{test/foo.test.cjs, ...} or "none"', testsField)
    // Related future specs
    .replace('{list of SPEC-IDs that reference this, or "none yet"}', 'none yet');

  return output;
}

/**
 * Orchestrate parse → render → write for a single spec.
 * Uses atomic temp-rename pattern consistent with bin/lib/core.cjs.
 *
 * @param {string} specPath - Path to source archived spec (.md)
 * @param {string} templatePath - Path to templates/archive-summary.md
 * @param {string} outputPath - Destination path for the summary (.summary.md)
 * @returns {{ written: boolean, reason?: string }}
 */
function generateSummary(specPath, templatePath, outputPath) {
  let parsed;
  try {
    parsed = parseArchivedSpec(specPath);
  } catch (e) {
    return { written: false, reason: 'parse failed: ' + e.message };
  }

  let rendered;
  try {
    rendered = renderSummary(parsed, templatePath);
  } catch (e) {
    return { written: false, reason: 'render failed: ' + e.message };
  }

  // Atomic temp-rename write
  const tmpPath = outputPath + '.tmp.' + process.pid;
  try {
    fs.writeFileSync(tmpPath, rendered, 'utf8');
    fs.renameSync(tmpPath, outputPath);
  } catch (e) {
    // Clean up temp file if it exists
    try { fs.unlinkSync(tmpPath); } catch (_) {}
    return { written: false, reason: 'write failed: ' + e.message };
  }

  return { written: true };
}

// ---------------------------------------------------------------------------
// CLI command implementations
// ---------------------------------------------------------------------------

/**
 * CLI handler for `archive summarize <SPEC-ID>`.
 * Generates (or regenerates with --force) a .summary.md for one archived spec.
 *
 * @param {string} cwd - Working directory
 * @param {string} specId - Spec ID (e.g. "SPEC-011")
 * @param {{ force?: boolean }} [opts]
 */
function cmdArchiveSummarize(cwd, specId, opts) {
  const { force = false } = opts || {};
  const archiveDir = path.join(cwd, '.specflow', 'archive');
  const specPath = path.join(archiveDir, specId + '.md');
  const outputPath = path.join(archiveDir, specId + '.summary.md');
  const templatePath = path.join(cwd, 'templates', 'archive-summary.md');

  // Validate spec exists in archive
  if (!fs.existsSync(specPath)) {
    process.stderr.write('Error: Spec not found in archive: ' + specPath + '\n');
    process.exit(1);
  }

  // Skip if summary already exists and not --force
  if (!force && fs.existsSync(outputPath)) {
    process.stdout.write(JSON.stringify({ written: false, reason: 'already exists (use --force to overwrite)', path: outputPath }, null, 2) + '\n');
    return;
  }

  const result = generateSummary(specPath, templatePath, outputPath);
  if (!result.written) {
    process.stderr.write('Error: Failed to generate summary: ' + result.reason + '\n');
    process.exit(1);
  }
  process.stdout.write(JSON.stringify({ written: true, path: outputPath }, null, 2) + '\n');
}

/**
 * CLI handler for `archive backfill [--force]`.
 * Generates summary files for all archived specs that lack them.
 * With --force, regenerates all summaries.
 *
 * @param {string} cwd - Working directory
 * @param {{ force?: boolean }} [opts]
 */
function cmdArchiveBackfill(cwd, opts) {
  const { force = false } = opts || {};
  const archiveDir = path.join(cwd, '.specflow', 'archive');
  const templatePath = path.join(cwd, 'templates', 'archive-summary.md');

  let files;
  try {
    files = fs.readdirSync(archiveDir);
  } catch (e) {
    process.stderr.write('Error: Cannot read archive directory: ' + archiveDir + '\n');
    process.exit(1);
  }

  // Identify spec files (SPEC-*.md, not *.summary.md)
  const specFiles = files
    .filter(f => f.match(/^SPEC-[A-Z0-9-]+\.md$/) && !f.endsWith('.summary.md'))
    .sort();

  const results = [];
  let written = 0;
  let skipped = 0;
  let failed = 0;

  for (const file of specFiles) {
    const specId = file.replace(/\.md$/, '');
    const specPath = path.join(archiveDir, file);
    const outputPath = path.join(archiveDir, specId + '.summary.md');

    // Skip if summary exists and not --force
    if (!force && fs.existsSync(outputPath)) {
      skipped++;
      results.push({ specId, written: false, reason: 'already exists' });
      continue;
    }

    const result = generateSummary(specPath, templatePath, outputPath);
    if (result.written) {
      written++;
      results.push({ specId, written: true, path: outputPath });
    } else {
      failed++;
      results.push({ specId, written: false, reason: result.reason });
    }
  }

  process.stdout.write(JSON.stringify({
    total: specFiles.length,
    written,
    skipped,
    failed,
    results,
  }, null, 2) + '\n');

  if (failed > 0) {
    process.exit(1);
  }
}

module.exports = { parseArchivedSpec, renderSummary, generateSummary, cmdArchiveSummarize, cmdArchiveBackfill };
