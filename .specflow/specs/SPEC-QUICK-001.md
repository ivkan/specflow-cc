# SPEC: Quick Mode for Minor Tasks

---
id: SPEC-QUICK-001
type: feature
status: audited
priority: medium
complexity: small
created: 2026-01-25
---

> Add `/sf:quick` command for executing minor tasks without full new -> audit -> run -> review cycle.

## Context

### Problem Statement

SpecFlow's full workflow (new -> audit -> run -> review) is optimized for medium-to-large specifications where planning rigor prevents costly rework. However, for truly minor tasks (typo fixes, config tweaks, small bug fixes), this overhead is counterproductive.

### The Gap

| Task Type | Full Workflow | Actual Need |
|-----------|---------------|-------------|
| Major feature | Perfect fit | Full cycle |
| Medium refactor | Good fit | Full cycle |
| Typo fix | Overkill | Quick execution |
| Config change | Overkill | Quick execution |
| 1-file bug fix | Overkill | Quick execution |

### Inspiration: GSD Quick Mode

GSD's quick mode uses:
- Single planner + executor (no research, checker, verifier)
- Separate tracking in `.planning/quick/`
- Fast path for small, well-defined tasks

## Task

Create an `/sf:quick` command that accepts a task description, validates it meets "quick-eligible" criteria, creates a minimal inline spec, executes immediately, and logs the result.

## Goal Analysis

### Goal Statement

User can execute minor, well-scoped tasks in a single command without ceremony.

### Observable Truths

When this spec is complete, a user will observe:

1. Running `/sf:quick "fix typo in header"` immediately starts execution
2. Quick mode validates task is small enough (rejects large tasks with guidance)
3. Execution creates atomic commits like normal `/sf:run`
4. Results logged to `.specflow/QUICK_LOG.md` for traceability
5. Quick tasks do not appear in STATE.md queue (separate tracking)

### Required Artifacts

| Artifact | Enables Truth # | Purpose |
|----------|-----------------|---------|
| `commands/sf/quick.md` | 1, 2, 3, 4, 5 | Command definition for /sf:quick |
| `.specflow/QUICK_LOG.md` template | 4, 5 | Tracking file for quick executions |

### Required Wiring

| From | To | Connection Type |
|------|-----|-----------------|
| quick.md | PROJECT.md | Reads project context |
| quick.md | QUICK_LOG.md | Appends execution records |
| quick.md | git | Creates atomic commits |

### Key Links

1. **Quick-eligibility Validation**: Must reject oversized tasks
   - Risk: Users bypass full workflow for tasks that need planning
   - Verification: Tasks with >3 files estimated trigger rejection with `/sf:new` suggestion

2. **Logging Integrity**: Must track all quick executions
   - Risk: Work happens without traceability
   - Verification: Every quick execution appends to QUICK_LOG.md, even on failure

## Requirements

### Initialization Check

Before processing any quick task, verify SpecFlow is initialized:

```
1. Check if .specflow directory exists
2. If NOT exists:
   - Display: "SpecFlow not initialized. Run `/sf:init` first."
   - Abort execution
3. If exists: proceed with eligibility check
```

This is consistent with other SpecFlow commands that require initialization.

### Quick-Eligibility Criteria

A task is quick-eligible if ALL conditions are met:

| Criterion | Threshold | Rationale |
|-----------|-----------|-----------|
| Estimated files | 1-3 | More files need planning |
| Architectural decisions | None | Decisions need documentation |
| Estimated context | <20% | Larger tasks risk quality |
| Scope clarity | Unambiguous | Vague tasks need spec refinement |

### Command Syntax

```
/sf:quick "<task description>"
```

Examples:
- `/sf:quick "fix typo in README header"`
- `/sf:quick "add --verbose flag to sf:status"`
- `/sf:quick "update error message in auth.ts"`

### Eligibility Check Algorithm

