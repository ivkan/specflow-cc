/**
 * bin/lib/core.cjs — Shared utilities for sf-tools CLI
 *
 * Exports: output(), error(), safeReadFile(), parseFrontmatter(), generateSlug()
 */

'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Output result to stdout as JSON, or raw string if raw flag is set.
 * @param {*} result - The result object to output
 * @param {boolean} raw - If true, output rawValue as plain string
 * @param {string} [rawValue] - Plain string to output when raw is true
 */
function output(result, raw, rawValue) {
  if (raw && rawValue !== undefined) {
    process.stdout.write(String(rawValue) + '\n');
  } else {
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  }
}

/**
 * Output error message to stderr and exit with code 1.
 * @param {string} message - Error message
 */
function error(message) {
  process.stderr.write('Error: ' + message + '\n');
  process.exit(1);
}

/**
 * Safely read a file, returning its contents as a string or null if not found.
 * @param {string} filePath - Absolute or relative path to the file
 * @returns {string|null} File contents or null
 */
function safeReadFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (e) {
    return null;
  }
}

/**
 * Parse YAML frontmatter from markdown content.
 * Expects `---` delimited YAML at the start of the file.
 * Returns simple key: value pairs only (no nested objects, no arrays).
 * All values are returned as strings. No type coercion is performed.
 *
 * @param {string} content - Full file content
 * @returns {{ frontmatter: Object, body: string }}
 */
function parseFrontmatter(content) {
  if (!content || typeof content !== 'string') {
    return { frontmatter: {}, body: content || '' };
  }

  const trimmed = content.trimStart();

  if (!trimmed.startsWith('---')) {
    return { frontmatter: {}, body: content };
  }

  // Find the closing ---
  const secondDash = trimmed.indexOf('---', 3);
  if (secondDash === -1) {
    return { frontmatter: {}, body: content };
  }

  const yamlBlock = trimmed.substring(3, secondDash).trim();
  const body = trimmed.substring(secondDash + 3).replace(/^\r?\n/, '');

  const frontmatter = {};
  const lines = yamlBlock.split('\n');

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.startsWith('#')) continue;

    const colonIndex = trimmedLine.indexOf(':');
    if (colonIndex === -1) continue;

    const key = trimmedLine.substring(0, colonIndex).trim();
    const value = trimmedLine.substring(colonIndex + 1).trim();

    // All values returned as strings — no type coercion
    frontmatter[key] = value;
  }

  return { frontmatter, body };
}

/**
 * Generate a URL-safe slug from text.
 * Lowercase, replace spaces/special chars with hyphens, collapse multiples, trim edges.
 *
 * @param {string} text - Input text
 * @returns {string} URL-safe slug
 */
function generateSlug(text) {
  if (!text || typeof text !== 'string') return '';

  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')  // replace non-alphanumeric with hyphens
    .replace(/-+/g, '-')          // collapse multiple hyphens
    .replace(/^-|-$/g, '');       // trim leading/trailing hyphens
}

module.exports = {
  output,
  error,
  safeReadFile,
  parseFrontmatter,
  generateSlug,
};
