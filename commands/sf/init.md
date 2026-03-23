---
name: sf:init
description: Initialize SpecFlow in current project — analyze codebase and create .specflow/ structure
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
---

<purpose>
Initialize SpecFlow in the current project. Analyzes the codebase to understand tech stack, patterns, and structure, then creates the `.specflow/` directory with PROJECT.md, STATE.md, and config.json.
</purpose>

<context>
@~/.claude/specflow-cc/templates/project.md
@~/.claude/specflow-cc/templates/state.md
</context>

<workflow>

## Step 0: Parse Arguments

Check whether the user invoked `/sf:init --force`. Look at the invocation string for the `--force` flag. Set a mental variable `FORCE_MODE` to true or false accordingly.

## Step 1: Check if Already Initialized

```bash
[ -d .specflow ] && echo "EXISTS" || echo "NOT_EXISTS"
```

**If NOT_EXISTS:** proceed to Step 2.

**If EXISTS:** scan for existing data files and directories.

```bash
# Check each file/directory individually
[ -f .specflow/PROJECT.md ] && echo "HAS_PROJECT_MD" || true
[ -f .specflow/STATE.md ] && echo "HAS_STATE_MD" || true
[ -f .specflow/config.json ] && echo "HAS_CONFIG_JSON" || true
[ -f .specflow/todos/TODO.md ] && echo "HAS_TODO_MD" || true
[ "$(ls -A .specflow/specs 2>/dev/null)" ] && echo "HAS_SPECS" || true
[ "$(ls -A .specflow/archive 2>/dev/null)" ] && echo "HAS_ARCHIVE" || true
```

Collect which items exist. If ANY of the above are found:

**If FORCE_MODE is false (no `--force` flag):**

Print this warning (substituting actual found items):

```
WARNING: SpecFlow data already exists in this project.

The following files/directories would be overwritten:
[list each found item, one per line, e.g.:]
  - .specflow/PROJECT.md
  - .specflow/STATE.md
  - .specflow/config.json
  - .specflow/todos/TODO.md
  - .specflow/specs/ (contains files)
  - .specflow/archive/ (contains files)

Re-running init will overwrite these files. Use `/sf:init --force` to reset.

Tip: Run `/sf:status` to see current state.
```

Exit. Do NOT proceed.

**If FORCE_MODE is true (`--force` was passed):**

Print a warning listing all files that will be overwritten, then create a timestamped backup.

```
WARNING: --force flag detected. Existing SpecFlow data will be backed up and overwritten.

The following files/directories will be backed up:
[list each found item]
```

Create the backup directory with a timestamp:

```bash
BACKUP_DIR=".specflow/backup-$(date +%Y-%m-%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"
echo "Backup directory: $BACKUP_DIR"
```

Copy all existing `.specflow/` content (except the backup directory itself) into the backup:

```bash
# Copy all existing .specflow content into backup
# Use find to copy files while preserving structure, excluding backup dirs themselves
find .specflow -maxdepth 1 -not -name "backup-*" -not -name ".specflow" | while read item; do
  cp -r "$item" "$BACKUP_DIR/"
done
echo "Backup complete."
```

Then proceed to Step 2.

**If EXISTS but no data files found** (empty directory): proceed to Step 2.

## Step 2: Detect Tech Stack

Scan for common configuration files:

```bash
# Package managers / Languages
ls package.json pyproject.toml Cargo.toml go.mod pom.xml build.gradle Gemfile composer.json 2>/dev/null

# Frameworks
ls next.config.* nuxt.config.* vite.config.* angular.json vue.config.* 2>/dev/null

# Database
ls prisma/schema.prisma drizzle.config.* knexfile.* 2>/dev/null

# Testing
ls jest.config.* vitest.config.* pytest.ini 2>/dev/null
```

## Step 3: Analyze Project Structure

```bash
# Get top-level structure
ls -la | head -20

# Common source directories
ls -d src app lib pages components 2>/dev/null
```

## Step 4: Detect Patterns

Look for common patterns in the codebase:

```bash
# API routes pattern
ls -d **/api/** app/api pages/api 2>/dev/null | head -5

# Component patterns
ls -d **/components/** 2>/dev/null | head -5

# Check for TypeScript
ls tsconfig.json 2>/dev/null
```

## Step 4.5: Detect Language Profile

Based on Step 2 detection results, determine primary language and generate profile:

**Rust** (if `Cargo.toml` found):
```markdown
## Language Profile

| Setting | Value |
|---------|-------|
| Language | Rust |
| Build check | `cargo check` |
| Lint | `cargo clippy -- -D warnings` |
| Test | `cargo test` |
| Max files per spec | 5 |
| Compilation gate | Yes — run `cargo check` after each implementation block |
| Trait-first | Yes — trait/interface design must be in Wave 1 |

### Rust-Specific Guidelines

- Keep specs to 3-5 files max (borrow checker errors cascade across files)
- Design traits/interfaces before implementation (wrong trait boundaries force rewrites)
- Run `cargo check` after every file change, not just at the end
- Prefer `Result<T, E>` over `unwrap()`/`expect()` in production code
- Document `unsafe` blocks with safety invariants
- Use `cargo clippy` as mandatory quality gate
```

