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

## Step 2: Find All Specifications

```bash
ls -1 .specflow/specs/SPEC-*.md 2>/dev/null
```

**If no specs found:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 NO ACTIONABLE TASKS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

No specifications ready for work.

**Options:**
- `/sf:new "description"` — create new specification
- `/sf:todos` — view idea backlog
```
Exit.

## Step 3: Parse and Score Specifications

For each spec, read frontmatter and calculate priority score:

### Status Priority (higher = more urgent)
| Status | Score | Reason |
|--------|-------|--------|
| review | 100 | Needs immediate attention (almost done) |
| running | 90 | In progress, continue |
| audited | 80 | Ready to implement |
| revision_requested | 70 | Needs revision |
| auditing | 60 | Audit in progress |
| draft | 50 | Needs audit |

### Priority Modifier
| Priority | Modifier |
|----------|----------|
| high | +30 |
| medium | +20 |
| low | +10 |

### Final Score
`score = status_score + priority_modifier`

For ties, prefer older specs (lower ID number).

## Step 4: Select Best Candidate

Choose spec with highest score.

**If no actionable specs** (all done or blocked):
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
- [ ] All specs scanned and scored
- [ ] Highest priority actionable spec selected
- [ ] STATE.md updated with new active spec
- [ ] Summary displayed with acceptance criteria
- [ ] Clear recommended action provided
- [ ] Queue status shown
</success_criteria>
