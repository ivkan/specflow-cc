#!/usr/bin/env node

/**
 * bin/sf-tools.cjs — Centralized CLI for SpecFlow operations
 *
 * Usage: node bin/sf-tools.cjs <command> [args...]
 *
 * Commands:
 *   spec load <id>                        Parse spec file, return frontmatter + body
 *   spec list                             List all specs
 *   spec next-id                          Next available SPEC-XXX number
 *   spec validate <id>                    Validate spec frontmatter and required headings
 *   todo load <id>                        Parse TODO file, return frontmatter + body
 *   todo list [--all]                     List all TODOs sorted by priority
 *   todo next-id                          Next available TODO-XXX number
 *   todo reindex                          Regenerate INDEX.md from TODO files
 *   todo check-stale                      Report drift between TODO-*.md and INDEX.md
 *   queue next                            First actionable spec from queue
 *   queue add <id> [--title T] ...        Append/update one row in the Queue table
 *   queue remove <id>                     Remove one row from the Queue table
 *   state get                             Current active spec, status, next step (legacy shim)
 *   state set-active <id> <status> [next] Update active spec in STATE.md (legacy shim)
 *   state list-active                     List all active specs from Active Specifications table
 *   state add-active <id> <status> <next> Append/update one row in Active Specifications table
 *   state set-status <id> <status>        Update Status/Next Step of an existing row
 *   state remove-active <id>              Remove one row from Active Specifications table
 *   state add-decision <id> --summary S   Append one row to the Decisions table
 *   state rotate [--keep N]               Rotate old/oversized rows to DECISIONS_ARCHIVE.md
 *   state check                           Diagnose STATE.md size/schema/integrity (JSON)
 *   state normalize [--apply] [--force]   Report or fix table schema drift
 *   state resolve [id]                    Resolve active spec; emit JSON contract
 *   state migrate                         One-shot idempotent migration to new schema
 *
 * NEVER write .specflow/STATE.md with an editor/Write tool: the file can exceed an
 * agent's Read cap, and a full-file write after a truncated read destroys it. Every
 * mutation belongs in a `state`/`queue` subcommand here — Node has no Read cap.
 *   archive summarize <SPEC-ID>           Generate L1 summary for one archived spec
 *   archive backfill [--force]            Generate missing summaries for all archived specs
 *   recommend                             Map severity counts to recommended action
 *   resolve-model <agent-type>            Model for agent by current profile
 *   verify-structure                      Check .specflow/ integrity
 *   generate-slug <text>                  Text to URL-safe slug
 */

'use strict';

const { output, error, generateSlug } = require('./lib/core.cjs');
const {
  cmdStateGet,
  cmdStateSetActive,
  cmdStateListActive,
  cmdStateAddActive,
  cmdStateSetStatus,
  cmdStateRemoveActive,
  cmdStateResolve,
  cmdStateMigrate,
  cmdQueueNext,
} = require('./lib/state.cjs');
const { cmdStateAddDecision, cmdStateRotate } = require('./lib/state-decisions.cjs');
const { cmdStateCheck, cmdStateNormalize } = require('./lib/state-check.cjs');
const {
  cmdQueueAdd, cmdQueueRemove, cmdSetExecution, cmdClearExecution,
} = require('./lib/state-queue.cjs');
const { cmdSpecLoad, cmdSpecList, cmdSpecNextId } = require('./lib/spec.cjs');
const { cmdTodoLoad, cmdTodoList, cmdTodoNextId, cmdTodoReindex, cmdTodoCheckStale } = require('./lib/todo.cjs');
const { cmdResolveModel } = require('./lib/config.cjs');
const { cmdVerifyStructure } = require('./lib/verify.cjs');
const { cmdArchiveSummarize, cmdArchiveBackfill } = require('./lib/archive-summary.cjs');
const { recommend } = require('./lib/recommend.cjs');

const cwd = process.cwd();
const args = process.argv.slice(2);
const raw = args.includes('--raw');
const filteredArgs = args.filter(a => a !== '--raw');

/**
 * Command dispatch table.
 * Keys are "command subcommand" or just "command".
 */
const flags = {};
for (const arg of filteredArgs) {
  if (arg.startsWith('--')) {
    const key = arg.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    flags[key] = true;
  }
}

/**
 * Read a `--key value` flag. Returns undefined when absent, true when valueless.
 * @param {string} name - flag name without leading dashes
 */
