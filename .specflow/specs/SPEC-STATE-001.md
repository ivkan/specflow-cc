# SPEC: STATE.md Size Constraint

---
id: SPEC-STATE-001
type: refactor
status: review
priority: medium
complexity: small
created: 2026-01-25
---

> Implement automatic decision rotation to keep STATE.md compact (<100 lines).

## Context

### Problem Statement

GSD explicitly states that STATE.md should be a "digest, not archive". Currently, SpecFlow's STATE.md grows unbounded as decisions accumulate. The current STATE.md has 28 decision entries and is approaching 80 lines. Without constraint, this leads to:

1. **Context bloat** — every command loads STATE.md, wasting tokens on historical decisions
2. **Reduced readability** — users cannot quickly scan current state
3. **Parser slowdown** — larger files take longer to process

### The GSD Principle

> STATE.md is a digest, not an archive.

This means: keep only what's needed for current work; archive the rest.

## Task

Add automatic decision rotation that moves old decisions to `DECISIONS_ARCHIVE.md` when STATE.md exceeds the size limit, keeping only the most recent 5-7 decisions in STATE.md.

## Goal Analysis

### Goal Statement

STATE.md remains under 100 lines at all times, with automatic archival of old decisions.

### Observable Truths

When this spec is complete, a user will observe:

1. STATE.md never exceeds 100 lines after any command that modifies it
2. Only the 5-7 most recent decisions appear in STATE.md Decisions table
3. Older decisions are preserved in `.specflow/DECISIONS_ARCHIVE.md`
4. Archive file maintains chronological order (oldest first)
5. `/sf:history` can display archived decisions when requested

### Required Artifacts

| Artifact | Enables Truth # | Purpose |
|----------|-----------------|---------|
| Updated commands that modify STATE.md | 1, 2 | Trigger rotation check after modification |
| `DECISIONS_ARCHIVE.md` (auto-created) | 3, 4 | Store rotated decisions |
| Updated `/sf:history` command | 5 | Display archived decisions |

### Required Wiring

| From | To | Connection Type |
|------|-----|-----------------|
| done.md | STATE.md | Adds decision, triggers rotation |
| audit.md | STATE.md | May add decision, triggers rotation |
| run.md | STATE.md | Updates status, triggers rotation |
| review.md | STATE.md | May add decision, triggers rotation |

### Key Links

1. **Size Check Logic**: Determining when rotation is needed
   - Risk: Line counting may be inconsistent across platforms
   - Verification: Use `wc -l` or count newlines in content

2. **Decision Selection**: Choosing which decisions to keep
   - Risk: Keeping wrong decisions (e.g., keeping old, rotating new)
   - Verification: Keep most recent by date, rotate oldest

## Requirements

### Size Constraint

| Metric | Limit |
|--------|-------|
| STATE.md total lines | <100 |
| Decisions to retain | 5-7 (prefer 5, allow up to 7 if recent) |

### Rotation Trigger

After writing STATE.md, check line count. If >100, perform rotation and rewrite the file:

```
WRITE STATE.md
line_count = count_lines(STATE.md)
IF line_count > 100:
    rotate_oldest_decisions()
    REWRITE STATE.md
```

### Rotation Logic

1. Parse Decisions table from STATE.md
2. If decision count > 7:
   - Keep 5 most recent (by date)
   - Move rest to DECISIONS_ARCHIVE.md
3. Re-check line count; if still >100, keep only 5 decisions

### Archive File Format

```markdown
# SpecFlow Decisions Archive

Historical decisions rotated from STATE.md to maintain compactness.

## Archived Decisions

| Date | Decision |
|------|----------|
| 2026-01-20 | Initial architecture decision |
| 2026-01-21 | Adopted pattern X |
...
```

### Commands to Update

| Command | Modification |
|---------|--------------|
| `commands/sf/done.md` | Add rotation check after adding decision |
| `commands/sf/audit.md` | Add rotation check if decision added |
| `commands/sf/run.md` | Add rotation check after status update |
| `commands/sf/review.md` | Add rotation check if decision added |
| `commands/sf/history.md` | Add `--decisions` flag to show archived decisions |

