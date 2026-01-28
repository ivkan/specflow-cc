# Changelog

All notable changes to SpecFlow will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
