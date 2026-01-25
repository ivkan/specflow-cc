# SPEC: STATE.md Size Constraint

---
id: SPEC-STATE-001
type: refactor
status: draft
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

After any STATE.md modification, check:

```
IF line_count(STATE.md) > 100:
    rotate_oldest_decisions()
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
3. Exactly 5 most recent decisions retained in STATE.md after rotation
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

<!-- Filled by /sf:audit -->
