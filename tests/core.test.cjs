/**
 * tests/core.test.cjs — Tests for bin/lib/core.cjs
 *
 * Run: node tests/core.test.cjs
 */

'use strict';

const assert = require('assert').strict;
const { parseFrontmatter, generateSlug, safeReadFile } = require('../bin/lib/core.cjs');
const fs = require('fs');
const path = require('path');
const os = require('os');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log('  PASS: ' + name);
  } catch (e) {
    failed++;
    console.log('  FAIL: ' + name);
    console.log('    ' + e.message);
  }
}

console.log('core.test.cjs');
console.log('');

// --- parseFrontmatter tests ---

console.log('parseFrontmatter:');

test('valid frontmatter', () => {
  const content = '---\nid: SPEC-007\ntype: feature\nstatus: running\n---\n\n# Title\n\nBody';
  const result = parseFrontmatter(content);
  assert.equal(result.frontmatter.id, 'SPEC-007');
  assert.equal(result.frontmatter.type, 'feature');
  assert.equal(result.frontmatter.status, 'running');
  assert.ok(result.body.includes('# Title'));
  assert.ok(result.body.includes('Body'));
});

test('empty content', () => {
  const result = parseFrontmatter('');
  assert.deepEqual(result.frontmatter, {});
  assert.equal(result.body, '');
});

test('null content', () => {
  const result = parseFrontmatter(null);
  assert.deepEqual(result.frontmatter, {});
});

test('no frontmatter', () => {
  const content = '# Just a heading\n\nSome body text';
  const result = parseFrontmatter(content);
  assert.deepEqual(result.frontmatter, {});
  assert.equal(result.body, content);
});

test('malformed frontmatter (no closing ---)', () => {
  const content = '---\nid: SPEC-001\ntype: feature\nThis has no closing delimiter';
  const result = parseFrontmatter(content);
  assert.deepEqual(result.frontmatter, {});
});

test('all values returned as strings', () => {
  const content = '---\npriority: 1\ncreated: 2026-03-05\nenabled: true\ncount: 42\n---\n\nBody';
  const result = parseFrontmatter(content);
  assert.equal(typeof result.frontmatter.priority, 'string');
  assert.equal(result.frontmatter.priority, '1');
  assert.equal(typeof result.frontmatter.created, 'string');
  assert.equal(result.frontmatter.created, '2026-03-05');
  assert.equal(typeof result.frontmatter.enabled, 'string');
  assert.equal(result.frontmatter.enabled, 'true');
  assert.equal(typeof result.frontmatter.count, 'string');
  assert.equal(result.frontmatter.count, '42');
});

test('frontmatter with colons in value', () => {
  const content = '---\ntitle: My Title: A Subtitle\n---\n\nBody';
  const result = parseFrontmatter(content);
  assert.equal(result.frontmatter.title, 'My Title: A Subtitle');
});

// --- generateSlug tests ---

console.log('');
console.log('generateSlug:');

test('spaces to hyphens', () => {
  assert.equal(generateSlug('My Cool Feature'), 'my-cool-feature');
});

test('special chars removed', () => {
  assert.equal(generateSlug('My Cool Feature!'), 'my-cool-feature');
});

test('multiple spaces/special chars collapsed', () => {
  assert.equal(generateSlug('Hello   World!!!  Test'), 'hello-world-test');
});

test('unicode chars removed', () => {
  // Combining accent \u0301 with 'e' forms an accented char that gets removed
  assert.equal(generateSlug('cafe\u0301 latte'), 'cafe-latte');
});

test('empty string', () => {
  assert.equal(generateSlug(''), '');
});

test('null input', () => {
  assert.equal(generateSlug(null), '');
});

test('leading/trailing special chars trimmed', () => {
  assert.equal(generateSlug('--Hello World--'), 'hello-world');
});

// --- safeReadFile tests ---

console.log('');
console.log('safeReadFile:');

test('reads existing file', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sf-core-test-'));
  try {
    const filePath = path.join(tmpDir, 'test.txt');
    fs.writeFileSync(filePath, 'hello world', 'utf8');
    assert.equal(safeReadFile(filePath), 'hello world');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('returns null for missing file', () => {
  assert.equal(safeReadFile('/nonexistent/path/file.txt'), null);
});

// --- Summary ---

console.log('');
console.log('Results: ' + passed + ' passed, ' + failed + ' failed');

if (failed > 0) {
  process.exit(1);
}
