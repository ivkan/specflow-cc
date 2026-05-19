/**
 * test/recommend.test.cjs — Tests for bin/lib/recommend.cjs
 *
 * Covers:
 * - All 6 rows of the truth table (boundary counts 0 and 1)
 * - Counts >1 for non-blocking rows (reason includes correct count)
 * - Unknown source throws
 * - Negative count throws
 * - Missing source throws
 * - CLI integration: spawn node bin/sf-tools.cjs recommend ...
 * - CLI error: missing --source → exit 1
 */

'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const { recommend } = require('../bin/lib/recommend.cjs');

const ROOT = path.resolve(__dirname, '..');

// ─── Unit tests: truth table ────────────────────────────────────────────────

test('audit, critical=0, minor=0 → run (clean)', () => {
  const r = recommend({ source: 'audit', critical: 0, minor: 0 });
  assert.equal(r.action, 'run');
  assert.equal(r.reason, 'spec is clean, ready for execution');
});

test('audit, critical=0, minor=1 → run --apply=minor (boundary)', () => {
  const r = recommend({ source: 'audit', critical: 0, minor: 1 });
  assert.equal(r.action, 'run --apply=minor');
  assert.equal(r.reason, '1 non-blocking recommendation(s), apply inline');
});

test('audit, critical=1, minor=0 → revise (boundary)', () => {
  const r = recommend({ source: 'audit', critical: 1, minor: 0 });
  assert.equal(r.action, 'revise');
  assert.equal(r.reason, '1 critical issue(s) block execution');
});

test('audit, critical=1, minor=5 → revise (critical takes priority)', () => {
  const r = recommend({ source: 'audit', critical: 1, minor: 5 });
  assert.equal(r.action, 'revise');
  assert.equal(r.reason, '1 critical issue(s) block execution');
});

test('audit, critical=0, minor=3 → run --apply=minor (count>1)', () => {
  const r = recommend({ source: 'audit', critical: 0, minor: 3 });
  assert.equal(r.action, 'run --apply=minor');
  assert.equal(r.reason, '3 non-blocking recommendation(s), apply inline');
});

test('review, critical=0, major=0, minor=0 → done (clean)', () => {
  const r = recommend({ source: 'review', critical: 0, major: 0, minor: 0 });
  assert.equal(r.action, 'done');
  assert.equal(r.reason, 'implementation is clean, ready to finalize');
});

test('review, critical=1, major=0, minor=0 → fix (critical boundary)', () => {
  const r = recommend({ source: 'review', critical: 1, major: 0, minor: 0 });
  assert.equal(r.action, 'fix');
  assert.equal(r.reason, '1 critical finding(s) block finalize');
});

test('review, critical=0, major=1, minor=0 → fix (major boundary)', () => {
  const r = recommend({ source: 'review', critical: 0, major: 1, minor: 0 });
  assert.equal(r.action, 'fix');
  assert.equal(r.reason, '1 major finding(s) block finalize');
});

test('review, critical=0, major=0, minor=1 → done --apply=minor (boundary)', () => {
  const r = recommend({ source: 'review', critical: 0, major: 0, minor: 1 });
  assert.equal(r.action, 'done --apply=minor');
  assert.equal(r.reason, '1 minor finding(s), apply inline before finalize');
});

test('review, critical=0, major=0, minor=3 → done --apply=minor (count>1)', () => {
  const r = recommend({ source: 'review', critical: 0, major: 0, minor: 3 });
  assert.equal(r.action, 'done --apply=minor');
  assert.equal(r.reason, '3 minor finding(s), apply inline before finalize');
});

test('review, critical=1, major=2, minor=3 → fix (critical takes priority)', () => {
  const r = recommend({ source: 'review', critical: 1, major: 2, minor: 3 });
  assert.equal(r.action, 'fix');
  assert.equal(r.reason, '1 critical finding(s) block finalize');
});

test('review, critical=0, major=2, minor=3 → fix (major takes priority over minor)', () => {
  const r = recommend({ source: 'review', critical: 0, major: 2, minor: 3 });
  assert.equal(r.action, 'fix');
  assert.equal(r.reason, '2 major finding(s) block finalize');
});

// ─── audit: major param is ignored ──────────────────────────────────────────

test('audit: major param is ignored — minor=0 → run (clean)', () => {
  const r = recommend({ source: 'audit', critical: 0, major: 99, minor: 0 });
  assert.equal(r.action, 'run');
});

// ─── Edge cases ──────────────────────────────────────────────────────────────

test('unknown source throws', () => {
  assert.throws(
    () => recommend({ source: 'bogus', critical: 0 }),
    /Unknown source: bogus/
  );
});

test('negative critical throws', () => {
  assert.throws(
    () => recommend({ source: 'audit', critical: -1 }),
    /Counts must be non-negative integers/
  );
});

test('negative minor throws', () => {
  assert.throws(
    () => recommend({ source: 'review', minor: -1 }),
    /Counts must be non-negative integers/
  );
});

