# SpecFlow

**Spec-driven development for Claude Code**

Write specs first, audit them, then implement. Quality through explicit review cycles.

## Installation

```bash
npx specflow-cc --global
```

## Quick Start

```bash
/sf:init                    # Initialize project (once)
/sf:new "add user auth"     # Create specification
/sf:audit                   # Audit spec (fresh context)
/sf:run                     # Implement
/sf:review                  # Review implementation
/sf:done                    # Complete and archive
```

## Workflow

```
/sf:new  →  /sf:audit  →  /sf:run  →  /sf:review  →  /sf:done
              ↓                          ↓
         /sf:revise                  /sf:fix
         (if needed)                 (if needed)
```

**Key principle:** Audits and reviews run in fresh context — no bias from creation.

## Commands

### Core Flow

| Command | Description |
|---------|-------------|
| `/sf:init` | Initialize project |
| `/sf:new` | Create specification |
| `/sf:audit` | Audit spec (fresh context) |
| `/sf:revise` | Revise based on audit |
| `/sf:run` | Implement spec |
| `/sf:review` | Review implementation |
| `/sf:fix` | Fix based on review |
| `/sf:done` | Complete and archive |

### Before You Spec

| Command | Description |
|---------|-------------|
| `/sf:research` | Research topic, save findings |
| `/sf:discuss` | Clarify requirements via Q&A |
| `/sf:scan` | Analyze codebase for issues |

### Navigation

| Command | Description |
|---------|-------------|
| `/sf:status` | Current state and next step |
| `/sf:list` | All specifications |
| `/sf:next` | Switch to priority task |
| `/sf:show` | View spec details |

### Backlog

| Command | Description |
|---------|-------------|
| `/sf:todo` | Add future idea |
| `/sf:todos` | List all todos |
| `/sf:plan` | Convert todo to spec |
| `/sf:priority` | Reprioritize |

### Utilities

| Command | Description |
|---------|-------------|
| `/sf:split` | Break large spec into parts |
| `/sf:deps` | Show dependencies |
| `/sf:pause` | Save session context |
| `/sf:resume` | Restore session |
| `/sf:help` | Command reference |

## Project Structure

```
.specflow/
├── PROJECT.md      # Project context
├── STATE.md        # Current state
├── specs/          # Active specs
├── research/       # Research documents
├── discussions/    # Clarification records
├── audits/         # Audit reports
└── archive/        # Completed specs
```

## Typical Session

```bash
# Check where you are
/sf:status

# Research if needed
/sf:research "auth options"

# Create spec with research context
/sf:new --research RES-001 "add OAuth"

# Clarify assumptions if needed
/sf:discuss SPEC-001

# Audit (use /clear first for fresh context)
/sf:audit

# Implement and review
/sf:run
/sf:review
/sf:done
```

## Philosophy

- **Spec-first** — Write specs before code
- **Fresh audits** — Auditors don't see creation (no bias)
- **Soft blocking** — Warnings, not hard stops
- **Token-aware** — Specs sized for single sessions

## License

MIT
