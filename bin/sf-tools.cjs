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
 *   todo load <id>                        Parse TODO file, return frontmatter + body
 *   todo list [--all]                     List all TODOs sorted by priority
 *   todo next-id                          Next available TODO-XXX number
 *   queue next                            First actionable spec from queue
 *   state get                             Current active spec, status, next step
 *   state set-active <id> <status> [next] Update active spec in STATE.md
 *   resolve-model <agent-type>            Model for agent by current profile
 *   verify-structure                      Check .specflow/ integrity
 *   generate-slug <text>                  Text to URL-safe slug
 */

'use strict';

const { output, error, generateSlug } = require('./lib/core.cjs');
const { cmdStateGet, cmdStateSetActive, cmdQueueNext } = require('./lib/state.cjs');
const { cmdSpecLoad, cmdSpecList, cmdSpecNextId } = require('./lib/spec.cjs');
const { cmdTodoLoad, cmdTodoList, cmdTodoNextId } = require('./lib/todo.cjs');
const { cmdResolveModel } = require('./lib/config.cjs');
const { cmdVerifyStructure } = require('./lib/verify.cjs');

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
  'todo load':       () => {
    if (!filteredArgs[2]) error('Missing TODO ID. Usage: todo load <id>');
    cmdTodoLoad(cwd, filteredArgs[2], raw);
  },
  'todo list':       () => cmdTodoList(cwd, raw, { showAll: flags.all ?? false }),
  'todo next-id':    () => cmdTodoNextId(cwd, raw),
  'queue next':      () => cmdQueueNext(cwd, raw),
  'state get':       () => cmdStateGet(cwd, raw),
  'state set-active': () => {
    if (!filteredArgs[2] || !filteredArgs[3]) {
      error('Missing arguments. Usage: state set-active <id> <status> [next_step]');
    }
    cmdStateSetActive(cwd, filteredArgs[2], filteredArgs[3], filteredArgs[4], raw);
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
  todo load <id>                          Parse TODO file, return frontmatter + body
  todo list [--all]                       List TODOs sorted by priority (--all includes eliminated)
  todo next-id                            Next available TODO-XXX number
  queue next                              First actionable spec from queue table
  state get                               Current active spec, status, next step
  state set-active <id> <status> [next]   Update active spec, status, next step
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
