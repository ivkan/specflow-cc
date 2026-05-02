/**
 * bin/lib/lock.cjs — Advisory file-rename lock for STATE.md mutations
 *
 * IMPORTANT: AC 14 grep contract
 * All fs.writeFileSync / fs.writeFile calls targeting .specflow/STATE.md MUST go
 * through withStateLock() in THIS file. Verified by:
 *   grep -rn 'writeFileSync.*STATE\.md\|writeFile.*STATE\.md' \
 *     $(find bin -name '*.cjs') | grep -v lock.cjs
 * must return zero hits. If this file is renamed, update that grep pattern everywhere
 * it is referenced (CI checks, SPEC-011 acceptance criteria).
 *
 * Exports: withStateLock(asyncFn) → Promise<*>
 *
 * Lock mechanics:
 *   - Lock file: .specflow/.state.lock
 *   - Acquisition: fs.openSync(lockPath, 'wx') — exclusive create (atomic on POSIX + macOS + WSL)
 *   - On EEXIST: read lock file PID, send signal 0 to check liveness, clear stale lock if dead
 *   - Retry with exponential backoff, max 5 seconds total
 *   - Release: fs.unlinkSync(lockPath)
 *
 * Reentrancy (within one Node process):
 *   - Module-scope _depth counter tracks nest level
 *   - Outer call acquires OS lock and increments _depth to 1
 *   - Inner (reentrant) calls from the same process increment _depth and skip OS re-acquire
 *   - On release, decrement _depth; OS lock released only when _depth reaches 0
 *   - This is single-Node-process only — no worker_threads support
 *   - Cross-process exclusion is provided by the OS exclusive-create
 *
 * No new runtime dependencies — uses only built-in `fs` and `process`.
 */

'use strict';

const fs = require('fs');
const path = require('path');

// Module-scope reentrancy counter (single-process only)
let _depth = 0;
let _lockFd = null;

const LOCK_TIMEOUT_MS = 5000;
const RETRY_BASE_MS = 10;
const RETRY_MAX_MS = 200;

/**
 * Resolve the lock file path relative to cwd.
 * @returns {string}
 */
function getLockPath() {
  return path.join(process.cwd(), '.specflow', '.state.lock');
}

/**
 * Write PID to the lock file descriptor.
 * @param {number} fd - Open file descriptor
 */
function writePid(fd) {
  const pidStr = String(process.pid);
  fs.writeSync(fd, pidStr);
}

/**
 * Read the PID from an existing lock file.
 * Returns null if file cannot be read or doesn't contain a valid PID.
 * @param {string} lockPath
 * @returns {number|null}
 */
function readLockPid(lockPath) {
  try {
    const content = fs.readFileSync(lockPath, 'utf8').trim();
    const pid = parseInt(content, 10);
    return isNaN(pid) ? null : pid;
  } catch (_) {
    return null;
  }
}

/**
 * Check if a process with the given PID is alive using signal 0.
 * Returns true if alive, false if dead or inaccessible.
 * @param {number} pid
 * @returns {boolean}
 */
function isProcessAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    // EPERM = process exists but is owned by another user — still alive
    if (e.code === 'EPERM') return true;
    return false;
  }
}

/**
 * Attempt to clear a stale lock file.
 * Safe to call even if the file no longer exists.
 * @param {string} lockPath
 */
function clearStaleLock(lockPath) {
  try {
    fs.unlinkSync(lockPath);
  } catch (_) {
    // Ignore — another process may have cleared it already
  }
}

/**
 * Acquire the advisory file-rename lock.
 * Blocks (via async polling) until acquired or timeout exceeded.
 * @param {string} lockPath
 * @returns {Promise<number>} Resolved file descriptor
 * @throws {Error} If lock cannot be acquired within timeout
 */
async function acquireLock(lockPath) {
  const deadline = Date.now() + LOCK_TIMEOUT_MS;
  let retryMs = RETRY_BASE_MS;

  while (true) {
    try {
      // Exclusive create — atomic on POSIX, macOS, and WSL
      const fd = fs.openSync(lockPath, 'wx');
      writePid(fd);
      return fd;
    } catch (e) {
      if (e.code !== 'EEXIST') {
        throw e;
      }

      // Lock file exists — check for stale lock
      const ownerPid = readLockPid(lockPath);
      if (ownerPid !== null && !isProcessAlive(ownerPid)) {
        // Owner is dead — clear stale lock and retry immediately
        clearStaleLock(lockPath);
        continue;
      }

      // Lock is held by a live process — check timeout
      if (Date.now() >= deadline) {
        throw new Error(
          `withStateLock: could not acquire .state.lock within ${LOCK_TIMEOUT_MS}ms ` +
          `(held by PID ${ownerPid ?? 'unknown'})`
        );
      }

      // Exponential backoff
      await sleep(retryMs);
      retryMs = Math.min(retryMs * 2, RETRY_MAX_MS);
    }
  }
}

/**
 * Release the advisory lock.
 * @param {string} lockPath
 * @param {number} fd - File descriptor to close
 */
function releaseLock(lockPath, fd) {
  try {
    fs.closeSync(fd);
  } catch (_) {}
  try {
    fs.unlinkSync(lockPath);
  } catch (_) {}
}

/**
 * Simple promise-based sleep.
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Execute asyncFn inside the advisory STATE.md lock.
 *
 * Reentrant within one Node process: if this process already holds the lock
 * (_depth > 0), the inner call simply executes without re-acquiring.
 *
 * @param {Function} asyncFn - Async function to execute under lock
 * @returns {Promise<*>} Result of asyncFn
 */
async function withStateLock(asyncFn) {
  const lockPath = getLockPath();

  if (_depth > 0) {
    // Already holding the lock in this process — reentrant call
    _depth++;
    try {
      return await asyncFn();
    } finally {
      _depth--;
    }
  }

  // Outer call — acquire OS lock
  _lockFd = await acquireLock(lockPath);
  _depth = 1;

  try {
    return await asyncFn();
  } finally {
    _depth--;
    if (_depth === 0) {
      releaseLock(lockPath, _lockFd);
      _lockFd = null;
    }
  }
}

module.exports = { withStateLock };
