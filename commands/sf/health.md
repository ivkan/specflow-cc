---
name: sf:health
description: Diagnose .specflow/ directory health and optionally repair issues
argument-hint: [--repair]
# SPEC-011: Invokes migrate-state on entry; re-stamps STATE.md header from template after migration (--repair path)
allowed-tools:
  - Read
  - Bash
  - Glob
  - Write
  - AskUserQuestion
---

<purpose>
Validate `.specflow/` directory integrity and report actionable issues. Checks for missing files, invalid state, orphaned specs, and queue inconsistencies. Optionally repairs auto-fixable issues.
</purpose>

<context>
@.specflow/STATE.md
</context>

<workflow>

## Step 1: Verify Initialization

```bash
[ -d .specflow ] && echo "OK" || echo "NOT_INITIALIZED"
```

**If NOT_INITIALIZED:**
```
SpecFlow not initialized. Run `/sf:init` first.
```
Exit.

## Step 2: Invoke STATE.md Migration (entry point)

Run migration on entry — idempotent, no-op when already migrated:

```bash
node ~/.claude/specflow-cc/bin/sf-tools.cjs state migrate
```

Parse the response:
- `{"migrated":true,...}` → Migration completed. After migration, re-stamp the `## Active Specifications` header block in STATE.md from `templates/state.md` to reconcile any format drift (non-destructive: Queue, Decisions, Notes sections are preserved; only the Active Specifications block is normalized). This is the `--repair` path.
- `{"migrated":false,...}` → Already migrated, no action needed.

## Step 2.5: Parse Arguments

Check if `--repair` flag is present.

## Step 3: Run Health Checks

Initialize collectors:
- `errors[]` — critical issues
- `warnings[]` — non-critical issues
- `info[]` — informational notes
- `repairs[]` — actions taken (if --repair)

### 3.1 Core Files Check

| Check | File | Severity | Repairable |
|-------|------|----------|------------|
| E001 | `.specflow/STATE.md` missing | error | Yes — regenerate minimal STATE.md |
| E002 | `.specflow/STATE.md` missing `## Queue` section | error | No |
| W001 | `.specflow/todos/` directory missing | warning | Yes — create directory |
| W002 | `.specflow/specs/` directory missing | warning | Yes — create directory |
| W003 | `.specflow/archive/` directory missing | warning | Yes — create directory |
| W004 | `.specflow/execution/` directory missing | warning | Yes — create directory |
| W009 | TODO file without valid YAML frontmatter | warning | No — inspect manually |
| W010 | Legacy `TODO.md` exists alongside per-file TODOs (suggest migration) | info | No — run `/sf:migrate-todos` |

For each check:
1. Test existence
2. If missing and repairable and `--repair`: fix it, add to `repairs[]`
3. If missing and not repairable: add to `errors[]` or `warnings[]`

**For W009:** List all `TODO-*.md` files in `.specflow/todos/` and check each for valid YAML frontmatter (presence of `id:`, `status:`, `created:` fields).

**For W010:** If both `TODO-*.md` files AND `TODO.md` exist in `.specflow/todos/`, add info note suggesting `/sf:migrate-todos` to complete migration.

### 3.2 STATE.md Integrity

Read STATE.md and validate:

**E003: Active spec references non-existent file**
- List all active specs via `node ~/.claude/specflow-cc/bin/sf-tools.cjs state list-active`
- For each SPEC-ID, check `.specflow/specs/{ID}.md` exists
- If missing: error (repairable — remove that row via `state remove-active`)

**W005: Queue references non-existent spec file**
- Parse queue table rows
- For each spec ID, verify `.specflow/specs/{ID}.md` or `.specflow/archive/{ID}.md` exists
- If missing: warning (not repairable — spec may have been manually deleted)

**W006: Queue has duplicate spec IDs**
- Parse all IDs from queue table
- If duplicates found: warning (not repairable)

