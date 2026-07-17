/**
 * tests/agent-instructions.test.cjs — Lint: no agent/command may full-Write STATE.md
 *
 * Run: node tests/agent-instructions.test.cjs
 *
 * This is the guard on the actual root cause. STATE.md can outgrow an agent's Read cap; an
 * agent that reads it truncated and writes the whole file back destroys everything past
 * the truncation point. That happened twice in a field project before this rule existed.
 *
 * The defect was never in the code — it was 11 lines of prose across 8 agent files telling
 * agents to do exactly that. Prose has no type system, so this test is the type system.
 */

'use strict';

const assert = require('assert').strict;
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIRS = ['agents', 'commands'];

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

/** Every .md file under agents/ and commands/, recursively. */
function markdownFiles() {
  const out = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.md')) out.push(p);
    }
  };
  for (const d of DIRS) {
    const p = path.join(ROOT, d);
    if (fs.existsSync(p)) walk(p);
  }
  return out;
}

const FILES = markdownFiles();

/** Lines mentioning STATE.md, with their file and 1-based line number. */
function stateLines() {
  const out = [];
  for (const f of FILES) {
    fs.readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
      if (line.includes('STATE.md')) {
        out.push({ file: path.relative(ROOT, f), line: i + 1, text: line });
      }
    });
  }
  return out;
}

console.log('agent-instructions.test.cjs');
console.log('');

test('found agent/command files to lint', () => {
  assert.ok(FILES.length > 20, 'expected >20 markdown files, got ' + FILES.length);
});

test('no file prescribes the full-Write pattern', () => {
  // The exact sentence that shipped in 8 agent files and cost the field its Decisions tail.
  const needle = 'Write tool to write the updated content';
  const hits = [];
  for (const f of FILES) {
    const content = fs.readFileSync(f, 'utf8');
    content.split('\n').forEach((line, i) => {
      if (line.includes(needle)) hits.push(`${path.relative(ROOT, f)}:${i + 1}`);
    });
  }
  assert.deepEqual(hits, [], 'full-Write prescription still present at:\n    ' + hits.join('\n    '));
});

test('no file instructs writing STATE.md with the Write tool', () => {
  // Any line that pairs STATE.md with the Write tool, unless it is a prohibition.
  const isProhibition = (t) =>
    /NEVER|never|do not|don't|instead of|rather than|not the Write/i.test(t);

  const hits = stateLines()
    .filter(l => /\bWrite tool\b/.test(l.text) && !isProhibition(l.text))
    .map(l => `${l.file}:${l.line} — ${l.text.trim().slice(0, 90)}`);

  assert.deepEqual(hits, [], 'STATE.md + Write tool without a prohibition:\n    ' + hits.join('\n    '));
});

test('no file tells an agent to rewrite/regenerate an EXISTING STATE.md', () => {
  const hits = stateLines()
    .filter(l => /\b(rewrite|regenerate|recreate|overwrite)\b/i.test(l.text))
    .filter(l => !/NEVER|never|do not|don't/i.test(l.text))
    // Creating the file when it is absent is legitimate — the hazard is rewriting a file
    // that exists and may have been read truncated.
    .filter(l => !/\b(missing|not found|absent|does not exist|NOT_INITIALIZED)\b/i.test(l.text))
    .map(l => `${l.file}:${l.line} — ${l.text.trim().slice(0, 90)}`);

  assert.deepEqual(hits, [], 'wholesale-rewrite instruction:\n    ' + hits.join('\n    '));
});

test('no file prescribes Read+Write as the STATE.md mutation method', () => {
  // Two command files carried this as POLICY ("All STATE.md mutations use Read+Write per
  // SPEC-004"), citing a spec as authority for the exact thing that destroyed the file.
  // A prohibition elsewhere in the file does not cancel a rule stated here.
  const hits = [];
  for (const f of FILES) {
    fs.readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
      if (!/Read\s*\+\s*Write|Read and Write/i.test(line)) return;
      if (/never|not a Read\+Write|supersedes/i.test(line)) return;
      hits.push(`${path.relative(ROOT, f)}:${i + 1} — ${line.trim().slice(0, 90)}`);
    });
  }
  assert.deepEqual(hits, [], 'Read+Write prescribed:\n    ' + hits.join('\n    '));
});

test('no file instructs writing an updated STATE.md', () => {
  const hits = stateLines()
    .filter(l => /\bWrite (the )?updated\b|\bwriting the updated\b/i.test(l.text))
    .filter(l => !/NEVER|never|do not|don't/i.test(l.text))
    .map(l => `${l.file}:${l.line} — ${l.text.trim().slice(0, 90)}`);
  assert.deepEqual(hits, [], 'full-file update instruction:\n    ' + hits.join('\n    '));
});

test('rotation is never gated on STATE.md line count', () => {
  // The old trigger ("if total lines > 100") never fired on the field file: 91 lines,
  // 205 KB. Rows grow in width. Any line-count gate here is the bug returning.
  const hits = [];
  for (const f of FILES) {
    const lines = fs.readFileSync(f, 'utf8').split('\n');
    lines.forEach((line, i) => {
      if (!/total lines|count.*\blines\b|lines\s*[<>]=?\s*\d+/i.test(line)) return;
      // Only care when the surrounding block is about STATE.md.
      const ctx = lines.slice(Math.max(0, i - 8), i + 8).join(' ');
      if (!/STATE\.md/.test(ctx)) return;
      if (/never|NOT gate|do not gate|rows grow/i.test(line)) return;
      hits.push(`${path.relative(ROOT, f)}:${i + 1} — ${line.trim().slice(0, 90)}`);
    });
  }
  assert.deepEqual(hits, [], 'line-count rotation gate:\n    ' + hits.join('\n    '));
});

test('every agent that mutates STATE.md carries the prohibition', () => {
  // An agent file that invokes a `state`/`queue` write command must also say why the
  // Write tool is off-limits — otherwise the next editor re-adds the old pattern.
  const WRITE_CMDS = /sf-tools\.cjs (state (set-status|add-active|add-decision|remove-active|set-execution|clear-execution|rotate)|queue (add|remove))/;
  const missing = [];

  for (const f of FILES) {
    const content = fs.readFileSync(f, 'utf8');
    if (!WRITE_CMDS.test(content)) continue;
    if (!/NEVER write `?\.specflow\/STATE\.md`? with the Write tool/i.test(content)) {
      missing.push(path.relative(ROOT, f));
    }
  }

  assert.deepEqual(missing, [], 'mutates STATE.md but lacks the prohibition:\n    ' + missing.join('\n    '));
});

test('sf-tools invocations use an absolute/expanded path, not a bare one', () => {
  // A bare `bin/sf-tools.cjs` resolves only from the repo root and silently breaks in
  // user installs — a defect this project already fixed once (v1.23.1).
  const hits = [];
  for (const f of FILES) {
    fs.readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
      if (!/sf-tools\.cjs/.test(line)) return;
      if (/(~|\$HOME|\$SF|\/)[^\s]*sf-tools\.cjs/.test(line)) return; // ~/... or $SF or /abs/...
      if (/SF=/.test(line)) return;                                    // the assignment itself
      hits.push(`${path.relative(ROOT, f)}:${i + 1} — ${line.trim().slice(0, 80)}`);
    });
  }
  assert.deepEqual(hits, [], 'bare sf-tools.cjs path:\n    ' + hits.join('\n    '));
});

console.log('');
console.log(`${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
