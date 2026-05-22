# Changelog

All notable changes to SpecFlow will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.22.2] - 2026-05-22

### Fixed

- **Installed `/sf:*` commands broken on user projects** — every `/sf:*` command shipped in `commands/sf/*.md` is now safe to run from a project directory with no local `bin/`. Two bugs fixed:
  1. **Bare `bin/sf-tools.cjs` paths in 15 command files** (`audit.md`, `autopilot.md`, `discuss.md`, `done.md`, `fix.md`, `health.md`, `help.md`, `pause.md`, `review.md`, `revise.md`, `run.md`, `show.md`, `split.md`, `status.md`, `verify.md`) were rewritten to `~/.claude/specflow-cc/bin/sf-tools.cjs`. The installer rewrites this literal prefix to the actual install location, so every invocation now resolves correctly. Previously these lines errored with `Cannot find module '/path/to/project/bin/sf-tools.cjs'`.
  2. **Unsafe `state resolve $ARGUMENTS` in 8 commands** (`audit.md`, `autopilot.md`, `done.md`, `fix.md`, `pause.md`, `review.md`, `run.md`, `verify.md`) was replaced with a SPEC-ID parsing guard: `$ARGUMENTS` is split into `FIRST_TOKEN` (matched against `^SPEC-\d{3,}$`) and a per-command scope variable (`FIX_SCOPE`, `DONE_SCOPE`, `AUDIT_SCOPE`, …). Previously `/sf:fix all`, `/sf:done --apply=minor`, etc. produced spurious `SPEC_NOT_ACTIVE` errors because the scope/mode flag was passed to the resolver as if it were a SPEC-ID.

## [1.22.1] - 2026-05-20

### Fixed

- `todo next-id` now scans `.specflow/specs/` and `.specflow/archive/` for `source: TODO-XXX` frontmatter entries, preventing reissue of retired IDs. Previously, a TODO file deleted during promotion to a spec could have its ID reassigned to an unrelated new TODO, leaving downstream `/sf:plan` unable to operate on the new TODO (it rejects the ID as "already promoted").

## [1.22.0] - 2026-05-19

### Added

- **`Recommendation:` line on `/sf:audit` and `/sf:review` output** — after every audit or review, the Next Step block now includes a deterministic `**Recommendation:** {action} — {reason}` line (e.g. `done — implementation is clean, ready to finalize`, `run --apply=minor — 2 non-blocking recommendations, apply inline`, `revise — 1 critical issue blocks execution`). Removes the "what next" guesswork when the result has only non-blocking findings. Emitted by `sf-spec-auditor` and `sf-impl-reviewer` agents via a new Step 7.5 that shells out to `node bin/sf-tools.cjs recommend`. STATE.md's canonical `Next Step` is unchanged — the Recommendation line is advisory in agent output only.
- **`--apply=minor` flag on `/sf:done` and `/sf:run`** — quick-fix path for non-blocking findings. `/sf:done --apply=minor` (review path): requires spec status `review` with only Minor findings; invokes `/sf:fix --internal` to apply each finding as an atomic commit; runs project test + lint gate; on success, proceeds to standard finalization. `/sf:run --apply=minor` (audit path): requires status `audited` with only Recommendations; invokes `/sf:revise --internal`; runs structural `spec validate` gate; on success, proceeds to standard execution. **No second audit/review cycle is invoked.** Both refuse with a clear error when Critical/Major findings exist. On gate failure: applied commits remain in git, but STATE.md status is unchanged (sole rollback signal).
- **`recommend` CLI subcommand** in `bin/sf-tools.cjs` — pure mapping module exposed via `node bin/sf-tools.cjs recommend --source <audit|review> --critical N --major N --minor N`. Emits JSON `{action, reason}` to stdout. Single source of truth for the recommendation truth-table consumed by both agents and `--apply=minor` callers.
- **`spec validate` CLI subcommand** in `bin/sf-tools.cjs` — lightweight structural validation (frontmatter parses, required fields present, `## Requirements` heading present). Exits 0 on success with no stdout; exits 1 with `Error: spec validation failed: {reason}` on stderr. Used by `/sf:run --apply=minor` as the post-revise integrity gate (distinct from content-driven `/sf:audit`).
- **`--internal` flag on `/sf:fix` and `/sf:revise`** — symmetric guard that suppresses the Step 8 `state add-active` STATE.md mutation. Lets `/sf:done --apply=minor` and `/sf:run --apply=minor` shell out to the existing fix/revise machinery without losing control of the lifecycle transition. Reusable pattern for future composite commands.
- `bin/lib/recommend.cjs` — pure 57-line `recommend({source, critical, major, minor})` → `{action, reason}` function; no I/O, no state mutation. Zero new runtime npm dependencies — Node.js built-ins only.
- 39 new tests across `test/recommend.test.cjs` (28 tests: truth-table coverage, CLI integration, error cases) and `test/spec-validate.test.cjs` (11 tests: success + all five failure modes). Full suite: 93/93 pass.