**W007: STATUS.md malformed — missing required sections**
- Check for: `## Active Specification`, `## Queue`
- If missing: warning

### 3.3 Orphaned Specs Check

**I001: Spec file exists but not in queue or archive**
- List all files in `.specflow/specs/`
- For each, check if its ID appears in STATE.md queue
- If not: info (may be work-in-progress)

### 3.4 Archive Consistency

**I002: Spec in queue marked as completed but not archived**
- Parse queue for specs with status containing "done" or "complete"
- Check if file exists in `.specflow/archive/`
- If not: info

### 3.5 Execution State

**W008: Stale execution state files**
- List `.specflow/execution/*.json`
- For each, check if the spec ID is the currently active spec
- If not active: warning (repairable — delete stale files)

## Step 4: Calculate Status

```
HEALTHY  = 0 errors, 0 warnings
DEGRADED = 0 errors, 1+ warnings
BROKEN   = 1+ errors
```

## Step 5: Display Results

**IMPORTANT:** Output the following directly as formatted text, NOT wrapped in a markdown code block:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 SpecFlow Health Check
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Status:** HEALTHY | DEGRADED | BROKEN
**Errors:** N | **Warnings:** N | **Info:** N
```

**If repairs were performed:**
```
### Repairs Performed

- Repaired: {description}
- Repaired: {description}
```

**If errors exist:**
```
### Errors

- [{code}] {message}
  Fix: {suggested fix}
```

**If warnings exist:**
```
### Warnings

- [{code}] {message}
  Fix: {suggested fix}
```

**If info exists:**
```
### Info

- [{code}] {message}
```

**Footer (if repairable issues exist and --repair was NOT used):**
```
---
{N} issues can be auto-repaired. Run: `/sf:health --repair`
```

## Step 6: Offer Repair (if applicable)

If repairable issues found and `--repair` was NOT passed:
- Ask user if they want to run repairs
- If yes, execute repairs and re-run checks to verify

## Step 7: Verify Repairs (if --repair was used)

Re-run all checks without repair to confirm resolution.
Display final status.

</workflow>

<error_codes>

| Code | Severity | Description | Repairable |
|------|----------|-------------|------------|
| E001 | error | STATE.md not found | Yes |
| E002 | error | STATE.md missing Queue section | No |
| E003 | error | Active spec references non-existent file | Yes |
| W001 | warning | todos/ directory missing | Yes |
| W002 | warning | specs/ directory missing | Yes |
| W003 | warning | archive/ directory missing | Yes |
| W004 | warning | execution/ directory missing | Yes |
| W005 | warning | Queue references non-existent spec | No |
| W006 | warning | Queue has duplicate spec IDs | No |
| W007 | warning | STATE.md missing required sections | No |
| W008 | warning | Stale execution state files | Yes |
| W009 | warning | TODO file without valid frontmatter | No |
| W010 | info | Legacy TODO.md alongside per-file TODOs | No |
| I001 | info | Spec not in queue (may be WIP) | No |
| I002 | info | Completed spec not archived | No |

</error_codes>

<repair_actions>

| Action | Effect | Risk |
|--------|--------|------|
| Create STATE.md | Minimal template with empty queue | None |
| Create todos/ directory | Empty directory for per-file TODOs | None |
| Create directories | specs/, archive/, execution/ | None |
| Clear active spec | Set to "—" if spec file missing | Loses active reference |
| Delete stale execution | Remove orphaned .json state files | None |

**Not repairable (too risky):**
- STATE.md content/queue entries
- Spec file contents
- Archive decisions

</repair_actions>

<success_criteria>
- [ ] All health checks executed
- [ ] Clear status reported (HEALTHY/DEGRADED/BROKEN)
- [ ] Each issue has error code and suggested fix
- [ ] --repair only fixes safe, non-destructive issues
- [ ] Repairs verified by re-running checks
</success_criteria>