**Go** (if `go.mod` found):
```markdown
## Language Profile

| Setting | Value |
|---------|-------|
| Language | Go |
| Build check | `go build ./...` |
| Lint | `golangci-lint run` |
| Test | `go test ./...` |
| Max files per spec | 8 |
| Compilation gate | Yes — run `go build ./...` after each implementation block |
| Trait-first | Yes — interface design must be in Wave 1 |
```

**TypeScript** (if `tsconfig.json` found):
```markdown
## Language Profile

| Setting | Value |
|---------|-------|
| Language | TypeScript |
| Build check | `npx tsc --noEmit` |
| Lint | `npx eslint .` |
| Test | `pnpm test` |
| Max files per spec | 10 |
| Compilation gate | No |
| Trait-first | No |
```

**Python** (if `pyproject.toml` or `setup.py` found):
```markdown
## Language Profile

| Setting | Value |
|---------|-------|
| Language | Python |
| Build check | — |
| Lint | `ruff check .` |
| Test | `pytest` |
| Max files per spec | 10 |
| Compilation gate | No |
| Trait-first | No |
```

**If no recognized language detected:** omit Language Profile section entirely.

Include the generated profile in Step 6 (Generate PROJECT.md) before the closing `---` line.

## Step 5: Create .specflow Directory

```bash
mkdir -p .specflow/specs .specflow/audits .specflow/archive .specflow/todos .specflow/research .specflow/discussions
```

## Step 6: Generate PROJECT.md

**Defense-in-depth guard:** Before writing, check if `.specflow/PROJECT.md` already exists AND `--force` was NOT used. If both conditions are true, skip writing this file and note it was skipped.

```bash
[ -f .specflow/PROJECT.md ] && echo "PROJECT_MD_EXISTS" || echo "PROJECT_MD_MISSING"
```

If `PROJECT_MD_MISSING` OR `FORCE_MODE` is true: write the file.

Based on detected stack and patterns, create `.specflow/PROJECT.md`:

```markdown
# [Project Name from package.json or directory]

## What This Is

[Infer from README.md if exists, otherwise "Project initialized with SpecFlow"]

## Core Value

[To be defined by user]

## Tech Stack

| Layer | Technology |
|-------|------------|
[Fill based on detection]

## Project Structure

```
[Simplified tree of main directories]
```

## Patterns & Conventions

[List detected patterns]

## Constraints

[To be defined by user]

---
*Generated by SpecFlow on [date]*
```

## Step 7: Generate STATE.md

**Defense-in-depth guard:** Before writing, check if `.specflow/STATE.md` already exists AND `--force` was NOT used. If both conditions are true, skip writing this file and note it was skipped.

```bash
[ -f .specflow/STATE.md ] && echo "STATE_MD_EXISTS" || echo "STATE_MD_MISSING"
```

If `STATE_MD_MISSING` OR `FORCE_MODE` is true: write the file.

Create `.specflow/STATE.md`:

```markdown
# SpecFlow State

## Current Position

- **Active Specification:** none
- **Status:** idle
- **Next Step:** /sf:new

## Queue

| # | ID | Title | Priority | Status |
|---|----|-------|----------|--------|

## Decisions

| Date | Specification | Decision |
|------|---------------|----------|

## Project Patterns

[Patterns from PROJECT.md]

## Warnings

| Date | Specification | Reason |
|------|---------------|--------|

---
*Last updated: [date]*
```

## Step 8: Generate config.json

**Defense-in-depth guard:** Before writing, check if `.specflow/config.json` already exists AND `--force` was NOT used. If both conditions are true, skip writing this file and note it was skipped.

```bash
[ -f .specflow/config.json ] && echo "CONFIG_JSON_EXISTS" || echo "CONFIG_JSON_MISSING"
```

If `CONFIG_JSON_MISSING` OR `FORCE_MODE` is true: write the file.

Create `.specflow/config.json`:

```json
{
  "auto_commit": true,
  "commit_format": "feat(sf-{id}): {description}",
  "ask_questions": "critical_only",
  "complexity_threshold": {
    "small": 50000,
    "medium": 150000
  },
  "audit_storage": "hybrid"
}
```

## Step 9: Output Summary

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 SPECFLOW INITIALIZED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Project:** [name]
**Stack:** [detected technologies]

| File | Purpose |
|------|---------|
| `.specflow/PROJECT.md` | Project overview |
| `.specflow/STATE.md` | Current state |
| `.specflow/config.json` | Configuration |
| `.specflow/research/` | Research documents |

## Next Step

`/sf:new "your task description"` — create first specification

Or research first:
`/sf:research "topic"` — research before creating spec

---

**Tip:** Review `.specflow/PROJECT.md` and fill in:
- Core Value
- Constraints
- Any missing patterns
```

</workflow>

<success_criteria>
- [ ] .specflow/ directory created
- [ ] .specflow/specs/ subdirectory created
- [ ] .specflow/audits/ subdirectory created
- [ ] .specflow/archive/ subdirectory created
- [ ] .specflow/research/ subdirectory created
- [ ] .specflow/discussions/ subdirectory created
- [ ] PROJECT.md created with detected stack
- [ ] STATE.md created with initial state
- [ ] config.json created with defaults
- [ ] User knows next step is /sf:new
</success_criteria>
