---
name: sf:next
description: Find and activate the highest priority actionable specification
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
---

<purpose>
Find the highest priority specification that needs action, set it as active in STATE.md, and show its summary with the recommended next action. Helps quickly jump back into work.
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
SpecFlow not initialized.

Run `/sf:init` to start.
```
Exit.

## Step 2: Read Queue from STATE.md

Read `.specflow/STATE.md` and parse the Queue table.

The Queue table format:
```
| Priority | ID | Title | Status | Complexity | Depends On |
|----------|-----|-------|--------|------------|------------|
| 1 | SPEC-XXX | Title | status | complexity | - |
| 2 | SPEC-YYY | Title | status | complexity | SPEC-XXX |
```

Extract ordered list of spec IDs from the Priority column (1, 2, 3...).

## Step 3: Select First Actionable Spec from Queue

### Status Categories

**Actionable statuses** (process in Queue order):
- `draft` - needs audit
- `auditing` - audit in progress
- `revision_requested` - needs revision
- `audited` - ready to implement
- `running` - implementation in progress
- `review` - needs review

**Non-actionable statuses** (skip):
- `done` - completed
- `blocked` - waiting on dependency
- `archived` - no longer relevant

### Selection Algorithm

```
for each spec in Queue (ordered by Priority column):
  read spec file frontmatter to get current status
  if status is actionable:
    return this spec as selected
```

**If Queue is empty or all Queue specs are non-actionable:**
Proceed to Step 4 (fallback).

**If actionable spec found:**
Skip Step 4, proceed to Step 5.

## Step 4: Fallback - Scan All Spec Files

Only reached if Queue is empty or contains no actionable specs.

```bash
ls -1 .specflow/specs/SPEC-*.md 2>/dev/null
```

For each spec file, read frontmatter and check status.

### Status Priority for Fallback (higher = more urgent)
| Status | Score | Reason |
|--------|-------|--------|
| review | 100 | Needs immediate attention (almost done) |
| running | 90 | In progress, continue |
| audited | 80 | Ready to implement |
| revision_requested | 70 | Needs revision |
| auditing | 60 | Audit in progress |
| draft | 50 | Needs audit |

Select the spec with highest status score. For ties, prefer older specs (lower ID number).

**If no specs found or no actionable specs:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 NO ACTIONABLE TASKS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

All specifications are either completed or blocked.

**Options:**
- `/sf:new "description"` — create new specification
- `/sf:todos` — view idea backlog
- `/sf:list` — see all specifications
```
Exit.

## Step 5: Update STATE.md

Update `.specflow/STATE.md`:
- Set **Active Specification** to selected spec
- Set **Status** based on spec's current status
- Set **Next Step** based on recommended action

## Step 6: Determine Recommended Action

| Status | Recommended Command | Description |
|--------|---------------------|-------------|
| draft | `/sf:audit` | Audit specification |
| auditing | Continue audit | Complete the audit |
| revision_requested | `/sf:revise` | Address audit comments |
| audited | `/sf:run` | Implement specification |
| running | Continue or `/sf:review` | Complete implementation |
| review | `/sf:fix` or `/sf:done` | Address review or finalize |

## Step 7: Display Next Task

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 NEXT TASK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**{ID}:** {Title}
**Priority:** {priority} | **Status:** {status} | **Complexity:** {complexity}

---

## Summary

{First 2-3 sentences from Context or Task section}

## Acceptance Criteria

{List acceptance criteria with checkboxes}

---

{If there are outstanding issues from audit/review:}
## Outstanding Issues

From {audit/review} v{N}:
1. {issue}
2. {issue}

---

**Ready to {action description}:** `{recommended_command}`

{If more specs in queue:}
**Queue:** {N} more specs waiting
```

## Step 8: Show Context Tips

**If status is revision_requested:**
```
**Tip:** Review audit comments with `/sf:show {ID}` before revising.
```

**If status is review:**
```
**Tip:** Check implementation against acceptance criteria.
```

**If complexity is large:**
```
**Tip:** Consider `/sf:split {ID}` to break into smaller specs.
```

</workflow>

<success_criteria>
- [ ] Initialization verified
- [ ] Queue table parsed from STATE.md
- [ ] First actionable spec from Queue selected (by Priority order)
- [ ] Fallback to status-based scan if Queue empty/exhausted
- [ ] STATE.md updated with new active spec
- [ ] Summary displayed with acceptance criteria
- [ ] Clear recommended action provided
- [ ] Queue status shown
</success_criteria>
