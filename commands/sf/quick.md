---
name: sf:quick
description: Execute minor tasks without full specification workflow
argument-hint: "<task description>"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
  - AskUserQuestion
---

<purpose>
Execute minor, well-scoped tasks in a single command without the full new -> audit -> run -> review cycle. Validates task is quick-eligible (1-3 files, no architectural decisions), executes immediately, and logs to QUICK_LOG.md.
</purpose>

<context>
@.specflow/PROJECT.md
</context>

<workflow>

## Step 1: Verify Initialization

```bash
[ -d .specflow ] && echo "OK" || echo "NOT_INITIALIZED"
```

**If NOT_INITIALIZED:**
```
SpecFlow not initialized.

Run `/sf:init` first.
```
Exit.

## Step 2: Parse Task Description

Extract task description from command arguments.

**If no description provided:**
```
Quick mode requires a task description.

Usage: `/sf:quick "<task description>"`

Examples:
- `/sf:quick "fix typo in README header"`
- `/sf:quick "add --verbose flag to sf:status"`
- `/sf:quick "update error message in auth.ts"`
```
Exit.

## Step 3: Eligibility Check

### 3.1 Check for Architectural Signals

Scan task description for NOT-eligible keywords:

| Signal | Pattern | Reason |
|--------|---------|--------|
| New component | "new component", "new module", "create component" | Needs planning |
| Unscoped refactor | "refactor" without specific file mentioned | Needs planning |
| Add feature | "add feature" without specific file | Needs planning |
| Broad scope | "all tests", "all files", "across", "throughout" | Too many files |

**If architectural signal found:**
Go to Step 3.4 (Reject).

### 3.2 Identify Files

1. **Explicit file check:** Search task for file paths or names:
   - Patterns: `*.ts`, `*.md`, `*.json`, or specific filenames
   - Use Glob/Grep to verify mentioned files exist

2. **If explicit file mentioned:**
   - Verify file exists
   - Set estimated_files = count of mentioned files

3. **If no explicit file mentioned:** Use keyword heuristics (Step 3.3)

### 3.3 Keyword-to-Estimate Heuristics

When no files are explicitly mentioned, use these keyword patterns:

| Keyword Pattern | Estimated Files | Rationale |
|-----------------|-----------------|-----------|
| "typo", "spelling" | 1 | Usually single file |
| "README", "docs" | 1-2 | Documentation changes |
| "error message", "log message" | 1-2 | String changes, localized |
| "config", "env", "setting" | 1-2 | Configuration files |
| "import", "export" | 1-2 | Module wiring |
| "test" (without "all") | 1-2 | Single test file |
| "lint", "format" | 2-3 | May touch multiple files |
| "all tests", "all files" | 4+ | NOT eligible |
| "across", "throughout" | 4+ | NOT eligible |
| "refactor" (unscoped) | 5+ | NOT eligible |

**Default:** If no keywords match, estimate 2 files (borderline eligible).

### 3.4 Eligibility Decision

**Eligible if ALL:**
- estimated_files <= 3
- No architectural signals detected
- Task description is specific (not vague)

**If NOT eligible:**

```
This task appears too complex for quick mode.

**Reason:** {reason}

Estimated scope:
- Files: ~{count} (threshold: 1-3)
- Architectural: {yes/no}

Quick mode is for:
- Typo fixes
- Config tweaks
- Single-file bug fixes
- Documentation updates

For this task, use:
`/sf:new "{task description}"`
```
Exit.

## Step 4: Display Mini-Spec

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 QUICK MODE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Task:** {description}
**Files:** {identified files or "TBD based on task"}
**Acceptance:** Task completed, changes committed

Beginning execution...
```

## Step 5: Execute Task

### 5.1 Identify Target Files

If not already identified in Step 3.2:
- Use Grep/Glob to find relevant files
- Read project context from PROJECT.md for guidance

### 5.2 Make Changes

1. Read identified files
2. Make the required changes
3. Validate changes (syntax, lint if applicable)

### 5.3 Create Commit

Determine commit prefix based on task type:

| Task Type | Detection Keywords | Prefix |
|-----------|-------------------|--------|
| Bug/error fix | "fix", "bug", "error", "typo" | `fix(quick):` |
| Documentation | "doc", "readme", "comment" | `docs(quick):` |
| Configuration | "config", "env", "setting" | `chore(quick):` |
| Code style/lint | "lint", "format", "style" | `style(quick):` |
| Test updates | "test" | `test(quick):` |
| Default/other | (no match) | `chore(quick):` |

Create commit:
```bash
git add <files>
git commit -m "{prefix} {task description}

Quick mode execution - no spec created

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

Capture commit hash for logging.

## Step 6: Log Result

### 6.1 Ensure QUICK_LOG.md Exists

```bash
[ -f .specflow/QUICK_LOG.md ] && echo "EXISTS" || echo "CREATE"
```

**If CREATE:**
Create `.specflow/QUICK_LOG.md` with header:

```markdown
# Quick Execution Log

| Date | Task | Files | Commit | Status |
|------|------|-------|--------|--------|
```

### 6.2 Append Result

Append new row to QUICK_LOG.md:

**If SUCCESS:**
```
| {YYYY-MM-DD HH:MM} | {task description} | {file1, file2} | {commit_hash_short} | SUCCESS |
```

**If FAILED:**
```
| {YYYY-MM-DD HH:MM} | {task description} | {attempted files} | — | FAILED: {reason} |
```

## Step 7: Display Result

### On Success:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 QUICK EXECUTION COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Task:** {description}
**Status:** SUCCESS

### Changes

- **Files modified:** {count}
- **Commit:** {hash}

### Files Changed

{For each file:}
- `{filepath}` — {brief description of change}

---

Logged to `.specflow/QUICK_LOG.md`
```

### On Failure:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 QUICK EXECUTION FAILED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Task:** {description}
**Status:** FAILED

**Reason:** {failure reason}

---

Logged to `.specflow/QUICK_LOG.md`

Consider using `/sf:new "{task description}"` for a full specification.
```

</workflow>

<constraints>

## What Quick Mode is NOT

- **NOT** a backdoor to avoid planning for complex tasks
- **NOT** tracked in STATE.md or Queue
- **NOT** creating SPEC-XXX.md files

## Eligibility Enforcement

- ALWAYS run eligibility check before execution
- NEVER skip eligibility for "trusted" tasks
- REJECT vague task descriptions that lack specificity

## Logging Requirement

- ALWAYS log to QUICK_LOG.md, even on failure
- NEVER execute without logging

</constraints>

<success_criteria>
- [ ] SpecFlow initialization verified
- [ ] Task description provided and parsed
- [ ] Eligibility check performed (file count, architectural signals)
- [ ] NOT-eligible tasks rejected with /sf:new guidance
- [ ] Eligible tasks executed immediately
- [ ] Atomic commit created with task-type-aware prefix
- [ ] QUICK_LOG.md created if not exists
- [ ] Result logged to QUICK_LOG.md (success or failure)
- [ ] Quick task NOT added to STATE.md or Queue
- [ ] No SPEC-XXX.md file created
</success_criteria>