### `/sf:history --decisions` Flag Behavior

The `--decisions` flag displays archived decisions. It interacts with the existing `[ID]` argument as follows:

| Command | Behavior |
|---------|----------|
| `/sf:history --decisions` | Display all archived decisions from DECISIONS_ARCHIVE.md |
| `/sf:history [ID]` | Display execution history for specific specification (existing behavior) |
| `/sf:history [ID] --decisions` | Invalid combination — show error: "Cannot combine [ID] with --decisions flag. Use `/sf:history --decisions` to view all archived decisions or `/sf:history [ID]` for spec history." |

The flags are mutually exclusive because:
- `--decisions` operates on the global DECISIONS_ARCHIVE.md
- `[ID]` operates on spec-specific HISTORY files

### Files to Create

| File | Purpose |
|------|---------|
| `templates/decisions-archive.md` | Template for DECISIONS_ARCHIVE.md |

### Files to Modify

| File | Changes |
|------|---------|
| `commands/sf/done.md` | Add state size check and rotation logic in Step 7/9 |
| `commands/sf/audit.md` | Add state size check after STATE.md update |
| `commands/sf/run.md` | Add state size check after STATE.md update |
| `commands/sf/review.md` | Add state size check after STATE.md update |
| `commands/sf/history.md` | Add `--decisions` flag support |
| `templates/state.md` | Add comment about size constraint |

## Acceptance Criteria

1. STATE.md line count checked after every modification by done/audit/run/review commands
2. When STATE.md exceeds 100 lines, oldest decisions automatically moved to archive
3. 5-7 most recent decisions retained in STATE.md after rotation (5 preferred, up to 7 if line count permits)
4. DECISIONS_ARCHIVE.md created automatically on first rotation
5. Archived decisions preserved in chronological order (oldest first)
6. `/sf:history --decisions` displays all archived decisions
7. Rotation is idempotent (running twice produces same result)

## Constraints

- DO NOT delete any decisions (archive, not discard)
- DO NOT change the format of STATE.md (only reduce decision count)
- DO NOT add rotation to commands that only read STATE.md (status, list, show)
- DO NOT hardcode paths (use .specflow/ relative paths)
- Keep rotation logic inline in commands (no separate utility file)

## Assumptions

- Line count is a reasonable proxy for "size" (vs byte count)
- 5-7 decisions is enough context for current work
- Decisions are dated in YYYY-MM-DD format for chronological sorting
- All commands have access to Bash for line counting
- DECISIONS_ARCHIVE.md does not need size limits (grows indefinitely)

---

## Audit History

### Audit v1 (2026-01-25 14:30)
**Status:** NEEDS_REVISION

**Critical:**
1. Observable Truth #2 states "5-7 most recent decisions" but Acceptance Criterion #3 requires "Exactly 5 most recent decisions." This contradiction must be resolved. Recommend: change Criterion #3 to "5-7 most recent decisions retained (5 preferred, up to 7 if line count permits)" to match Observable Truth #2 and the Requirements section.

**Recommendations:**
2. Clarify `/sf:history --decisions` integration with existing `[ID]` argument. Specify behavior: is `--decisions` mutually exclusive with ID, or can they combine? Example: `/sf:history --decisions` (list all archived) vs `/sf:history SPEC-001 --decisions` (show decisions for specific spec).
3. Specify rotation trigger timing: "After writing STATE.md, check line count. If >100, perform rotation and rewrite the file."

### Response v1 (2026-01-25 14:45)
**Applied:** All 3 items (1 critical + 2 recommendations)

**Changes:**
1. [✓] Observable Truth vs Acceptance Criterion contradiction — Updated Criterion #3 from "Exactly 5 most recent decisions retained" to "5-7 most recent decisions retained in STATE.md after rotation (5 preferred, up to 7 if line count permits)" to match Observable Truth #2 and Requirements section.

2. [✓] `/sf:history --decisions` integration — Added new "Flag Behavior" subsection under Requirements clarifying that `--decisions` and `[ID]` are mutually exclusive. Specified three scenarios: `--decisions` alone (show all archived), `[ID]` alone (existing behavior), and `[ID] --decisions` (error with helpful message). Documented rationale: flags operate on different data sources.

