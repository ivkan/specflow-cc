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
 *   state get                             Current active spec, status, next step (legacy shim)
 *   state set-active <id> <status> [next] Update active spec in STATE.md (legacy shim)
 *   state list-active                     List all active specs from Active Specifications table
 *   state add-active <id> <status> <next> Append/update one row in Active Specifications table
 *   state remove-active <id>              Remove one row from Active Specifications table
 *   state resolve [id]                    Resolve active spec; emit JSON contract
 *   state migrate                         One-shot idempotent migration to new schema
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
  cmdStateRemoveActive,
  cmdStateResolve,
  cmdStateMigrate,
  cmdQueueNext,
} = require('./lib/state.cjs');
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
  state get                               Current active spec, status, next step (legacy shim)
  state set-active <id> <status> [next]   Update active spec, status, next step (legacy shim)
  state list-active                       List all rows in Active Specifications table
  state add-active <id> <status> <next>   Append/update one row (under advisory lock)
  state remove-active <id>               Remove one row (under advisory lock)
  state resolve [SPEC-ID]                Resolve active spec; emit JSON contract
  state migrate                          One-shot idempotent migration to new schema
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
