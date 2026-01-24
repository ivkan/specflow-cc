---
id: SPEC-SFNEXT-001
type: bugfix
status: done
priority: high
complexity: small
created: 2026-01-24
---

# Fix /sf:next to Use Queue Position as Source of Truth

## Context

The `/sf:next` command currently determines which specification to work on next by:
1. Reading each spec file's frontmatter individually
2. Calculating a score based on status priority + frontmatter priority modifier
3. Selecting the highest-scoring spec

This ignores the Queue table in STATE.md, which has an explicit Priority column (1, 2, 3...) that represents the intended execution order. When the Queue table and frontmatter priorities diverge, the wrong spec is selected.

The Queue table exists specifically to allow manual prioritization and reordering of specs. The current implementation defeats this purpose.

## Task

Modify `/sf:next` to use the Queue table position in STATE.md as the primary source of truth for execution order, with status-based filtering to skip non-actionable specs.

## Requirements

### Files to Modify

| File | Action | Wave |
|------|--------|------|
| `commands/sf/next.md` | Modify | 1 |

### New Behavior

1. **Read Queue from STATE.md** - Parse the Queue table to get ordered list of specs
2. **Filter by actionable status** - Skip specs with non-actionable statuses (done, blocked, archived)
3. **Select first actionable** - Take the first spec from Queue that has an actionable status
4. **Fallback to full scan** - If Queue is empty or all Queue specs are non-actionable, fall back to scanning all spec files

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

### Algorithm Change

Current (WRONG):
```
for each spec file:
  score = status_score + priority_modifier
select max(score)
```

New (CORRECT):
```
queue = parse STATE.md Queue table (ordered by Priority column)
for each spec in queue:
  if spec.status is actionable:
    return spec
# fallback if queue empty
scan all spec files, select by status priority only
```

## Acceptance Criteria

- [ ] `/sf:next` reads Queue table from STATE.md first
- [ ] Specs are selected in Queue Priority order (1 before 2 before 3)
- [ ] Non-actionable specs in Queue are skipped
- [ ] If Queue is empty, fallback to status-based scanning works
- [ ] STATE.md is updated with selected spec as active
- [ ] Frontmatter `priority` field no longer affects selection order

## Constraints

- DO NOT modify the Queue table structure
- DO NOT remove frontmatter priority field from spec template (still useful for display)
- DO NOT change the status-to-action mapping in Step 6
- KEEP the output format unchanged (Step 7)

## Assumptions

- Queue table always has Priority column as first column
- Queue table uses standard markdown table format: `| Priority | ID | Title | Status | ... |`
- Spec IDs in Queue match filenames in `.specflow/specs/SPEC-{ID}.md`
- Empty Queue is valid state (triggers fallback behavior)

## Execution Plan

| Wave | Files | Description |
|------|-------|-------------|
| 1 | commands/sf/next.md | Modify selection algorithm |

## Audit History

### Audit v1 (2026-01-24 14:30)
**Status:** APPROVED

**Scope Assessment:**

| Metric | Value | Threshold | Status |
|--------|-------|-----------|--------|
| Files to create | 0 | ≤5 | OK |
| Files to modify | 1 | ≤3 | OK |
| Acceptance criteria | 6 | ≤10 | OK |
| Total requirements | 7 | ≤15 | OK |

**Estimated context usage:** small (~30%)

**Quality Dimensions:**
- Clarity: Excellent - clear title, context explains the bug, task is specific
- Completeness: Full - file identified, algorithm documented with pseudocode
- Testability: Strong - all criteria are concrete and verifiable
- Scope: Well-bounded - constraints explicitly state what NOT to change
- Feasibility: Sound - straightforward markdown table parsing
- Architecture fit: Aligned - uses existing STATE.md Queue structure
- Non-duplication: Good - leverages existing Priority column
- Cognitive load: Low - simple linear algorithm, easy to understand

**Comment:** Well-structured bugfix specification with clear before/after algorithm comparison. The explicit status categories and fallback behavior make this easy to implement correctly.

---

## Execution Summary

**Executed:** 2026-01-24
**Commits:** 1

### Files Created
- None

### Files Modified
- `commands/sf/next.md` - Replaced scoring algorithm with Queue-based selection

### Files Deleted
- None

### Acceptance Criteria Status
- [x] `/sf:next` reads Queue table from STATE.md first
- [x] Specs are selected in Queue Priority order (1 before 2 before 3)
- [x] Non-actionable specs in Queue are skipped
- [x] If Queue is empty, fallback to status-based scanning works
- [x] STATE.md is updated with selected spec as active
- [x] Frontmatter `priority` field no longer affects selection order

### Deviations
None - implementation followed specification exactly.

### Notes
- Step 2 now parses Queue table from STATE.md instead of listing all spec files
- Step 3 implements the new Queue-based selection with actionable/non-actionable status filtering
- Step 4 contains the fallback logic (previously Step 2-3) for when Queue is empty
- Steps 5-8 unchanged per specification constraints
- Success criteria updated to reflect new Queue-based workflow

---

## Review History

### Review v1 (2026-01-24 20:10)
**Result:** APPROVED
**Reviewer:** impl-reviewer (subagent)

**Findings:**

**Passed:**
- [x] `/sf:next` reads Queue table from STATE.md first — Step 2 clearly documents parsing the Queue table from STATE.md
- [x] Specs are selected in Queue Priority order (1 before 2 before 3) — Step 3 algorithm iterates "for each spec in Queue (ordered by Priority column)"
- [x] Non-actionable specs in Queue are skipped — Step 3 defines actionable vs non-actionable statuses and filters accordingly
- [x] If Queue is empty, fallback to status-based scanning works — Step 4 implements fallback with status-based scoring
- [x] STATE.md is updated with selected spec as active — Step 5 unchanged, still updates STATE.md
- [x] Frontmatter `priority` field no longer affects selection order — Priority Modifier table removed from algorithm; fallback uses status score only

**Constraints Verified:**
- [x] Queue table structure NOT modified — only reads existing format
- [x] Step 6 (status-to-action mapping) unchanged — verified via git diff
- [x] Step 7 (output format) unchanged — verified via git diff

**Quality Assessment:**
- Compliance: Fully meets specification requirements
- Quality: Clean, well-structured markdown with clear step progression
- Integration: Follows existing command file patterns (compared with sf:list.md)
- Architecture: Properly separates Queue-based selection (primary) from fallback (secondary)
- Non-duplication: Reuses existing Queue table structure rather than creating new priority mechanism
- Cognitive load: Simple linear algorithm, easy to follow step-by-step

**Summary:** Implementation correctly addresses the bug by replacing the scoring-based algorithm with Queue-position-based selection. All 6 acceptance criteria are met, all 4 constraints are respected, and the code quality is good.

---

## Completion

**Completed:** 2026-01-24 20:15
**Total Commits:** 1
**Audit Cycles:** 1
**Review Cycles:** 1
