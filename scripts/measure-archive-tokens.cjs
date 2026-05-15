#!/usr/bin/env node
/**
 * scripts/measure-archive-tokens.cjs — L1 layer token-savings measurement
 *
 * Iterates .specflow/archive/SPEC-*.md and corresponding .summary.md files,
 * computes average line counts and approximate tokens (lines × ~12 tokens/line),
 * and prints a markdown-formatted ratio report.
 *
 * Re-runnable by future contributors to detect regression in the L1 layer's compactness.
 * No npm dependencies.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const TOKENS_PER_LINE = 12;
const archiveDir = path.join(__dirname, '..', '.specflow', 'archive');

const files = fs.readdirSync(archiveDir);
const specFiles = files
  .filter(f => f.match(/^SPEC-[A-Z0-9-]+\.md$/) && !f.endsWith('.summary.md'))
  .sort();

const rows = [];
let totalFullLines = 0;
let totalSummaryLines = 0;
let summaryCount = 0;

for (const file of specFiles) {
  const specId = file.replace(/\.md$/, '');
  const specPath = path.join(archiveDir, file);
  const summaryPath = path.join(archiveDir, specId + '.summary.md');

  const fullContent = fs.readFileSync(specPath, 'utf8');
  const fullLines = fullContent.split('\n').length;

  let summaryLines = null;
  if (fs.existsSync(summaryPath)) {
    const summaryContent = fs.readFileSync(summaryPath, 'utf8');
    summaryLines = summaryContent.split('\n').length;
    totalSummaryLines += summaryLines;
    summaryCount++;
  }

  totalFullLines += fullLines;
  rows.push({ specId, fullLines, summaryLines });
}

const avgFull = Math.round(totalFullLines / specFiles.length);
const avgSummary = summaryCount > 0 ? Math.round(totalSummaryLines / summaryCount) : 0;
const avgFullTokens = avgFull * TOKENS_PER_LINE;
const avgSummaryTokens = avgSummary * TOKENS_PER_LINE;
const reductionPct = avgSummaryTokens > 0
  ? Math.round((1 - avgSummaryTokens / avgFullTokens) * 100)
  : 0;

// Print markdown report
process.stdout.write('## L1 Archive Summary — Token-Savings Report\n\n');
process.stdout.write(`_Generated: ${new Date().toISOString().slice(0, 10)}_\n\n`);
process.stdout.write('### Methodology\n\n');
process.stdout.write(`Approximate tokens = line count × ${TOKENS_PER_LINE} tokens/line (prose estimate).\n\n`);
process.stdout.write('### Summary\n\n');
process.stdout.write(`| Metric | Value |\n`);
process.stdout.write(`|--------|-------|\n`);
process.stdout.write(`| Full specs measured | ${specFiles.length} |\n`);
process.stdout.write(`| Summaries present | ${summaryCount} |\n`);
process.stdout.write(`| Avg full spec | ${avgFull} lines / ~${(avgFullTokens / 1000).toFixed(1)}k tokens |\n`);
process.stdout.write(`| Avg summary | ${avgSummary} lines / ~${(avgSummaryTokens / 1000).toFixed(1)}k tokens |\n`);
process.stdout.write(`| Reduction | ~${reductionPct}% |\n\n`);
process.stdout.write('### Per-Spec Detail\n\n');
process.stdout.write('| Spec ID | Full (lines) | Summary (lines) | Ratio |\n');
process.stdout.write('|---------|-------------|-----------------|-------|\n');
for (const row of rows) {
  const ratio = row.summaryLines != null
    ? (row.summaryLines / row.fullLines * 100).toFixed(1) + '%'
    : 'no summary';
  process.stdout.write(`| ${row.specId} | ${row.fullLines} | ${row.summaryLines ?? '—'} | ${ratio} |\n`);
}
process.stdout.write('\n');
