/**
 * test/archive-summary.test.cjs — Tests for bin/lib/archive-summary.cjs
 *
 * Covers:
 *   - parseArchivedSpec: goal extraction from ## Goal Analysis > ### Goal Statement
 *   - parseArchivedSpec: fallback to ## Context when Goal Analysis missing
 *   - parseArchivedSpec: caps decisions at 5 and key files at 6
 *   - parseArchivedSpec: older-style spec (no Goal Analysis, minimal Completion)
 *   - generateSummary: writes file with correct frontmatter
 *   - archive backfill: skips specs that already have summaries
 *   - archive backfill --force: regenerates all summaries
 *   - archive summarize <ID>: errors cleanly if spec not in archive
 */

'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  parseArchivedSpec,
  renderSummary,
  generateSummary,
  cmdArchiveSummarize,
  cmdArchiveBackfill,
} = require('../bin/lib/archive-summary.cjs');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Create a temporary directory with archive/ and templates/ for isolated tests.
 * Returns { dir, archiveDir, templatePath, cleanup }
 */
function makeTestEnv() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sf-archive-test-'));
  const archiveDir = path.join(dir, '.specflow', 'archive');
  const templatesDir = path.join(dir, 'templates');
  fs.mkdirSync(archiveDir, { recursive: true });
  fs.mkdirSync(templatesDir, { recursive: true });

  // Copy real template
  const realTemplate = path.join(__dirname, '..', 'templates', 'archive-summary.md');
  const templatePath = path.join(templatesDir, 'archive-summary.md');
  fs.copyFileSync(realTemplate, templatePath);

  function cleanup() {
    fs.rmSync(dir, { recursive: true, force: true });
  }

  return { dir, archiveDir, templatePath, cleanup };
}

/**
 * Write a fixture spec file to archiveDir and return its path.
 */
function writeFixtureSpec(archiveDir, specId, content) {
  const p = path.join(archiveDir, specId + '.md');
  fs.writeFileSync(p, content, 'utf8');
  return p;
}

// ---------------------------------------------------------------------------
// Fixture specs
// ---------------------------------------------------------------------------

const FIXTURE_WITH_GOAL_ANALYSIS = `---
id: SPEC-T01
type: feature
status: done
created: 2026-01-01
---

# SPEC-T01: Test Feature With Goal Analysis

## Context

This is the context paragraph. It has background information.

## Goal Analysis

### Goal Statement

Reduce latency of widget lookups by introducing a local cache layer.

### Observable Truths

1. Widget lookups complete in under 10ms.

## Completion

**Completed:** 2026-03-15

### Key Files

- \`lib/cache.cjs\` — LRU cache for widget data
- \`lib/widget.cjs\` — Widget loader using cache
- \`test/cache.test.cjs\` — Cache unit tests

### Patterns Established

- **Cache-aside pattern** — populate cache on miss, serve from cache on hit
- **TTL expiry** — items expire after 60 seconds to avoid stale data
- **Jest-free testing** — use node:test for zero-dep test suite

### Spec Deviations

None.
`;

const FIXTURE_WITHOUT_GOAL_ANALYSIS = `---
id: SPEC-T02
type: refactor
status: done
created: 2026-02-01
---

# SPEC-T02: Legacy Refactor Without Goal Analysis

## Context

This spec refactors the old logging system to use structured JSON output. The change improves observability.

## Delta

### ADDED

- \`lib/logger.cjs\` — Structured JSON logger, replaces old console.log calls
- \`test/logger.test.cjs\` — Logger unit tests

### MODIFIED

- \`bin/sf-tools.cjs\` — Swap console.log for logger calls throughout

## Completion

**Completed:** 2026-02-28

### Key Files

- \`lib/logger.cjs\` — Structured JSON logger
- \`test/logger.test.cjs\` — Logger tests

### Patterns Established

- **Structured logging** — always output JSON with {level, msg, ts} shape
`;

const FIXTURE_MINIMAL_OLD_SPEC = `---
id: SPEC-T03
type: feature
status: done
created: 2025-01-01
---

# SPEC-T03: Minimal Old Spec

## Context

This is an old spec that only has a context section. No Goal Analysis, no structured Completion section. The spec introduced the initial queue mechanism for ordering work items.

## Task

Implement a queue data structure.

## Acceptance Criteria

1. Queue supports enqueue and dequeue.
`;