```
1. Parse task description
2. Identify likely files (grep/glob for mentioned filenames)
3. Estimate scope:
   - If explicit file mentioned -> 1 file minimum
   - If pattern mentioned ("all X") -> count matches
   - If no files mentioned -> use keyword heuristics (see table below)
4. Check architectural signals:
   - "new component" -> NOT eligible
   - "refactor" without specific scope -> NOT eligible
   - "add feature" without specific file -> NOT eligible
5. Return eligible | not_eligible with reason
```

### Keyword-to-Estimate Heuristics

When no files are explicitly mentioned, use these keyword patterns to estimate scope:

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

If no keywords match, default to 2 files estimate (borderline eligible).

### Rejection Response

When task is NOT quick-eligible:

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

### Execution Flow (if eligible)

1. **Mini-spec generation** (inline, not written to file):
   ```
   Task: {description}
   Files: {identified files}
   Acceptance: Task completed, changes committed
   ```

2. **Execute immediately**:
   - Read identified files
   - Make changes
   - Validate changes work
   - Create atomic commit

3. **Log result**:
   - Append to QUICK_LOG.md

### QUICK_LOG.md Format

```markdown
# Quick Execution Log

| Date | Task | Files | Commit | Status |
|------|------|-------|--------|--------|
| 2026-01-25 14:30 | Fix typo in README header | README.md | abc1234 | SUCCESS |
| 2026-01-25 15:45 | Add --verbose to sf:status | commands/sf/status.md | def5678 | SUCCESS |
| 2026-01-25 16:00 | Update auth error message | src/auth.ts | — | FAILED: file not found |
```

### Commit Message Format

Use task-type-aware conventional commit prefixes:

| Task Type | Prefix | Example |
|-----------|--------|---------|
| Bug/error fix | `fix(quick):` | `fix(quick): correct typo in header` |
| Documentation | `docs(quick):` | `docs(quick): update README examples` |
| Configuration | `chore(quick):` | `chore(quick): update .env.example` |
| Code style/lint | `style(quick):` | `style(quick): fix indentation` |
| Test updates | `test(quick):` | `test(quick): add missing assertion` |
| Default/other | `chore(quick):` | `chore(quick): minor update` |

Prefix detection heuristics:
- Contains "fix", "bug", "error", "typo" -> `fix(quick):`
- Contains "doc", "readme", "comment" -> `docs(quick):`
- Contains "config", "env", "setting" -> `chore(quick):`
- Contains "lint", "format", "style" -> `style(quick):`
- Contains "test" -> `test(quick):`
- Otherwise -> `chore(quick):`

Commit body:
```
{prefix} {task description}

Quick mode execution - no spec created
```

### Files to Create

| File | Purpose |
|------|---------|
| `commands/sf/quick.md` | Quick mode command definition |

### Files to Modify

| File | Changes |
|------|---------|
| `commands/sf/help.md` | Add /sf:quick under "Quick Execution" section (new section after "Core Workflow") |

### Template to Establish

When first quick task runs, create `.specflow/QUICK_LOG.md` with header if not exists.

## Acceptance Criteria

1. `/sf:quick "task"` validates eligibility before execution
2. Tasks with >3 estimated files are rejected with `/sf:new` guidance
3. Eligible tasks execute immediately without separate spec file
4. Atomic commit created with task-type-aware prefix (fix/docs/chore/style/test)
5. Result appended to `.specflow/QUICK_LOG.md`
6. Quick tasks do NOT appear in STATE.md or Queue
7. Failed quick tasks logged with failure reason
8. Command aborts with guidance if .specflow directory does not exist

## Constraints

- DO NOT create SPEC-XXX.md files for quick tasks
- DO NOT modify STATE.md for quick tasks
- DO NOT bypass eligibility check
- DO NOT allow vague task descriptions (require specificity)
- Quick mode is NOT a backdoor to avoid planning — it's for genuinely small tasks

## Assumptions