### Fixed

- **Brittle hardcoded-spec test in spec-validate suite** — removed a test that referenced a live `SPEC-013.md` file, which broke the moment SPEC-013 was archived (the normal end of every spec's lifecycle). The success path is fully covered by an adjacent temp-fixture test, so the duplicate was removed rather than rewritten.

## [1.21.0] - 2026-05-15

### Added

- **L1 archive summary layer** — every archived spec now has a sibling `.specflow/archive/<SPEC-ID>.summary.md` file (~24 lines: goal, key decisions, key files, tests, completion date, link to full spec). Modelled on TencentDB Agent Memory's atomic-facts tier: agents read the summary first and drill down to the full archived spec only when the summary is insufficient. Measured against the existing 22-spec archive: ~94% token reduction when consulting completed-spec history (435-line average full spec → 24-line average summary; ~5.2k → ~0.3k tokens per spec).
- **`archive summarize <SPEC-ID>` CLI subcommand** in `bin/sf-tools.cjs` — parses an archived spec's frontmatter and `## Goal Analysis` / `## Completion` / `## Delta` sections and writes the `.summary.md` sibling via atomic temp-rename. Falls back to first paragraph of `## Context` for older specs lacking `## Goal Analysis`.
- **`archive backfill [--force]` CLI subcommand** — iterates `.specflow/archive/SPEC-*.md` and generates missing summaries. Idempotent by default (existing summaries are skipped, zero-diff on second run); `--force` regenerates everything.
- **`/sf:done` Step 8.5** — automatically generates the L1 summary for every newly archived spec. Non-fatal: summary failure logs a warning but does not abort archival (the full spec is already on disk and `archive backfill` can regenerate later).
- **Prefer-summary guidance in four agent prompts** — `sf-spec-auditor`, `sf-researcher`, `sf-spec-creator`, and `sf-spec-reviser` now read `<SPEC-ID>.summary.md` first when consulting completed-spec history. Graceful fallback: if no `.summary.md` exists (transitional state during rollout), the agent silently reads the full spec — no error, no warning.
- `bin/lib/archive-summary.cjs` — pure-Node parser/renderer/generator module (`parseArchivedSpec`, `renderSummary`, `generateSummary`); zero npm dependencies (only `fs`/`path` from stdlib); atomic temp-rename writes consistent with `bin/lib/core.cjs`.
- `templates/archive-summary.md` — canonical L1 template defining the summary structure; reviewed and stable.
- `scripts/measure-archive-tokens.cjs` — re-runnable measurement script that scans `.specflow/archive/`, computes average line counts and approximate tokens (lines × ~12 tokens/line), and prints a markdown-formatted ratio report so future contributors can detect regression in the L1 layer's compactness.
- 11 new tests in `test/archive-summary.test.cjs` covering parser correctness (extracts goal/decisions/keyFiles from fixture specs), older-style spec fallback (no `## Goal Analysis` → goal derived from `## Context`), renderer truncation caps (top 5 decisions, top 6 key files), generator atomic-write behaviour, backfill idempotency, `--force` regeneration, and `archive summarize` error paths.

## [1.20.1] - 2026-05-14

### Fixed

- **INDEX.md staleness across all TODO-mutating paths** — `1.19.0` wired the `todo reindex` helper into `/sf:todo` and `/sf:done`, but every other command that mutates `.specflow/todos/` (`/sf:plan` `rm`, `/sf:triage` create, `/sf:revise` deferred-TODO creation, `/sf:priority` priority edits, `/sf:migrate-todos`, and the `sf-spec-reviser` agent) still left INDEX.md silently out of sync. All of these now invoke `node bin/sf-tools.cjs todo reindex` after the mutation. `/sf:todos` no longer writes INDEX.md inline — it delegates to the same helper, making the reindex routine the single source of truth for INDEX layout.

### Added

- **`todo check-stale` CLI subcommand** in `bin/sf-tools.cjs` — compares the set of `TODO-*.md` files on disk to the set of IDs in `INDEX.md` and returns `{stale, index_exists, todo_count, index_count, missing_from_index, extra_in_index}`. Used by `/sf:status` as a safety-net freshness check: if any drift is detected (external edits, manual `rm`, a missed helper call), `/sf:status` surfaces an "INDEX.md stale" warning naming the specific divergences. No auto-fix — the user re-runs `/sf:todos` or the helper.
- 9 new tests in `tests/todo-index.test.cjs` covering reindex idempotency, header content, drop-after-delete, and all `check-stale` scenarios (fresh, extra-in-index, missing-from-index, no-INDEX-with-files, empty-both, raw output).

### Changed

- **INDEX.md header text** rewritten to describe actual behaviour. Old wording ("Auto-generated from individual TODO files. Do not edit manually. Regenerate with `/sf:todos`.") implied a self-maintaining file. New wording: "Cache of individual TODO files. Refreshed when `/sf:todos` runs OR when an INDEX-mutating command explicitly invokes the regen helper (`node bin/sf-tools.cjs todo reindex`). Do not edit manually — changes will be overwritten on the next regen." Applied in both `bin/lib/todo.cjs` (the source of truth) and `templates/todo-index.md`.

## [1.20.0] - 2026-05-02

### Added

- **Parallel specification execution** — STATE.md now supports multiple active specifications in a `## Active Specifications` table (multi-row registry), enabling concurrent work across separate Claude Code sessions
  - Run two specs in parallel: open a second session and either `/sf:next` or `/sf:run SPEC-XXX` — each session resolves its own target
  - Single-spec workflows are unchanged: when only one spec is active, no command requires a SPEC-ID argument
- **Advisory file-rename lock** — new `bin/lib/lock.cjs` exposes `withStateLock(fn)` to serialize STATE.md read-modify-write across concurrent processes. Uses Node's built-in `fs.openSync(path, 'wx')` + atomic-rename pattern — no native `flock(2)`, no shell-out, no new runtime dependencies. Per-process reentrancy via module-scope `_depth` counter; cross-process exclusivity via the `wx` flag
  - Includes EPERM-aware stale-PID detection (`isProcessAlive` treats EPERM as alive per POSIX semantics)
- **Centralized spec resolution** — new `bin/lib/resolve.cjs` and `node bin/sf-tools.cjs state resolve [SPEC-ID]` CLI. All 15 spec-touching commands now resolve their target spec through this single helper. Returns one of four JSON shapes:
  - `{action: "use", id: "SPEC-XXX"}` — N=1 implicit or explicit-match
  - `{action: "ask", options: [...]}` — N>1 with no SPEC-ID provided (commands present an `AskUserQuestion` picker)
  - `{action: "error", code: "NO_ACTIVE_SPEC"}` — N=0
  - `{action: "error", code: "SPEC_NOT_ACTIVE"}` — explicit SPEC-ID not in active table
- **Idempotent legacy migration** — new `bin/lib/migrate-state.cjs` upgrades old `Active Specification` / `Status` / `Next Step` triples to the new `## Active Specifications` table. Handles both heading-style and bullet-style legacy fixtures. Invoked on `/sf:health` entry; second run is zero-diff
- **New `state` subcommands** — `state list-active`, `state add-active <id> <status> <next>`, `state remove-active <id>`, `state resolve [id?]`, `state migrate`. Legacy `state get` and `state set-active` shims preserved for backwards compatibility
- **`/sf:autopilot` N>1 guard** — autopilot fails fast with an explicit message when more than one spec is active and no SPEC-ID is provided (no auto-pick, no `AskUserQuestion`). The `--all` flag does NOT override this guard; multi-spec autopilot iteration is intentionally out of scope
- 38 new tests across `test/lock.test.cjs`, `test/resolve.test.cjs`, `test/migrate.test.cjs`, `test/integration.test.cjs` — covering reentrancy, concurrent-write convergence (two child processes), all 5 resolution scenarios, both legacy formats, and end-to-end CLI flows. Full suite: 43 tests pass under Node 22's default parallel runner

### Changed

- **All 15 spec-touching commands** now use `state resolve` instead of inline STATE.md parsing: `audit`, `autopilot`, `discuss`, `done`, `fix`, `health`, `help`, `pause`, `review`, `revise`, `run`, `show`, `split`, `status`, `verify`. STATE.md mutations route through `state add-active` / `state remove-active`
- **`templates/state.md`** — replaced single-spec `Active Specification` / `Status` / `Next Step` block with `## Active Specifications` table (`| SPEC-ID | Status | Next Step |`)
- **All STATE.md writes** — every mutator in `bin/lib/state.cjs` now wraps writes in `withStateLock(...)`. The grep contract `writeFile*(STATE.md, ...)` outside `bin/lib/lock.cjs` returns zero hits; this is enforced by a top-of-file comment in `lock.cjs`

### Fixed

- **Atomic STATE.md writes** — pre-existing torn-file risk addressed: STATE.md writes now use the temp-file + rename pattern, eliminating partial reads under concurrent access (commit `e674656`)

### Migration notes

Existing projects with the legacy STATE.md schema are migrated automatically on the next `/sf:health` invocation. No manual steps required. Single-spec workflows continue to work without any user-visible change.

## [1.19.0] - 2026-04-12

### Added

- **Deferred work detection in auditor** — the auditor now detects deferred work items (TODOs, FIXMEs, placeholder implementations) in the spec and flags them as findings (step 3.9.5)

### Fixed

- **TODO INDEX.md auto-sync** — `INDEX.md` in `.specflow/todos/` was getting out of sync because `/sf:todo` and `/sf:done` modified TODO files without regenerating the index. Added `todo reindex` command to `sf-tools.cjs` and wired it into both `/sf:todo` (Step 6.5) and `/sf:done` (Step 7.5, after TODO file deletion)

## [1.18.3] - 2026-04-11

### Fixed

- **Auto-heal for users upgrading from 1.18.0 / 1.18.1** — the installer now scans `hooks.PostToolUse` during every install and removes any flat `{ type, command }` entry that references `context-monitor`. These entries were written by the buggy `1.18.0`/`1.18.1` installer and would otherwise linger in `settings.json` next to the newly written correct matcher group, still tripping Claude Code's `"Expected array, but received undefined"` parse error. Foreign flat entries (belonging to other tools) are left untouched — only entries unambiguously written by prior SpecFlow versions are removed.
- Three new smoke tests cover clean auto-heal, preservation of foreign flat entries, and the mixed state (pre-existing correct hook + flat broken duplicate).

## [1.18.2] - 2026-04-11

### Fixed

- **Installer no longer corrupts `settings.json`** — the installer wrote the `context-monitor` PostToolUse hook as a flat `{ type, command }` object, but Claude Code expects every `PostToolUse` entry to be a matcher group of the shape `{ matcher?, hooks: [{ type, command }] }`. Claude Code failed to parse `settings.json` with `"Expected array, but received undefined"`, and permission rules in the affected file were silently disabled
  - The hook is now written as a proper matcher group
  - Broken duplicate-detection fixed: the installer previously checked `entry.command` on the top-level entry, but in the correct format the command lives inside `entry.hooks[i].command`. As a result, every repeat install pushed a new (broken) entry. Detection now walks `entry.hooks[]` and matches the existing hook correctly, so repeat installs are idempotent
  - Smoke test extended with four new cases: format assertion, presence check, repeat-install idempotency, and preservation of a pre-existing correctly-formatted hook
  - **Heads-up:** if you already ran `1.18.0` or `1.18.1` against a `settings.json` that had a pre-existing PostToolUse hook, you may have a duplicate flat entry. Remove any `PostToolUse` element that lacks a `hooks:` array (i.e. has `type`/`command` at the top level) and re-run the installer

## [1.18.1] - 2026-04-11

### Fixed

- **Installer now copies `bin/`** — the installer previously shipped `agents/`, `templates/`, `commands/`, and `hooks/` into `~/.claude/specflow-cc/` but never copied `bin/`, so any slash command invoking `node bin/sf-tools.cjs ...` failed with `MODULE_NOT_FOUND` in user projects. Affected commands: `/sf:todos`, `/sf:priority`, `/sf:metrics`, `/sf:plan`, `/sf:triage`, `/sf:revise`, `/sf:todo`
  - Installer now copies `bin/` recursively (excluding `install.js` itself) via the existing `copyWithPathReplacement` helper
  - All 12 affected command invocations rewritten to use the absolute path `node ~/.claude/specflow-cc/bin/sf-tools.cjs` (auto-rewritten to `./.claude/specflow-cc/` for local installs by the existing path-replacement pass)
  - New smoke test `tests/install-bin-cli.test.cjs` runs the full installer in a temp project and invokes the installed CLI end-to-end, preventing regression

## [1.18.0] - 2026-04-08

### Added

- **Per-file TODO storage** — TODOs migrated from monolithic `TODO.md` to individual `TODO-XXX.md` files with YAML frontmatter, mirroring the established `SPEC-XXX.md` pattern
  - Each TODO is now a standalone file in `.specflow/todos/` with structured metadata (id, title, priority, complexity, status, effort, depends_on, created)
  - Auto-generated `INDEX.md` serves as a human-readable cache, regenerated by `/sf:todos`
  - New `bin/lib/todo.cjs` utility module with `cmdTodoLoad`, `cmdTodoList`, `cmdTodoNextId` functions
  - New CLI commands: `todo load <id>`, `todo list [--all]`, `todo next-id`
  - New `/sf:migrate-todos` command for one-time migration from legacy format (with `--dry-run` support)
  - Backward compatibility: projects with legacy `TODO.md` continue to work transparently
  - Eliminated TODOs use `status: eliminated` soft-delete instead of file deletion, preserving history
- **Updated commands** — all 10 TODO-touching commands and 3 agents updated to use per-file format:
  `sf:todo`, `sf:todos`, `sf:plan`, `sf:done`, `sf:priority`, `sf:triage`, `sf:revise`, `sf:health`, `sf:status`, `sf:metrics`, `sf:init`, `spec-reviser`, `spec-creator`
- **New health checks** — W009 (TODO file without valid frontmatter), W010 (legacy TODO.md alongside per-file TODOs)

### Fixed

- **W001 health check** — now checks for `todos/` directory instead of `TODO.md` file

## [1.17.1] - 2026-04-07

### Fixed

- **TODO.md data loss prevention** — all 6 commands that modify TODO.md now use the `Edit` tool (targeted diff) instead of `Write` (full rewrite), preventing the agent from accidentally dropping entries when reconstructing large files
  - Affected: `sf:todo`, `sf:plan`, `sf:done`, `sf:triage`, `sf:priority`, `spec-reviser`
  - `Write` is now only used for initial TODO.md creation; all subsequent modifications use `Edit`
  - Each command includes explicit "CRITICAL: never rewrite the entire file" guardrails

## [1.17.0] - 2026-03-29

### Added

- **Defer-to-TODO enforcement** — when spec-reviser defers requirements during scope reduction, TODOs are now automatically created in `.specflow/todos/TODO.md`
  - New Step 5.5 in spec-reviser agent: mandatory TODO creation for every deferred item
  - Revise command fallback mode also enforces TODO creation for deferred items
  - Spec-auditor now reminds that removed requirements must be captured as TODOs when recommending scope reduction
  - Closes a process gap where deferred work could be silently lost (discovered via SPEC-159 incident)

## [1.16.0] - 2026-03-23

### Added

- **Brownfield / Delta Specifications** — spec-creator now detects existing implementations and generates a `## Delta` section describing only what changes, preserving what already works
- **Delta validation in spec-auditor** — auditor validates delta sections for completeness and correctness in brownfield specs
- **Changes Applied subsection** in `/sf:done` — delta spec completion summaries now include a dedicated section listing what was actually changed

### Fixed

- **Init re-initialization safety** — `/sf:init` now safely handles re-initialization without overwriting existing `.specflow/` state
- **Deviations subsection disambiguation** — delta completion template no longer collides subsection names when both Deviations and Delta Deviations are present

## [1.15.0] - 2026-03-11

### Fixed

- **TODO lifecycle cleanup** — TODOs now reliably removed when converted to specs via `/sf:plan` and completed via `/sf:done`
  - `spec-creator` agent writes `source: TODO-XXX` in spec frontmatter when created from a todo
  - `/sf:plan` Step 7 marked as CRITICAL with mandatory verification (re-reads TODO.md after removal)
  - `/sf:done` adds Step 7.5 safety net: checks spec `source:` field and cleans up any remaining TODO
  - Spec template updated with optional `source:` frontmatter field

## [1.14.1] - 2026-03-05

### Added

- **Context Monitor Hook** — agent-facing context awareness via PostToolUse hook
  - Statusline writes bridge file to `/tmp/claude-ctx-{session}.json`
  - New `hooks/context-monitor.js` reads metrics and injects WARNING (35% remaining) / CRITICAL (25%) warnings into agent context
  - Debounce (5 tool uses between warnings), severity escalation bypasses debounce
  - Integrates with `/sf:pause` for graceful session saves
  - Installer auto-registers the hook in settings.json

- **`/sf:health`** — diagnose `.specflow/` directory integrity
  - 13 error codes across 3 severity levels (error, warning, info)
  - Checks: STATE.md integrity, orphaned specs, queue consistency, missing directories, stale execution state
  - `--repair` flag for safe auto-fixes (create missing dirs, regenerate STATE.md, clear stale state)
  - Repair verification: re-runs checks after repair to confirm resolution

- **`/sf:validate`** — run validation checklist from specification
  - Executes automated checks (test commands), code verifications (grep/glob), and manual prompts
  - Pass/fail report per checklist item with overall validation status
  - Graceful handling when spec has no validation checklist

- **Validation Checklist in spec template** — spec-creator generates `## Validation Checklist` section for medium/large specs
  - 3-5 concrete verification steps with expected outcomes
  - Each item: action + expected result (e.g., "Run `npm test` — all pass")

- **Enriched completion summaries** in `/sf:done`
  - New sections: Outcome, Key Files, Patterns Established, Deviations
  - Decisions extracted from both spec content and completion section

- **Centralized CLI Tooling** (`bin/sf-tools.cjs`) — single Node.js CLI for SpecFlow operations
  - `spec load <id>` — parse spec file, return frontmatter + sections as JSON
  - `spec list [--status <s>]` — list specs with optional status filter
  - `spec next-id` — next available SPEC-XXX number (checks specs/ + archive/)
  - `queue next` — first actionable spec from queue
  - `state get` / `state set-active <id> <status>` — STATE.md CRUD
  - `resolve-model <agent-type>` — model resolution by profile
  - `verify-structure` — `.specflow/` integrity checks
  - `generate-slug <text>` — URL-safe slug generation
  - Modular architecture: `bin/lib/core.cjs`, `state.cjs`, `spec.cjs`, `config.cjs`, `verify.cjs`
  - 42 tests using Node.js `assert` (no external dependencies)

### Fixed

- Parent spec now correctly archived after `/sf:split`
- `.specflow/` directory excluded from git tracking

---

## [1.13.0] - 2026-02-11

### Added

- **Autopilot mode** (`/sf:autopilot`) — run the full spec lifecycle autonomously
  - Single spec: `/sf:autopilot` or `/sf:autopilot SPEC-XXX`
  - Batch mode: `/sf:autopilot --all` processes entire queue sequentially
  - Cycle detection: configurable limits for audit (default: 3) and fix (default: 3) cycles
  - Graceful halt on `needs_decomposition` or `paused` specs
  - Summary report with per-spec outcomes and cycle counts
  - Agent failure handling: continues batch on single-spec failure
  - Configurable via `.specflow/config.json` under `"autopilot"` key

### Changed

- **Replaced all Bash/awk/sed markdown mutations** with Read+Write tool instructions across 13 agent and command files
  - Eliminates fragile shell-based file editing that could corrupt markdown structure
  - All STATE.md, spec, and archive updates now use explicit Read→Write pattern
  - Affected: spec-creator, spec-auditor, spec-reviser, spec-splitter, spec-executor, spec-executor-orchestrator, impl-reviewer, and 6 command files

- `/sf:help` — added Autonomous Execution section with autopilot commands
- README — added autopilot to workflow diagram, commands table, and typical session

---

## [1.12.0] - 2026-02-10

### Added

- **Language Profiles** — optional, per-language configuration in PROJECT.md that adapts all agents to language-specific needs
  - `/sf:init` auto-detects language from `Cargo.toml` (Rust), `go.mod` (Go), `tsconfig.json` (TypeScript), `pyproject.toml` (Python)
  - Generates `## Language Profile` section in PROJECT.md with build/lint/test commands, max files per spec, compilation gate, and trait-first settings
  - Projects without a detected language remain fully language-agnostic (backward-compatible)

- **Compilation gates** — incremental build verification during implementation (Rust, Go)
  - `spec-executor` and `spec-executor-worker` run `build_check` command after each file or tightly coupled group
  - Build failures auto-fixed before proceeding (Rule 3: blocking issues)
  - Lint check runs at end of implementation scope
  - New `build_check` field in worker JSON result protocol

- **Trait-first enforcement** — compiled languages require type/trait design before implementation
  - `spec-creator` mandates G1/Wave 1 as types-only when `Trait-first: Yes`
  - `spec-auditor` validates trait-first compliance (Critical if G1 mixes traits and implementation)
  - Prevents cascading rework from wrong trait boundaries in Rust/Go

- **Language-aware spec sizing** — file count limits adapted per language
  - Rust: 3-5 files max (borrow checker errors cascade)
  - Go: 5-8 files max
  - TypeScript/Python: 8-10 files max
  - `spec-auditor` raises Warning/Critical when file count exceeds language profile limit

- **Language-specific review gates** in `impl-reviewer`
  - Runs build, lint, and test commands from profile as review gates
  - Rust idiom checks: no unnecessary `.clone()`, `?` operator over `.unwrap()`, `unsafe` documentation, `Send + Sync` bounds
  - Go idiom checks: error returns over panics, interfaces accepted/structs returned, context propagation

### Changed

- `templates/project.md` — added optional Language Profile section
- `spec-auditor` — added Step 3.10 (Language Profile Check) with 5 sub-checks and scope threshold override
- `spec-creator` — added language-specific sizing table and trait-first override in task group generation

---

## [1.11.1] - 2026-02-10

### Fixed

- **Orchestrator premature state advancement** — executor agents could advance STATE.md beyond "review", skipping the review step entirely
  - After `/sf:run` completion, the orchestrator would sometimes perform `/sf:done` logic (moving spec to Completed, activating next spec)
  - Root cause: vague instructions in STATE.md update step allowed LLM agents to over-interpret "update STATE.md"
  - Added explicit boundary instructions ("DO NOT move to Completed, DO NOT activate next spec") to all three executor agents
  - Added post-execution state verification guard in `/sf:run` command handler
  - Affected files: `sf-spec-executor-orchestrator.md`, `spec-executor-orchestrator.md`, `spec-executor.md`, `run.md`

---

## [1.11.0] - 2026-02-06

### Added

- **Self-check verification** — all executor agents now verify their own claims before reporting completion
  - `spec-executor`: checks created files exist on disk, commits in git, modified files contain expected changes
  - `spec-executor-worker`: self-check step before returning JSON results; new `self_check` field in response protocol
  - Both orchestrators: aggregated self-check verifying all worker claims against reality
  - Agents refuse to report success if artifacts are missing

- **Segmented execution** — large task groups automatically split into sequential segments with fresh context
  - Orchestrators evaluate segmentation threshold (Est. Context >= 20%)
  - Each segment runs in a fresh worker subagent to prevent quality degradation
  - Handoff summaries pass key exports and interface signatures between segments
  - Segment results aggregated into single group result for downstream processing
  - Segment failure handling: abort remaining segments on failure, continue on partial

- **Wave column in spec creation** — `spec-creator` and `spec-splitter` now always generate a `Wave` column in Implementation Tasks tables
  - Pre-computed wave numbers during spec creation (not during execution)
  - Orchestrators read wave numbers directly instead of computing dependency graphs
  - Fallback for legacy specs without Wave column preserved

### Changed

- **Enhanced deviation rules** — all executor agents now include detailed examples, rule priority order, and edge case guidance
  - Rule priority: Rule 4 (architectural) overrides all; Rules 1-3 auto-fix; unsure defaults to Rule 4
  - Standardized tracking format: `[Rule N - Type] {description}`

- **Auditor segment hints** — `spec-auditor` can now flag task groups that should be pre-segmented based on estimated context

---

## [1.10.0] - 2026-02-06

### Added

- **"max" model profile** — uses Opus for all agent types (spec-creator, spec-executor, impl-reviewer, researcher, codebase-scanner, etc.)
  - Existing profiles unchanged: `quality`, `balanced`, `budget`
  - Set `"model_profile": "max"` in `.specflow/config.json` to enable
  - Affected files: all 11 command files + orchestrator agent

---

## [1.9.4] - 2026-02-05

### Fixed

- **Spec ID collision bug** — numbering now checks both `specs/` and `archive/` directories
  - Previously, when all specs were archived, new specs would start from SPEC-001 again
  - This caused ID collisions with archived specs
  - Affected files: `spec-creator.md`, `new.md`

### Added

- **State consistency validation** in `/sf:status` (Step 4.5)
  - Detects orphan specs (files in `specs/` but STATE.md shows "None")
  - Detects duplicate IDs (same spec in both `specs/` and `archive/`)
  - Provides actionable warnings with suggested fixes

---

## [1.9.1] - 2026-02-02

### Fixed

- Added `/clear` tips before `/sf:audit` in all spec creation flows (`/sf:plan`, `/sf:split`)

---

## [1.9.0] - 2026-02-02

### Added

- **Project Compliance audit dimension** — 10th dimension in spec-auditor
  - Verifies specification honors PROJECT.md decisions and constraints
  - Checks for out-of-scope intrusion (deferred items included in scope)
  - Reports violations as Critical issues, deviations as Recommendations

- **Clear context tips** — UX improvement for context-heavy operations
  - After `/sf:revise` → tip to `/clear` before audit
  - After `/sf:audit` APPROVED → tip to `/clear` before run

### Fixed

- Context bar scaling in statusline now shows 100% at actual 80% limit (Claude Code's enforced ceiling)

---

## [1.7.2] - 2026-01-30

### Changed

- Standardized output format across all commands:
  - Unified bullet points to `•` for options
  - Unified "Next Step" section naming (singular)
  - Unified file reference format with 📄 emoji
  - Replaced `<sub>` tags with "Tip:" and "Note:" prefixes

---

## [1.7.1] - 2026-01-30

### Fixed

- `/sf:audit` now shows `/sf:revise` option when recommendations exist (previously only showed `/sf:run`)

---

## [1.7.0] - 2026-01-28

### Added

- **AI pre-analysis of external feedback** — `/sf:revise` now analyzes imported external audit items before showing review options
  - Provides recommendations: ✓ Apply / ? Discuss / ✗ Skip with reasoning
  - New "Apply recommended" option to apply only recommended items
  - `--no-analysis` flag to skip pre-analysis and go directly to manual review

### Changed

- `/sf:audit --import` workflow now flows through AI analysis step by default
- Updated help documentation with new flag

---

## [1.6.3] - 2026-01-28

### Added

- `/sf:audit --import "feedback"` — Import external feedback (code reviews, security audits) for critical evaluation
- `/sf:revise` detects external audits and offers per-item evaluation (Apply/Skip/Discuss/Defer)
- New `external_review` status in state machine
- Strategic sanity check in auditor agents

---

## [1.6.0] - 2026-01-25

### Added

#### Commands
- `/sf:quick` — Fast track for trivial tasks (skip full audit/review workflow)
- `/sf:verify` — Interactive user acceptance testing after implementation
- `/sf:discuss --pre "topic"` — Pre-specification discussion with feature-type-specific questions
- `/sf:new --discuss PRE-XXX` — Create spec with prior discussion context

#### Features
- **Model profiles** — Control cost vs quality (`quality`, `balanced`, `budget`) in config.json
- **Pre-spec discussion** — Identifies gray areas based on feature type (visual, API, CLI, data, refactor)
- **Feature-type question banks** — 5-10 targeted questions per feature type
- **STATE.md size management** — Automatic decision archiving when exceeding 100 lines
- **Wave-based parallel execution** — Large specs auto-decompose into parallel waves
- **Orchestrator/worker architecture** — Fresh context per execution task

#### Agents
- Enhanced `spec-executor-orchestrator` — Pre-computed waves, checkpoint support
- Enhanced `spec-executor-worker` — Atomic commits, state verification
- Enhanced `discusser` — Feature-type detection, question banks, PRE-XXX file format

### Changed

- README completely rewritten for better user experience
- `/sf:done` workflow now includes optional `/sf:verify` step
- Pause/resume supports orchestrated execution checkpoints
- Queue position is now source of truth for `/sf:next`

---

## [1.5.3] - 2026-01-22

### Changed

- `spec-auditor` now checks 8 quality dimensions (added: architecture fit, non-duplication, cognitive load)
- `impl-reviewer` now checks 8 quality dimensions (added: architecture, non-duplication, cognitive load)
- Enhanced integration checks for natural codebase fit
- Reviewers verify code doesn't reinvent existing solutions
- Both agents evaluate maintainability and developer experience

---

## [1.5.2] - 2026-01-22

### Fixed

- `/sf:review` now offers `/sf:fix` option when APPROVED with minor issues
- impl-reviewer agent output distinguishes "no issues" vs "with minor issues"

---

## [1.5.1] - 2026-01-22

### Added

- Direct question mode for `/sf:discuss` — quick single-question clarification
- Example: `/sf:discuss "Should we use Redis or in-memory cache?"`

### Changed

- README updated with direct question examples
- Help examples expanded for `/sf:discuss`

---

## [1.5.0] - 2026-01-22

### Added

- `/sf:discuss` — Interactive Q&A to clarify requirements and resolve ambiguities
- `discusser` agent — Conducts focused discussions with clear options
- `.specflow/discussions/` directory for discussion records
- Discuss hints after `/sf:new` and `/sf:audit` (NEEDS_REVISION)

### Changed

- Help section "Research & Analysis" renamed to "Research & Clarification"

---

## [1.4.0] - 2026-01-21

### Added

- `/sf:research` — Research topics before creating specifications
- `researcher` agent — Explores codebase and web for findings
- `research.md` template — Structured research document format
- `--research RES-XXX` flag for `/sf:new` — Include research as spec context
- `.specflow/research/` directory created on init

### Changed

- `/sf:help` now includes Research & Analysis section
- Quick start guide updated with optional research step

---

## [1.3.1] - 2026-01-21

### Fixed

- Command format in installer output: `/sf init` → `/sf:init`

---

## [1.3.0] - 2026-01-21

### Added

- File path links in command output (`📄 File: .specflow/specs/SPEC-XXX.md`)
- `/clear` hints before fresh context commands (audit, review)

### Changed

- All command outputs now include direct links to spec files
- Workflow hints remind users to clear context before auditor/reviewer steps

---

## [1.2.0] - 2026-01-20

### Fixed

- Command format: `/sf run` → `/sf:run` (matches Claude Code syntax)

### Changed

- `/sf:audit` now shows alternative next steps when APPROVED with recommendations
- `/sf:review` now shows alternative next steps when APPROVED with minor suggestions
- User can choose to proceed or apply optional feedback first

---

## [1.1.0] - 2026-01-20

### Added

#### Analysis Commands
- `/sf:scan [--focus]` - Deep codebase analysis for tech debt, concerns, and improvement opportunities

#### Agents
- `codebase-scanner` - Analyzes codebase and writes structured SCAN.md report

#### Templates
- `scan.md` - Codebase scan report template

---

## [1.0.0] - 2026-01-20

### Added

#### Core Commands
- `/sf init` - Initialize SpecFlow in project with codebase analysis
- `/sf new` - Create new specification with complexity estimation
- `/sf audit` - Audit specification in fresh context
- `/sf revise` - Revise specification based on audit feedback
- `/sf run` - Execute specification with deviation rules
- `/sf review` - Audit implementation in fresh context
- `/sf fix` - Fix implementation based on review feedback
- `/sf done` - Finalize specification and archive
- `/sf status` - Show current project state

#### Navigation Commands
- `/sf list` - List all active specifications
- `/sf show [ID]` - Display specification details
- `/sf next` - Switch to next highest-priority task

#### Session Commands
- `/sf pause` - Save context for session pause
- `/sf resume` - Restore context from paused session

#### To-Do Commands
- `/sf todo [text]` - Add future idea or task
- `/sf todos` - List all todos with priorities
- `/sf plan [ID]` - Convert todo into specification
- `/sf priority` - Interactive prioritization

#### Decomposition Commands
- `/sf split [ID]` - Split large spec into smaller parts
- `/sf deps` - Show dependency graph

#### Utility Commands
- `/sf help [command]` - Command reference
- `/sf history [ID]` - History of completed specs
- `/sf metrics` - Project statistics

#### Agents
- `spec-creator` - Creates specifications from task descriptions
- `spec-auditor` - Audits specifications for clarity and completeness
- `spec-executor` - Executes specifications with deviation rules
- `impl-reviewer` - Reviews implementation against specification
- `spec-reviser` - Revises specifications based on audit feedback
- `spec-splitter` - Splits large specifications into smaller parts

#### Templates
- `spec.md` - Specification template
- `project.md` - Project overview template
- `state.md` - State tracking template
- `todo.md` - To-do list template
- `audit.md` - Audit report template

#### Infrastructure
- `bin/install.js` - npx-based installer
- `hooks/statusline.js` - Claude Code statusline integration

### Philosophy
- Spec-first development workflow
- Explicit audit cycles (not just verification)
- Fresh context for audits (no bias)
- Lean process (minimum commands, maximum utility)
- Human gate (soft blocking with warnings)
- Hybrid audit storage (inline ≤3 comments, separate file >3)
- Token awareness with complexity estimation