const FIXTURE_MANY_DECISIONS = `---
id: SPEC-T04
type: feature
status: done
created: 2026-01-15
---

# SPEC-T04: Spec With Many Decisions And Files

## Context

Background context here.

## Goal Analysis

### Goal Statement

Implement a comprehensive caching layer for all database queries.

## Completion

**Completed:** 2026-04-01

### Key Files

- \`lib/cache.cjs\` — Main cache module
- \`lib/cache-lru.cjs\` — LRU eviction policy
- \`lib/cache-ttl.cjs\` — TTL expiry helper
- \`lib/cache-stats.cjs\` — Statistics collection
- \`lib/cache-warm.cjs\` — Pre-warming utilities
- \`lib/cache-serialize.cjs\` — Serialization helpers
- \`lib/cache-extra.cjs\` — Extra utilities (should be truncated)
- \`test/cache.test.cjs\` — Cache tests

### Patterns Established

- **Pattern 1** — First decision
- **Pattern 2** — Second decision
- **Pattern 3** — Third decision
- **Pattern 4** — Fourth decision
- **Pattern 5** — Fifth decision
- **Pattern 6** — Sixth decision (should be truncated)
- **Pattern 7** — Seventh decision (should be truncated)
`;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test('parseArchivedSpec: extracts goal from ## Goal Analysis > ### Goal Statement', () => {
  const { archiveDir, cleanup } = makeTestEnv();
  try {
    const specPath = writeFixtureSpec(archiveDir, 'SPEC-T01', FIXTURE_WITH_GOAL_ANALYSIS);
    const parsed = parseArchivedSpec(specPath);
    assert.ok(parsed.goal.includes('Reduce latency'), `Expected goal about latency, got: ${parsed.goal}`);
    assert.strictEqual(parsed.specId, 'SPEC-T01');
    assert.strictEqual(parsed.type, 'feature');
    assert.strictEqual(parsed.completed, '2026-03-15');
  } finally {
    cleanup();
  }
});

test('parseArchivedSpec: falls back to ## Context when Goal Analysis missing', () => {
  const { archiveDir, cleanup } = makeTestEnv();
  try {
    const specPath = writeFixtureSpec(archiveDir, 'SPEC-T02', FIXTURE_WITHOUT_GOAL_ANALYSIS);
    const parsed = parseArchivedSpec(specPath);
    // Should derive goal from Context first paragraph
    assert.ok(parsed.goal.length > 0, 'Goal should not be empty');
    assert.ok(
      parsed.goal.includes('refactor') || parsed.goal.includes('logging') || parsed.goal.includes('structured'),
      `Goal should be from Context paragraph, got: ${parsed.goal}`
    );
  } finally {
    cleanup();
  }
});

test('parseArchivedSpec: caps decisions at 5', () => {
  const { archiveDir, cleanup } = makeTestEnv();
  try {
    const specPath = writeFixtureSpec(archiveDir, 'SPEC-T04', FIXTURE_MANY_DECISIONS);
    const parsed = parseArchivedSpec(specPath);
    assert.ok(parsed.decisions.length <= 5, `Expected ≤5 decisions, got ${parsed.decisions.length}`);
  } finally {
    cleanup();
  }
});

test('parseArchivedSpec: caps key files at 6', () => {
  const { archiveDir, cleanup } = makeTestEnv();
  try {
    const specPath = writeFixtureSpec(archiveDir, 'SPEC-T04', FIXTURE_MANY_DECISIONS);
    const parsed = parseArchivedSpec(specPath);
    assert.ok(parsed.keyFiles.length <= 6, `Expected ≤6 key files, got ${parsed.keyFiles.length}`);
  } finally {
    cleanup();
  }
});