- Task description provided is in English or can be parsed for file references
- Git is initialized and clean (or user accepts dirty state)
- AskUserQuestion is available if clarification needed
- PROJECT.md exists for context (created by /sf:init)
- 3-file threshold is appropriate for "quick" scope

---

## Audit History

### Audit v1 (2026-01-25 14:30)
**Status:** APPROVED

**Recommendations:**
1. Eligibility algorithm step 3 ("analyze keywords" when no files mentioned) could benefit from example heuristics or a simple keyword-to-estimate table
2. Commit message format uses `fix(quick):` prefix but not all quick tasks are fixes - consider task-type-aware prefixes like `docs(quick):` or `chore(quick):`
3. Add initialization check (verify .specflow exists) at start of quick.md workflow, consistent with other commands
4. Specify which category in help.md to add /sf:quick - suggest "Quick Execution" section or under "Core Workflow" as alternative path

**Comment:** Well-structured specification with clear eligibility criteria, complete execution flow, and appropriate separation from the main spec workflow. All 8 audit dimensions pass. Ready for implementation.

### Response v1 (2026-01-25 15:00)
**Applied:** All 4 recommendations

**Changes:**
1. [x] Keyword heuristics — Added "Keyword-to-Estimate Heuristics" table with 10 keyword patterns and their file estimates
2. [x] Task-type-aware commits — Replaced single `fix(quick):` with 5 prefix types (fix/docs/chore/style/test) and detection heuristics table
3. [x] Initialization check — Added "Initialization Check" section at start of Requirements with .specflow existence validation
4. [x] Help.md placement — Specified "Quick Execution" section (new section after "Core Workflow") in Files to Modify

### Audit v2 (2026-01-25 16:00)
**Status:** APPROVED

**Verification of v1 Recommendations:**
| # | Recommendation | Status |
|---|---------------|--------|
| 1 | Keyword heuristics table | ADDRESSED - 10 keyword patterns with file estimates |
| 2 | Task-type-aware commits | ADDRESSED - 5 prefix types with detection heuristics |
| 3 | Initialization check | ADDRESSED - New section at start of Requirements |
| 4 | Help.md placement | ADDRESSED - "Quick Execution" section specified |

**Execution Scope:**
| Metric | Value | Threshold | Status |
|--------|-------|-----------|--------|
| Files to create | 1 | <=5 | OK |
| Files to modify | 1 | <=3 | OK |
| Acceptance criteria | 8 | <=10 | OK |
| Total requirements | 9 | <=15 | OK |

**Estimated context:** small (~30%)

**Comment:** All 4 v1 recommendations have been properly addressed. The specification now includes comprehensive keyword heuristics, task-type-aware commit prefixes, initialization validation, and clear help.md placement. All 8 audit dimensions pass. Ready for implementation.

---

## Execution Summary

**Executed:** 2026-01-25
**Commits:** 2

### Files Created
- `commands/sf/quick.md` — Full /sf:quick command definition with eligibility validation, execution flow, and logging

### Files Modified
- `commands/sf/help.md` — Added "Quick Execution" section after "Core Workflow" and command-specific examples

### Files Deleted
(none)

### Acceptance Criteria Status
- [x] 1. `/sf:quick "task"` validates eligibility before execution
- [x] 2. Tasks with >3 estimated files are rejected with `/sf:new` guidance
- [x] 3. Eligible tasks execute immediately without separate spec file
- [x] 4. Atomic commit created with task-type-aware prefix (fix/docs/chore/style/test)
- [x] 5. Result appended to `.specflow/QUICK_LOG.md`
- [x] 6. Quick tasks do NOT appear in STATE.md or Queue
- [x] 7. Failed quick tasks logged with failure reason
- [x] 8. Command aborts with guidance if .specflow directory does not exist

### Deviations
(none - implementation followed specification exactly)

### Notes
- QUICK_LOG.md is created on-demand when first quick task is executed (template established in quick.md Step 6.1)
- Command follows same patterns as existing SpecFlow commands (run.md, verify.md) for consistency
