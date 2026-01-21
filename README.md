# SpecFlow

**Spec-driven development system for Claude Code**

SpecFlow is a lean, audit-driven development workflow that integrates with Claude Code. It combines the best practices of specification-first development with explicit quality audits.

## Philosophy

| Principle | Description |
|-----------|-------------|
| **Spec-first** | Write specifications before code |
| **Explicit audit** | Dedicated audit phase, not just verification |
| **Fresh context** | Auditors don't see the creation process (no bias) |
| **Lean process** | Minimal commands, maximum value |
| **Human gate** | You control when to proceed (soft blocking) |
| **Token awareness** | Specs sized for single sessions (~150k tokens) |

## Installation

```bash
# Interactive mode (prompts for location)
npx specflow-cc

# Install globally (recommended)
npx specflow-cc --global

# Install to current project only
npx specflow-cc --local
```

### Options

| Flag | Description |
|------|-------------|
| `-g, --global` | Install to `~/.claude` (available in all projects) |
| `-l, --local` | Install to `./.claude` (current project only) |
| `--force-statusline` | Replace existing statusline configuration |
| `-h, --help` | Show help |

## Quick Start

```bash
# 1. Initialize project (once per project)
/sf:init

# 2. Create a specification
/sf:new "Add user authentication with JWT"

# 3. Audit the specification (fresh context)
/sf:audit

# 4. Revise if needed
/sf:revise

# 5. Execute when approved
/sf:run

# 6. Review implementation (fresh context)
/sf:review

# 7. Fix if needed
/sf:fix

# 8. Complete and archive
/sf:done
```

## Commands

### Core Workflow

| Command | Description |
|---------|-------------|
| `/sf:init` | Initialize project, analyze codebase |
| `/sf:new [description]` | Create new specification |
| `/sf:audit` | Audit specification (fresh context) |
| `/sf:revise [instructions]` | Revise spec based on audit |
| `/sf:run` | Execute specification |
| `/sf:review` | Review implementation (fresh context) |
| `/sf:fix [instructions]` | Fix based on review |
| `/sf:done` | Complete, commit, and archive |
| `/sf:status` | Show current state and next step |

### Navigation

| Command | Description |
|---------|-------------|
| `/sf:list` | List all specifications |
| `/sf:show [ID]` | Show specification details |
| `/sf:next` | Switch to next priority task |

### To-Do Management

| Command | Description |
|---------|-------------|
| `/sf:todo [text]` | Add idea or future task |
| `/sf:todos` | List all todos with priorities |
| `/sf:plan [ID]` | Convert todo into specification |
| `/sf:priority` | Interactive prioritization |

### Decomposition

| Command | Description |
|---------|-------------|
| `/sf:split [ID]` | Split large spec into smaller parts |
| `/sf:deps` | Show dependency graph |

### Session Management

| Command | Description |
|---------|-------------|
| `/sf:pause` | Save context for later |
| `/sf:resume` | Restore saved context |

### Analysis

| Command | Description |
|---------|-------------|
| `/sf:scan [--focus]` | Deep codebase analysis for concerns and tech debt |

### Utilities

| Command | Description |
|---------|-------------|
| `/sf:help [command]` | Show help for commands |
| `/sf:history [ID]` | View completed specifications |
| `/sf:metrics` | Project statistics |

## Workflow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    SPECFLOW WORKFLOW                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  /sf:init    ──→  Initialize project (once)                  │
│       ↓                                                      │
│  /sf:new     ──→  Create specification                       │
│       ↓                                                      │
│  ┌─────────────────────────────────────┐                     │
│  │  SPEC AUDIT LOOP                    │                     │
│  │  /sf:audit ──→ APPROVED? ──yes──→ ──┼──→                  │
│  │       │                             │    ↓                │
│  │       no                            │                     │
│  │       ↓                             │                     │
│  │  /sf:revise ────────→ loop back     │                     │
│  └─────────────────────────────────────┘                     │
│       ↓                                                      │
│  /sf:run     ──→  Execute specification                      │
│       ↓                                                      │
│  ┌─────────────────────────────────────┐                     │
│  │  IMPL REVIEW LOOP                   │                     │
│  │  /sf:review ──→ APPROVED? ──yes──→ ─┼──→                  │
│  │       │                             │    ↓                │
│  │       no                            │                     │
│  │       ↓                             │                     │
│  │  /sf:fix ───────────→ loop back     │                     │
│  └─────────────────────────────────────┘                     │
│       ↓                                                      │
│  /sf:done    ──→  Complete and archive                       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Project Structure

After `/sf:init`, SpecFlow creates:

```
.specflow/
├── PROJECT.md       # Project overview and patterns
├── STATE.md         # Current state and queue
├── SCAN.md          # Codebase scan results (from /sf:scan)
├── config.json      # Configuration
├── specs/           # Active specifications
│   └── SPEC-001.md
├── audits/          # Detailed audit reports (when >3 issues)
├── todos/           # Future ideas
│   └── TODO.md
└── archive/         # Completed specifications
```

## Specification Format

```markdown
---
id: SPEC-001
type: feature | refactor | bugfix
status: draft | audited | running | review | done
priority: high | medium | low
complexity: small | medium | large
created: 2026-01-20
---

# Task Title

## Context
[Why this is needed]

## Task
[What needs to be done]

## Requirements
### Interfaces
### Files to Create/Modify
### Files to Delete

## Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2

## Constraints
- [What NOT to do]

## Assumptions
- [Made by agent, verify if incorrect]
```

## Complexity Estimation

| Size | Tokens | Action |
|------|--------|--------|
| Small | ≤50k | Execute directly |
| Medium | 50-150k | Warning, proceed |
| Large | >150k | Requires `/sf:split` |

## Statusline

SpecFlow includes a statusline hook showing:
- Current model
- Active specification status `[SF: SPEC-001 running]`
- Context window usage (color-coded)

## Comparison with GSD

| Aspect | GSD | SpecFlow |
|--------|-----|----------|
| Commands | 25 | 23 |
| Agents | 11 | 7 |
| Phases per task | 5+ | 3-4 |
| Quality audit | No | Yes (explicit) |
| Revision loop | No | Yes |
| Code deletion | Not verified | Explicit checklist |
| Blocking | Hard | Soft (warning) |

## Documentation

- [Design Document](docs/DESIGN.md) — Full architecture and decisions
- [Changelog](CHANGELOG.md) — Version history

## License

MIT