3. [✓] Rotation trigger timing — Updated "Rotation Trigger" section to specify exact timing: "After writing STATE.md, check line count. If >100, perform rotation and rewrite the file." Added pseudocode showing WRITE → COUNT → IF >100 → ROTATE → REWRITE sequence.

**Skipped:** None

### Audit v2 (2026-01-25 15:00)
**Status:** APPROVED

**Verification of v1 Issues:**
- Critical #1 (decision count contradiction): RESOLVED — Observable Truth #2, Acceptance Criterion #3, and Requirements section all now consistently specify "5-7 decisions"
- Recommendation #2 (flag behavior): RESOLVED — New subsection added with clear mutual exclusivity rules and error message
- Recommendation #3 (rotation timing): RESOLVED — Pseudocode added showing WRITE -> COUNT -> ROTATE -> REWRITE sequence

**Scope Check:**

| Metric | Value | Threshold | Status |
|--------|-------|-----------|--------|
| Files to create | 1 | <=5 | OK |
| Files to modify | 6 | <=3 | Note |
| Acceptance criteria | 7 | <=10 | OK |
| Total requirements | 8 | <=15 | OK |

Note: File modification count exceeds threshold but modifications are small and repetitive (adding same rotation check to 4 commands). Appropriate for "small" complexity.

**Comment:** Well-structured specification with clear GSD alignment. All v1 issues properly addressed. Requirements are consistent, testable, and implementable. Ready for execution.

---

## Execution Summary

**Executed:** 2026-01-25 18:00
**Commits:** 5

### Files Created
- `/Users/koristuvac/.claude/specflow-cc/templates/decisions-archive.md` — Template for DECISIONS_ARCHIVE.md file

### Files Modified
- `/Users/koristuvac/.claude/specflow-cc/templates/state.md` — Added size constraint comment
- `/Users/koristuvac/.claude/commands/sf/done.md` — Added rotation check in Step 9
- `/Users/koristuvac/.claude/commands/sf/audit.md` — Added rotation check in new Step 7
- `/Users/koristuvac/.claude/commands/sf/run.md` — Added rotation check in Step 7
- `/Users/koristuvac/.claude/commands/sf/review.md` — Added rotation check in new Step 7.5
- `/Users/koristuvac/.claude/commands/sf/history.md` — Added --decisions flag support with new Step 4c

### Files Deleted
None

### Acceptance Criteria Status
- [x] STATE.md line count checked after every modification by done/audit/run/review commands
- [x] When STATE.md exceeds 100 lines, oldest decisions automatically moved to archive
- [x] 5-7 most recent decisions retained in STATE.md after rotation (5 preferred, up to 7 if line count permits)
- [x] DECISIONS_ARCHIVE.md created automatically on first rotation
- [x] Archived decisions preserved in chronological order (oldest first)
- [x] `/sf:history --decisions` displays all archived decisions
- [x] Rotation is idempotent (running twice produces same result)

### Deviations
None

### Implementation Notes

**Rotation Logic:**
All four commands (done.md, audit.md, run.md, review.md) now include identical rotation logic that:
1. Counts lines in STATE.md after modification
2. If >100 lines, extracts all decisions from Decisions table
3. If >7 decisions, keeps 5 most recent and moves rest to archive
4. Creates DECISIONS_ARCHIVE.md from template on first rotation
5. Uses awk to safely manipulate both files

**Flag Behavior:**
The `/sf:history --decisions` flag is mutually exclusive with [ID] argument. Error message guides users to correct usage. New Step 4c displays all archived decisions in chronological order.

**Idempotency:**
The awk-based logic ensures rotation is idempotent - running multiple times on the same state produces the same result. Old decisions are inserted at the correct position in the archive table.

**File Locations:**
- Command files are in `/Users/koristuvac/.claude/commands/sf/` (used by SpecFlow runtime)
- Template files are in `/Users/koristuvac/.claude/specflow-cc/templates/` (used by SpecFlow init and rotation)
- User's STATE.md and DECISIONS_ARCHIVE.md will be in `.specflow/` directory of their project