test('negative major throws', () => {
  assert.throws(
    () => recommend({ source: 'review', major: -1 }),
    /Counts must be non-negative integers/
  );
});

test('missing source (undefined) throws', () => {
  assert.throws(
    () => recommend({ critical: 0, minor: 0 }),
    /Unknown source: undefined/
  );
});

test('float count throws', () => {
  assert.throws(
    () => recommend({ source: 'audit', critical: 1.5 }),
    /Counts must be non-negative integers/
  );
});

// ─── Default parameters ──────────────────────────────────────────────────────

test('defaults: critical/major/minor default to 0', () => {
  const r = recommend({ source: 'audit' });
  assert.equal(r.action, 'run');
});

test('review defaults: all zero → done', () => {
  const r = recommend({ source: 'review' });
  assert.equal(r.action, 'done');
});

// ─── CLI integration tests ────────────────────────────────────────────────────

test('CLI: review minor-only → done --apply=minor JSON output', () => {
  const result = spawnSync('node', [
    path.join(ROOT, 'bin/sf-tools.cjs'),
    'recommend',
    '--source', 'review',
    '--critical', '0',
    '--major', '0',
    '--minor', '3',
  ], { cwd: ROOT, encoding: 'utf8' });

  assert.equal(result.status, 0, `Expected exit 0, got ${result.status}. stderr: ${result.stderr}`);
  const parsed = JSON.parse(result.stdout.trim());
  assert.equal(parsed.action, 'done --apply=minor');
  assert.equal(parsed.reason, '3 minor finding(s), apply inline before finalize');
});

test('CLI: audit clean → run JSON output', () => {
  const result = spawnSync('node', [
    path.join(ROOT, 'bin/sf-tools.cjs'),
    'recommend',
    '--source', 'audit',
    '--critical', '0',
    '--minor', '0',
  ], { cwd: ROOT, encoding: 'utf8' });

  assert.equal(result.status, 0, `Expected exit 0, got ${result.status}. stderr: ${result.stderr}`);
  const parsed = JSON.parse(result.stdout.trim());
  assert.equal(parsed.action, 'run');
  assert.equal(parsed.reason, 'spec is clean, ready for execution');
});

test('CLI: audit with minor → run --apply=minor', () => {
  const result = spawnSync('node', [
    path.join(ROOT, 'bin/sf-tools.cjs'),
    'recommend',
    '--source', 'audit',
    '--critical', '0',
    '--minor', '2',
  ], { cwd: ROOT, encoding: 'utf8' });

  assert.equal(result.status, 0, `Expected exit 0, got ${result.status}. stderr: ${result.stderr}`);
  const parsed = JSON.parse(result.stdout.trim());
  assert.equal(parsed.action, 'run --apply=minor');
  assert.equal(parsed.reason, '2 non-blocking recommendation(s), apply inline');
});

test('CLI: audit with critical → revise', () => {
  const result = spawnSync('node', [
    path.join(ROOT, 'bin/sf-tools.cjs'),
    'recommend',
    '--source', 'audit',
    '--critical', '1',
    '--minor', '5',
  ], { cwd: ROOT, encoding: 'utf8' });

  assert.equal(result.status, 0, `Expected exit 0, got ${result.status}. stderr: ${result.stderr}`);
  const parsed = JSON.parse(result.stdout.trim());
  assert.equal(parsed.action, 'revise');
  assert.equal(parsed.reason, '1 critical issue(s) block execution');
});

test('CLI: review major present → fix', () => {
  const result = spawnSync('node', [
    path.join(ROOT, 'bin/sf-tools.cjs'),
    'recommend',
    '--source', 'review',
    '--critical', '0',
    '--major', '1',
    '--minor', '0',
  ], { cwd: ROOT, encoding: 'utf8' });

  assert.equal(result.status, 0, `Expected exit 0, got ${result.status}. stderr: ${result.stderr}`);
  const parsed = JSON.parse(result.stdout.trim());
  assert.equal(parsed.action, 'fix');
  assert.equal(parsed.reason, '1 major finding(s) block finalize');
});

test('CLI error: missing --source → exit 1, stderr contains "--source is required"', () => {
  const result = spawnSync('node', [
    path.join(ROOT, 'bin/sf-tools.cjs'),
    'recommend',
    '--critical', '0',
  ], { cwd: ROOT, encoding: 'utf8' });

  assert.equal(result.status, 1, `Expected exit 1, got ${result.status}`);
  assert.match(result.stderr, /--source is required/);
});

test('CLI error: invalid --source → exit 1, stderr contains "Unknown source"', () => {
  const result = spawnSync('node', [
    path.join(ROOT, 'bin/sf-tools.cjs'),
    'recommend',
    '--source', 'bogus',
    '--critical', '0',
  ], { cwd: ROOT, encoding: 'utf8' });

  assert.equal(result.status, 1, `Expected exit 1, got ${result.status}`);
  assert.match(result.stderr, /Unknown source/);
});
