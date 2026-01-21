# Changelog

All notable changes to SpecFlow will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
