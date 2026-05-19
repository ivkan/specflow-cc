/**
 * bin/lib/recommend.cjs — Pure mapping module for audit/review recommendations.
 *
 * Exports: recommend({ source, critical, major, minor }) → { action, reason }
 *
 * No I/O, no state mutation, fully unit-testable.
 */

'use strict';

/**
 * Map severity counts and source to a recommended action and human-readable reason.
 *
 * @param {object} opts
 * @param {string} opts.source   - 'audit' or 'review'
 * @param {number} [opts.critical=0] - Number of critical findings
 * @param {number} [opts.major=0]    - Number of major findings (ignored for source 'audit')
 * @param {number} [opts.minor=0]    - Number of minor findings / recommendations
 * @returns {{ action: string, reason: string }}
 */
function recommend({ source, critical = 0, major = 0, minor = 0 } = {}) {
  if (source !== 'audit' && source !== 'review') {
    throw new Error(`Unknown source: ${source}. Expected 'audit' or 'review'.`);
  }

  if (
    !Number.isInteger(critical) || critical < 0 ||
    !Number.isInteger(major) || major < 0 ||
    !Number.isInteger(minor) || minor < 0
  ) {
    throw new Error('Counts must be non-negative integers.');
  }

  if (source === 'audit') {
    if (critical >= 1) {
      return { action: 'revise', reason: `${critical} critical issue(s) block execution` };
    }
    if (minor >= 1) {
      return { action: 'run --apply=minor', reason: `${minor} non-blocking recommendation(s), apply inline` };
    }
    return { action: 'run', reason: 'spec is clean, ready for execution' };
  }

  // source === 'review'
  if (critical >= 1) {
    return { action: 'fix', reason: `${critical} critical finding(s) block finalize` };
  }
  if (major >= 1) {
    return { action: 'fix', reason: `${major} major finding(s) block finalize` };
  }
  if (minor >= 1) {
    return { action: 'done --apply=minor', reason: `${minor} minor finding(s), apply inline before finalize` };
  }
  return { action: 'done', reason: 'implementation is clean, ready to finalize' };
}

module.exports = { recommend };