test('parseArchivedSpec: older-style spec (no Goal Analysis, minimal Completion) still produces valid output', () => {
  const { archiveDir, cleanup } = makeTestEnv();
  try {
    const specPath = writeFixtureSpec(archiveDir, 'SPEC-T03', FIXTURE_MINIMAL_OLD_SPEC);
    const parsed = parseArchivedSpec(specPath);

    // Goal derived from Context
    assert.ok(parsed.goal.length > 0, 'goal should not be empty');
    assert.ok(
      parsed.goal.includes('queue') || parsed.goal.includes('initial') || parsed.goal.includes('old spec'),
      `goal should reference context content, got: ${parsed.goal}`
    );

    // Decisions and keyFiles may be empty arrays for truly minimal specs — that is acceptable
    assert.ok(Array.isArray(parsed.decisions), 'decisions should be an array');
    assert.ok(Array.isArray(parsed.keyFiles), 'keyFiles should be an array');

    // specId and type should be populated
    assert.strictEqual(parsed.specId, 'SPEC-T03');
    assert.strictEqual(parsed.type, 'feature');
  } finally {
    cleanup();
  }
});

test('generateSummary: writes file with correct YAML frontmatter', () => {
  const { dir, archiveDir, templatePath, cleanup } = makeTestEnv();
  try {
    const specPath = writeFixtureSpec(archiveDir, 'SPEC-T01', FIXTURE_WITH_GOAL_ANALYSIS);
    const outputPath = path.join(archiveDir, 'SPEC-T01.summary.md');

    const result = generateSummary(specPath, templatePath, outputPath);
    assert.ok(result.written, 'generateSummary should return written: true');
    assert.ok(fs.existsSync(outputPath), 'summary file should exist');

    const content = fs.readFileSync(outputPath, 'utf8');
    // Frontmatter fields
    assert.ok(content.includes('spec_id: SPEC-T01'), 'should have spec_id in frontmatter');
    assert.ok(content.includes('type: feature'), 'should have type in frontmatter');
    assert.ok(content.includes('completed: 2026-03-15'), 'should have completed date in frontmatter');
    // Body
    assert.ok(content.includes('# SPEC-T01 Summary'), 'should have summary heading');
    assert.ok(content.includes('**Goal:**'), 'should have Goal field');
    assert.ok(content.includes('**Key Decisions:**'), 'should have Key Decisions field');
    assert.ok(content.includes('**Key Files:**'), 'should have Key Files field');
    assert.ok(content.includes('**Tests:**'), 'should have Tests field');
    assert.ok(content.includes('**Full Spec:**'), 'should have Full Spec link');
    assert.ok(content.includes('SPEC-T01.md'), 'should link to the full spec');
  } finally {
    cleanup();
  }
});

test('renderSummary: valid output for minimal/old spec (no Goal Analysis)', () => {
  const { archiveDir, templatePath, cleanup } = makeTestEnv();
  try {
    const specPath = writeFixtureSpec(archiveDir, 'SPEC-T03', FIXTURE_MINIMAL_OLD_SPEC);
    const parsed = parseArchivedSpec(specPath);
    const rendered = renderSummary(parsed, templatePath);

    assert.ok(typeof rendered === 'string', 'rendered should be a string');
    assert.ok(rendered.includes('spec_id: SPEC-T03'), 'should have spec_id');
    assert.ok(rendered.includes('# SPEC-T03 Summary'), 'should have heading');
    assert.ok(rendered.includes('**Goal:**'), 'should have Goal label');
    assert.ok(rendered.includes('**Key Files:**'), 'should have Key Files label');
    // Output should be 10-40 lines (not completely empty)
    const lineCount = rendered.split('\n').length;
    assert.ok(lineCount >= 10, `should have at least 10 lines, got ${lineCount}`);
  } finally {
    cleanup();
  }
});

test('cmdArchiveBackfill: skips specs that already have summaries', () => {
  const { dir, archiveDir, templatePath, cleanup } = makeTestEnv();
  try {
    // Write 2 specs
    writeFixtureSpec(archiveDir, 'SPEC-T01', FIXTURE_WITH_GOAL_ANALYSIS);
    writeFixtureSpec(archiveDir, 'SPEC-T02', FIXTURE_WITHOUT_GOAL_ANALYSIS);
    // Pre-write summary for T01
    const existingSummary = path.join(archiveDir, 'SPEC-T01.summary.md');
    fs.writeFileSync(existingSummary, '# existing content', 'utf8');

    // Capture stdout
    let output = '';
    const origWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = (chunk) => { output += chunk; return true; };
    try {
      cmdArchiveBackfill(dir, { force: false });
    } finally {
      process.stdout.write = origWrite;
    }

    const result = JSON.parse(output);
    assert.strictEqual(result.written, 1, 'should have written 1 new summary (SPEC-T02)');
    assert.strictEqual(result.skipped, 1, 'should have skipped 1 existing summary (SPEC-T01)');

    // Pre-existing summary should be unchanged
    const content = fs.readFileSync(existingSummary, 'utf8');
    assert.strictEqual(content, '# existing content', 'pre-existing summary should not be modified');
  } finally {
    cleanup();
  }
});

