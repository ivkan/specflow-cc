---
name: sf:done
description: Finalize specification, archive, and update state
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
  - AskUserQuestion
---

<purpose>
Finalize the completed specification. Archives the spec, updates STATE.md, extracts decisions, and prepares for the next task.
</purpose>

<context>
@.specflow/STATE.md
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

## Step 2: Get Active Specification

Read `.specflow/STATE.md` and extract Active Specification.

**If no active specification:**
```
No active specification to finalize.

Run `/sf:new "task description"` to create one.
```
Exit.

## Step 3: Load Specification

Read the active spec file: `.specflow/specs/SPEC-XXX.md`

## Step 4: Check Review Status

**If status is "done" (already approved):**
Continue to finalization.

**If status is "review" but has APPROVED review:**
Continue to finalization.

**If status is NOT approved:**
Show warning:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 WARNING: Specification has not passed review
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Specification:** SPEC-XXX
**Current Status:** {status}

{If review exists with issues:}
### Outstanding Issues

From last review (v{N}):

1. {Critical issue}
2. {Major issue}

---

Proceeding without review approval may result in:
- Incomplete or buggy implementation in production
- Technical debt

Continue anyway?
```

Use AskUserQuestion with options:
- "Yes, finalize anyway" → continue, log warning
- "No, run review first" → exit with `/sf:review` suggestion

**If user proceeds anyway:**
Log in STATE.md Warnings table:
```
| {date} | SPEC-XXX | Finalized without review approval |
```

## Step 5: Create Archive Directory

```bash
mkdir -p .specflow/archive
```

## Step 6: Update Specification Status

Update frontmatter:
- status → "done"

Add completion timestamp:

```markdown
---

## Completion

**Completed:** {date} {time}
**Total Commits:** {count from Execution Summary}
**Review Cycles:** {count of Review v[N] entries}
```

## Step 7: Extract Decisions

Scan specification for important decisions:
- Technology choices mentioned in Context or Assumptions
- Patterns established during implementation
- Constraints discovered

If significant decisions found, add to STATE.md Decisions table:

```markdown
| {date} | SPEC-XXX | {decision description} |
```

## Step 8: Archive Specification

Move spec to archive:

```bash
mv .specflow/specs/SPEC-XXX.md .specflow/archive/
```

## Step 9: Update STATE.md

### Clear Active Specification

- Active Specification → "none"
- Status → "idle"
- Next Step → "/sf:new or /sf:next"

### Remove from Queue

Remove SPEC-XXX row from Queue table.

### Update Project Patterns (if applicable)

If implementation established new patterns, add to Project Patterns section.

## Step 10: Create Final Commit (if needed)

Check for uncommitted changes:

```bash
git status --porcelain
```

If changes exist:

```bash
git add .specflow/
git commit -m "docs(sf): complete SPEC-XXX

- Archived specification
- Updated STATE.md
"
```

## Step 11: Display Completion Summary

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 SPECIFICATION COMPLETED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Specification:** SPEC-XXX
**Title:** {title}
**Type:** {feature|refactor|bugfix}

### Summary

- **Files created:** {count}
- **Files modified:** {count}
- **Files deleted:** {count}
- **Commits:** {count}
- **Audit cycles:** {count}
- **Review cycles:** {count}

### Archived To

`.specflow/archive/SPEC-XXX.md`

{If decisions extracted:}
### Decisions Recorded

- {decision 1}
- {decision 2}

---

## Queue Status

{If queue has more specs:}
**Next in queue:** SPEC-YYY — {title}

Run `/sf:next` to start the next specification.

{If queue is empty:}
Queue is empty.

Run `/sf:new "task"` to create a new specification
or `/sf:todos` to see pending ideas.
```

</workflow>

<fallback>

## Inline Finalization

### Update Spec

Set frontmatter status to "done".
Add Completion section with timestamp.

### Archive

```bash
mkdir -p .specflow/archive
mv .specflow/specs/SPEC-XXX.md .specflow/archive/
```

### Update STATE.md

1. Set Active Specification to "none"
2. Set Status to "idle"
3. Set Next Step to "/sf:new or /sf:next"
4. Remove from Queue table
5. Add any extracted decisions

### Commit

```bash
git add .specflow/
git commit -m "docs(sf): complete SPEC-XXX"
```

</fallback>

<success_criteria>
- [ ] Active specification identified
- [ ] Review status checked (warning if not approved)
- [ ] Spec status updated to "done"
- [ ] Completion section added
- [ ] Decisions extracted (if any)
- [ ] Spec moved to archive
- [ ] STATE.md updated (cleared active, removed from queue)
- [ ] Final commit created
- [ ] Clear completion summary shown
- [ ] Next steps provided
</success_criteria>
