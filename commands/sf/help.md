---
name: sf:help
description: Show SpecFlow help and command reference
allowed-tools:
  - Read
  - Glob
---

<purpose>
Display comprehensive help for SpecFlow commands. Without arguments, shows an overview of all commands grouped by category. With a command name, shows detailed help including examples and related commands.
</purpose>

<context>
@~/.claude/specflow-cc/commands/sf/*.md
</context>

<arguments>
- `[command]` — Command name to get detailed help for (e.g., `new`, `audit`). Optional — shows overview if omitted.
</arguments>

<workflow>

## Step 1: Check for Arguments

**If command argument provided:** Go to Step 2a (Detailed Help)
**If no arguments:** Go to Step 2b (Overview)

## Step 2a: Detailed Command Help

### Validate Command

Check if command exists:
```bash
[ -f ~/.claude/specflow-cc/commands/sf/{command}.md ] && echo "FOUND" || echo "NOT_FOUND"
```

**If NOT_FOUND:**
```
Unknown command: {command}

Run `/sf:help` for available commands.
```
Exit.

### Display Detailed Help

Read the command file and extract:
- Name and description from frontmatter
- Purpose from `<purpose>` section
- Arguments from `<arguments>` section

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 /sf:{command}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{Description from frontmatter}

## Usage

```
/sf:{command} {arguments syntax}
```

## Description

{Purpose section content, summarized}

## Arguments

{Arguments section content}

## Examples

{Generate contextual examples based on command}

## Related Commands

{List 2-4 related commands with brief descriptions}

## See Also

- DESIGN.md section {relevant section}
```

### Command-Specific Examples

**For `/sf:new`:**
```
## Examples

```
/sf:new "Add user authentication with JWT"
/sf:new "Fix pagination bug in user list"
/sf:new "Refactor UserService to use repository pattern"
/sf:new --research RES-001 "Add OAuth login"
/sf:new                    # Interactive mode
```
```

**For `/sf:research`:**
```
## Examples

```
/sf:research "OAuth vs JWT for authentication"
/sf:research "state management options for React"
/sf:research "database migration strategies"
```
```

**For `/sf:discuss`:**
```
## Examples

```
/sf:discuss "auth requirements"                    # Topic discussion
/sf:discuss SPEC-001                               # Clarify spec
/sf:discuss "Should we use Redis or memory cache?" # Direct question
/sf:discuss                                        # Active spec
```
```

**For `/sf:audit`:**
```
## Examples

```
/sf:audit                  # Audit active specification
/sf:audit SPEC-003         # Audit specific specification
/sf:audit --import "[Critical] No error handling; [Major] Add logging"
/sf:audit --import "Security review: 1. SQL injection in search 2. XSS in comments"
```
```

**For `/sf:run`:**
```
## Examples

```
/sf:run                    # Run active specification
/sf:run SPEC-003           # Run specific specification
```
```

**For `/sf:revise`:**
```
## Examples

```
/sf:revise                 # Interactive — shows audit comments with analysis
/sf:revise all             # Apply all audit comments
/sf:revise 1,2             # Apply only comments 1 and 2
/sf:revise --no-analysis   # Skip pre-analysis, go directly to review mode
/sf:revise "add error handling, ignore item 3"
```

## Flags

| Flag | Description |
|------|-------------|
| `--no-analysis` | Skip AI pre-analysis of external feedback |

**Note:** For external audits, Claude analyzes each feedback item and provides
recommendations (Apply/Discuss/Skip) before showing review options. Use
`--no-analysis` to skip this and go directly to manual review.
```

**For `/sf:split`:**
```
## Examples

```
/sf:split                  # Split active specification
/sf:split SPEC-001         # Split specific specification
```
```

**For `/sf:todo`:**
```
## Examples

```
/sf:todo "Add caching layer for API"
/sf:todo "Research WebSocket alternatives"
/sf:todo "Refactor authentication flow"
```
```

**For `/sf:quick`:**
```
## Examples

```
/sf:quick "fix typo in README header"
/sf:quick "add --verbose flag to sf:status"
/sf:quick "update error message in auth.ts"
/sf:quick "fix indentation in config.json"
```
```

Exit.

## Step 2b: Overview Help

Display full command reference:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 SPECFLOW HELP
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**SpecFlow** — Spec-driven development for Claude Code

Workflow: Spec → Audit → Revise → Run → Review → Fix → Done

---

## Core Workflow

| Command      | Description                             |
|--------------|-----------------------------------------|
| /sf:init     | Initialize project, analyze codebase    |
| /sf:new      | Create specification from task          |
| /sf:audit    | Audit spec or import external feedback  |
| /sf:revise   | Revise spec based on audit feedback     |
| /sf:run      | Execute specification                   |
| /sf:review   | Review implementation (fresh context)   |
| /sf:verify   | Interactive human verification          |
| /sf:fix      | Fix implementation based on review      |
| /sf:done     | Finalize, commit, and archive           |

## Quick Execution

| Command      | Description                             |
|--------------|-----------------------------------------|
| /sf:quick    | Execute minor tasks (1-3 files) fast    |

## Navigation

| Command      | Description                             |
|--------------|-----------------------------------------|
| /sf:status   | Show current state and next step        |
| /sf:list     | List all specifications                 |
| /sf:show     | Show specification details              |
| /sf:next     | Work on highest priority task           |

## To-Do

| Command      | Description                             |
|--------------|-----------------------------------------|
| /sf:todo     | Add idea to backlog                     |
| /sf:todos    | List all to-do items                    |
| /sf:plan     | Convert to-do to specification          |
| /sf:priority | Change to-do priorities                 |

## Decomposition

| Command      | Description                             |
|--------------|-----------------------------------------|
| /sf:split    | Split large spec into sub-specs         |
| /sf:deps     | Show dependency graph                   |

## Sessions

| Command      | Description                             |
|--------------|-----------------------------------------|
| /sf:pause    | Save session context for later          |
| /sf:resume   | Restore previous session context        |

## Research & Clarification

| Command      | Description                             |
|--------------|-----------------------------------------|
| /sf:research | Research topic for spec context         |
| /sf:discuss  | Clarify requirements interactively      |
| /sf:scan     | Deep codebase analysis                  |

## Utilities

| Command      | Description                             |
|--------------|-----------------------------------------|
| /sf:help     | This help (or detailed: /sf:help new)   |
| /sf:history  | View completed specifications           |
| /sf:metrics  | Project statistics and insights         |

---

## Quick Start

1. `/sf:init` — Initialize project (once)
2. `/sf:research "topic"` — Research before spec (optional)
3. `/sf:new "task"` — Create specification
4. `/sf:audit` — Audit the spec
5. `/sf:run` — Implement
6. `/sf:review` — Review implementation
7. `/sf:done` — Complete and archive

## Typical Session

```
/sf:status        # Where am I?
/sf:next          # What should I work on?
/sf:audit         # Audit current spec
/sf:revise all    # Apply audit feedback
/sf:run           # Implement
/sf:review        # Review implementation
/sf:done          # Complete
```

---

**Detailed help:** `/sf:help <command>`

**Documentation:** See DESIGN.md for full specification
```

</workflow>

<success_criteria>
- [ ] Command argument parsed correctly
- [ ] Unknown commands handled gracefully
- [ ] Detailed help shows usage, examples, related commands
- [ ] Overview shows all commands grouped by category
- [ ] Quick start guide included
- [ ] Typical session example provided
- [ ] Clear formatting with tables
</success_criteria>