test('cmdArchiveBackfill --force: regenerates all summaries', () => {
  const { dir, archiveDir, cleanup } = makeTestEnv();
  try {
    writeFixtureSpec(archiveDir, 'SPEC-T01', FIXTURE_WITH_GOAL_ANALYSIS);
    writeFixtureSpec(archiveDir, 'SPEC-T02', FIXTURE_WITHOUT_GOAL_ANALYSIS);
    // Pre-write stale summaries
    fs.writeFileSync(path.join(archiveDir, 'SPEC-T01.summary.md'), '# stale T01', 'utf8');
    fs.writeFileSync(path.join(archiveDir, 'SPEC-T02.summary.md'), '# stale T02', 'utf8');

    let output = '';
    const origWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = (chunk) => { output += chunk; return true; };
    try {
      cmdArchiveBackfill(dir, { force: true });
    } finally {
      process.stdout.write = origWrite;
    }

    const result = JSON.parse(output);
    assert.strictEqual(result.written, 2, 'should have regenerated 2 summaries with --force');
    assert.strictEqual(result.skipped, 0, 'should not have skipped any with --force');

    // Verify content was actually regenerated
    const t01Content = fs.readFileSync(path.join(archiveDir, 'SPEC-T01.summary.md'), 'utf8');
    assert.ok(!t01Content.includes('# stale T01'), 'stale content should be replaced');
    assert.ok(t01Content.includes('spec_id: SPEC-T01'), 'new content should have frontmatter');
  } finally {
    cleanup();
  }
});

test('cmdArchiveSummarize: errors cleanly if spec not in archive', () => {
  const { dir, cleanup } = makeTestEnv();
  try {
    let stderrOutput = '';
    let exitCode = null;
    const origStderr = process.stderr.write.bind(process.stderr);
    const origExit = process.exit;

    process.stderr.write = (chunk) => { stderrOutput += chunk; return true; };
    process.exit = (code) => { exitCode = code; throw new Error('process.exit(' + code + ')'); };

    try {
      cmdArchiveSummarize(dir, 'SPEC-NONEXISTENT', {});
    } catch (e) {
      // process.exit was called
    } finally {
      process.stderr.write = origStderr;
      process.exit = origExit;
    }

    assert.strictEqual(exitCode, 1, 'should exit with code 1');
    assert.ok(stderrOutput.includes('not found') || stderrOutput.includes('Error'), 'should print error to stderr');
  } finally {
    cleanup();
  }
});

test('cmdArchiveBackfill idempotency: second run writes 0 files', () => {
  const { dir, archiveDir, cleanup } = makeTestEnv();
  try {
    writeFixtureSpec(archiveDir, 'SPEC-T01', FIXTURE_WITH_GOAL_ANALYSIS);

    // First run
    let out1 = '';
    const origWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = (chunk) => { out1 += chunk; return true; };
    try {
      cmdArchiveBackfill(dir, { force: false });
    } finally {
      process.stdout.write = origWrite;
    }
    const r1 = JSON.parse(out1);
    assert.strictEqual(r1.written, 1, 'first run should write 1 summary');

    // Second run — should skip the existing summary
    let out2 = '';
    process.stdout.write = (chunk) => { out2 += chunk; return true; };
    try {
      cmdArchiveBackfill(dir, { force: false });
    } finally {
      process.stdout.write = origWrite;
    }
    const r2 = JSON.parse(out2);
    assert.strictEqual(r2.written, 0, 'second run should write 0 new summaries (idempotent)');
    assert.strictEqual(r2.skipped, 1, 'second run should skip 1 existing summary');
  } finally {
    cleanup();
  }
});