function flagValue(name) {
  const i = filteredArgs.indexOf('--' + name);
  if (i === -1) return undefined;
  const v = filteredArgs[i + 1];
  return v === undefined || v.startsWith('--') ? true : v;
}

/** Positional arguments only (drops `--flag` tokens and their values). */
function positionals() {
  const out = [];
  for (let i = 0; i < filteredArgs.length; i++) {
    const a = filteredArgs[i];
    if (!a.startsWith('--')) { out.push(a); continue; }
    const v = filteredArgs[i + 1];
    if (v !== undefined && !v.startsWith('--')) i++; // skip this flag's value
  }
  return out;
}

/**
 * Run an async command, surfacing SizeError as a clean, actionable refusal.
 * Oversized cells are a CALLER error: exit 1 with a machine-readable code so the agent
 * gets told what to do instead, rather than a truncated write it never notices.
 */
function run(promise) {
  Promise.resolve(promise).catch(e => {
    if (e && e.name === 'SizeError') {
      process.stderr.write('Error: ' + e.message + '\n');
      process.stdout.write(JSON.stringify({ error: e.code, ...e.details }, null, 2) + '\n');
      process.exit(1);
    }
    error(e.message);
  });
}

const COMMANDS = {
  'spec load':       () => {
    if (!filteredArgs[2]) error('Missing spec ID. Usage: spec load <id>');
    cmdSpecLoad(cwd, filteredArgs[2], raw);
  },
  'spec list':       () => cmdSpecList(cwd, raw),
  'spec next-id':    () => cmdSpecNextId(cwd, raw),
  'spec validate':   () => {
    const specId = filteredArgs[2];
    if (!specId) {
      process.stderr.write('Error: spec validation failed: missing spec ID. Usage: spec validate <SPEC-XXX>\n');
      process.exit(1);
    }
    const { safeReadFile, parseFrontmatter } = require('./lib/core.cjs');
    const specPath = require('path').join(cwd, '.specflow', 'specs', specId + '.md');
    const content = safeReadFile(specPath);
    if (content === null) {
      process.stderr.write(`Error: spec validation failed: spec file not found at ${specPath}\n`);
      process.exit(1);
    }
    let frontmatter;
    try {
      const parsed = parseFrontmatter(content);
      frontmatter = parsed.frontmatter;
      if (!frontmatter || typeof frontmatter !== 'object') {
        throw new Error('invalid frontmatter');
      }
    } catch (e) {
      process.stderr.write('Error: spec validation failed: invalid or missing frontmatter\n');
      process.exit(1);
    }
    // Require ---...--- block to exist (parseFrontmatter returns empty obj if absent)
    if (!content.match(/^---\r?\n[\s\S]*?\r?\n---/)) {
      process.stderr.write('Error: spec validation failed: invalid or missing frontmatter\n');
      process.exit(1);
    }
    const required = ['id', 'type', 'status', 'priority'];
    for (const field of required) {
      if (!frontmatter[field]) {
        process.stderr.write(`Error: spec validation failed: missing frontmatter field '${field}'\n`);
        process.exit(1);
      }
    }
    if (!content.match(/^## Requirements/m)) {
      process.stderr.write("Error: spec validation failed: missing required heading '## Requirements'\n");
      process.exit(1);
    }
    // Success: no stdout, exit 0
    process.exit(0);
  },
  'todo load':       () => {
    if (!filteredArgs[2]) error('Missing TODO ID. Usage: todo load <id>');
    cmdTodoLoad(cwd, filteredArgs[2], raw);
  },
  'todo list':       () => cmdTodoList(cwd, raw, { showAll: flags.all ?? false }),
  'todo next-id':    () => cmdTodoNextId(cwd, raw),
  'todo reindex':    () => cmdTodoReindex(cwd, raw),
  'todo check-stale': () => cmdTodoCheckStale(cwd, raw),
  'queue next':      () => cmdQueueNext(cwd, raw),
  'queue add':       () => {
    const p = positionals();
    run(cmdQueueAdd(cwd, p[2], {
      title: flagValue('title'),
      priority: flagValue('priority'),
      status: flagValue('status'),
      complexity: flagValue('complexity'),
      dependsOn: flagValue('depends-on'),
    }, raw));
  },
  'queue remove':    () => run(cmdQueueRemove(cwd, positionals()[2], raw)),

  // Legacy shims (backwards compatible)
  'state get':       () => cmdStateGet(cwd, raw),
  'state set-active': () => {
    if (!filteredArgs[2] || !filteredArgs[3]) {
      error('Missing arguments. Usage: state set-active <id> <status> [next_step]');
    }
    Promise.resolve(cmdStateSetActive(cwd, filteredArgs[2], filteredArgs[3], filteredArgs[4], raw))
      .catch(e => error(e.message));
  },

  // New multi-spec state commands
  'state list-active': () => cmdStateListActive(cwd, raw),
  'state add-active':  () => {
    if (!filteredArgs[2] || !filteredArgs[3]) {
      error('Missing arguments. Usage: state add-active <id> <status> <next_step>');
    }
    Promise.resolve(cmdStateAddActive(cwd, filteredArgs[2], filteredArgs[3], filteredArgs[4] || '', raw))
      .catch(e => error(e.message));
  },
  'state remove-active': () => {
    if (!filteredArgs[2]) {
      error('Missing arguments. Usage: state remove-active <id>');
    }
    Promise.resolve(cmdStateRemoveActive(cwd, filteredArgs[2], raw))
      .catch(e => error(e.message));
  },
  'state set-status': () => {
    const p = positionals();
    if (!p[2] || !p[3]) {
      error('Missing arguments. Usage: state set-status <SPEC-ID> <status> [--next <step>]');
    }
    const next = flagValue('next');
    run(cmdStateSetStatus(cwd, p[2], p[3], next === true ? '' : next, raw));
  },
  'state add-decision': () => {
    const p = positionals();
    const summary = flagValue('summary');
    if (!p[2]) error('Missing arguments. Usage: state add-decision <SPEC-ID> --summary "<text>"');
    if (summary === undefined || summary === true) {
      error('Missing --summary. Usage: state add-decision <SPEC-ID> --summary "<text>"');
    }
    run(cmdStateAddDecision(cwd, p[2], summary, { force: !!flags.force, raw }));
  },
  'state rotate': () => {
    const keep = flagValue('keep');
    let n;
    if (keep !== undefined && keep !== true) {
      n = Number(keep);
      if (!Number.isInteger(n) || n < 0) error('--keep must be a non-negative integer');
    }
    run(cmdStateRotate(cwd, { keep: n, raw }));
  },
  'state set-execution': () => {
    const p = positionals();
    run(cmdSetExecution(cwd, p[2], {
      mode: flagValue('mode'),
      progress: flagValue('progress'),
    }, raw));
  },
  'state clear-execution': () => run(cmdClearExecution(cwd, positionals()[2], raw)),
  'state check': () => cmdStateCheck(cwd, raw),
  'state normalize': () => run(cmdStateNormalize(cwd, {
    apply: !!flags.apply,
    force: !!flags.force,
    raw,
  })),

  'state resolve': () => {
    // Optional specId argument (filteredArgs[2])
    cmdStateResolve(cwd, filteredArgs[2] || undefined, raw);
  },
  'state migrate': () => {
    Promise.resolve(cmdStateMigrate(cwd, raw))
      .catch(e => error(e.message));
  },

  'archive summarize': () => {
    if (!filteredArgs[2]) error('Missing SPEC-ID. Usage: archive summarize <SPEC-ID>');
    cmdArchiveSummarize(cwd, filteredArgs[2], { force: flags.force });
  },
  'archive backfill': () => {
    cmdArchiveBackfill(cwd, { force: flags.force });
  },

  'recommend':       () => {
    // Parse --source, --critical, --major, --minor from filteredArgs
    // Flags take the form: --source audit  or  --critical 2  etc.
    const flagValues = {};
    for (let i = 1; i < filteredArgs.length; i++) {
      const a = filteredArgs[i];
      if (a.startsWith('--')) {
        const key = a.slice(2);
        const val = filteredArgs[i + 1];
        if (val !== undefined && !val.startsWith('--')) {
          flagValues[key] = val;
          i++; // skip value token
        } else {
          flagValues[key] = true;
        }
      }
    }

    const source = flagValues['source'];
    if (!source || source === true) {
      process.stderr.write('Error: --source is required (audit|review)\n');
      process.exit(1);
    }

    // Parse integer counts with validation
    function parseCount(flagName) {
      const raw = flagValues[flagName];
      if (raw === undefined || raw === true) return 0;
      const n = Number(raw);
      if (!Number.isInteger(n) || n < 0) {
        process.stderr.write(`Error: --${flagName} must be a non-negative integer\n`);
        process.exit(1);
      }
      return n;
    }

    const critical = parseCount('critical');
    const major = parseCount('major');
    const minor = parseCount('minor');

    let result;
    try {
      result = recommend({ source, critical, major, minor });
    } catch (e) {
      process.stderr.write('Error: ' + e.message + '\n');
      process.exit(1);
    }

    process.stdout.write(JSON.stringify(result) + '\n');
    process.exit(0);
  },

  'resolve-model':   () => {
    if (!filteredArgs[1]) error('Missing agent type. Usage: resolve-model <agent-type>');
    cmdResolveModel(cwd, filteredArgs[1], raw);
  },
  'verify-structure': () => cmdVerifyStructure(cwd, raw),
  'generate-slug':   () => {
    if (!filteredArgs[1]) error('Missing text. Usage: generate-slug <text>');
    output({ slug: generateSlug(filteredArgs[1]) }, raw, generateSlug(filteredArgs[1]));
  },
};

function printUsage() {
  const usage = `sf-tools — SpecFlow CLI

Usage: node bin/sf-tools.cjs <command> [args...] [--raw]

Commands:
  spec load <id>                          Parse spec file, return frontmatter + body
  spec list                               List all specs from .specflow/specs/
  spec next-id                            Next available SPEC-XXX number
  spec validate <id>                      Validate spec frontmatter and required headings
  todo load <id>                          Parse TODO file, return frontmatter + body
  todo list [--all]                       List TODOs sorted by priority (--all includes eliminated)
  todo next-id                            Next available TODO-XXX number
  todo reindex                            Regenerate INDEX.md from TODO files
  todo check-stale                        Report drift between TODO-*.md and INDEX.md
  queue next                              First actionable spec from queue table
  queue add <id> [--title T] [--priority P] [--status S] [--complexity C] [--depends-on D]
                                          Append/update one row in the Queue table
  queue remove <id>                       Remove one row from the Queue table
  state get                               Current active spec, status, next step (legacy shim)
  state set-active <id> <status> [next]   Update active spec, status, next step (legacy shim)
  state list-active                       List all rows in Active Specifications table
  state add-active <id> <status> <next>   Append/update one row (under advisory lock)
  state set-status <id> <status> [--next <step>]
                                          Update Status/Next Step of an EXISTING row
  state remove-active <id>               Remove one row (under advisory lock)
  state add-decision <id> --summary "<text>" [--force]
                                          Append one row to the Decisions table
  state rotate [--keep N]                Move old/oversized rows to DECISIONS_ARCHIVE.md
  state check                            Diagnose STATE.md size, schema drift, integrity
  state normalize [--apply] [--force]    Report (or fix) table schema drift
  state resolve [SPEC-ID]                Resolve active spec; emit JSON contract
  state migrate                          One-shot idempotent migration to new schema

STATE.md discipline:
  NEVER write .specflow/STATE.md with the Write tool. It can exceed an agent's Read cap;
  a full-file write after a truncated read destroys it. Use the commands above. Cells are
  POINTERS (target 300 chars, hard cap 500) — narratives belong in the spec's Audit
  History, and 'state add-decision' records the verdict plus a link.
  archive summarize <SPEC-ID>            Generate L1 summary for one archived spec
  archive backfill [--force]             Generate missing summaries for all archived specs
  recommend                              Map severity counts to recommended action
  resolve-model <agent-type>              Resolve model for agent by current profile
  verify-structure                        Check .specflow/ directory integrity
  generate-slug <text>                    Convert text to URL-safe slug

Options:
  --raw    Output plain string instead of JSON

All commands output JSON to stdout. Errors go to stderr with exit code 1.
`;
  process.stdout.write(usage);
}

// Main dispatch
if (filteredArgs.length === 0) {
  printUsage();
  process.exit(0);
}

// Try two-word command first, then single-word
const twoWord = filteredArgs[0] + ' ' + (filteredArgs[1] || '');
const oneWord = filteredArgs[0];

if (COMMANDS[twoWord]) {
  COMMANDS[twoWord]();
} else if (COMMANDS[oneWord]) {
  COMMANDS[oneWord]();
} else {
  error('Unknown command: ' + filteredArgs.join(' ') + '. Run without arguments for usage help.');
}
