# SPEC: Interactive User Acceptance Testing

---
id: SPEC-VERIFY-001
type: feature
status: running
priority: medium
complexity: small
created: 2026-01-25
---

> Add `/sf:verify` command for interactive human verification of acceptance criteria after implementation.

## Context

### Problem Statement

SpecFlow currently has agent-based code review (`/sf:review`) that evaluates code quality, specification compliance, and best practices. However, there is no structured way for the **human user** to verify that the implemented features actually work for their use case.

### The Gap

| Verification Type | Agent Review | Human UAT |
|-------------------|--------------|-----------|
| Code compiles | Yes | - |
| Acceptance criteria met (technically) | Yes | - |
| Feature works as user expects | - | **MISSING** |
| Edge cases in real usage | - | **MISSING** |
| UX matches expectations | - | **MISSING** |

### Why This Matters

Agent review checks that code meets specification. Human verification confirms that specification meets intent. Both are needed for confident completion.

## Task

Create an `/sf:verify` command that guides the user through interactive verification of each acceptance criterion, recording pass/fail/skip status.

## Goal Analysis

### Goal Statement

User can interactively confirm that each acceptance criterion actually works before finalizing a specification.

### Observable Truths

When this spec is complete, a user will observe:

1. Running `/sf:verify` displays each acceptance criterion one by one
2. User can respond [y/n/skip] for each criterion
3. Results are recorded in the specification with verification status
4. Clear summary shows verified vs. failed vs. skipped criteria
5. Failed criteria trigger warning in `/sf:done` (proceed requires confirmation)

### Required Artifacts

| Artifact | Enables Truth # | Purpose |
|----------|-----------------|---------|
| `commands/sf/verify.md` | 1, 2, 3, 4, 5 | Command definition for /sf:verify |

### Required Wiring

| From | To | Connection Type |
|------|-----|-----------------|
| verify.md | STATE.md | Reads active spec |
| verify.md | SPEC-XXX.md | Reads acceptance criteria, writes verification results |
| done.md | SPEC-XXX.md | Checks verification status before finalizing |

### Key Links

1. **Criteria Parsing**: Extracting acceptance criteria from spec markdown
   - Risk: Criteria format varies (numbered list, checkboxes, etc.)
   - Verification: Test with archived specs that have different formats

2. **Verification Recording**: Writing results back to spec
   - Risk: Corrupting spec format or losing audit/review history
   - Verification: Results appear in dedicated section, existing content preserved

## Requirements

### Interactive Loop

For each acceptance criterion:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 CRITERION [1/N]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{Criterion text}

---

Did you verify this works? [y/n/skip]
```

### Response Handling

| Response | Meaning | Recording |
|----------|---------|-----------|
| y / yes | Verified working | `[VERIFIED]` |
| n / no | Failed verification | `[FAILED]` with optional reason |
| skip / s | Not tested | `[SKIPPED]` |

### Verification Section Format

Add to specification after Review History:

```markdown
---

## Verification History

### Verification v1 (2026-01-25 14:30)
**Verifier:** user
**Result:** PARTIAL (4/6 verified, 1 failed, 1 skipped)

| # | Criterion | Status | Notes |
|---|-----------|--------|-------|
| 1 | State file created | VERIFIED | |
| 2 | State updated per wave | VERIFIED | |
| 3 | Resumption works | FAILED | "Resume missed wave 2 commits" |
| 4 | Auto-detection works | VERIFIED | |
| 5 | Pre-wave verification | VERIFIED | |
| 6 | Manual edge case | SKIPPED | "No time to test" |
```

### Integration with /sf:done

Update `/sf:done` to check verification status:

- If no verification exists: warn but allow proceed
- If verification exists with failures: require confirmation to proceed
- If verification passed: proceed normally

### Files to Create

| File | Purpose |
|------|---------|
| `commands/sf/verify.md` | Interactive UAT command definition |

### Files to Modify

| File | Changes |
|------|---------|
| `commands/sf/done.md` | Add verification status check in Step 4 |
| `commands/sf/help.md` | Add /sf:verify to command list (place in "Core Workflow" section after /sf:review) |

## Acceptance Criteria

1. `/sf:verify` extracts all acceptance criteria from active specification
2. Each criterion presented interactively with [y/n/skip] prompt
3. User can provide optional notes for failed/skipped criteria
4. Verification results recorded in spec with timestamp
5. Summary displayed showing verified/failed/skipped counts
6. `/sf:done` warns if verification has failures
7. Multiple verification rounds supported (v1, v2, etc.)

## Constraints

- DO NOT modify acceptance criteria text (only add verification status)
- DO NOT require verification for /sf:done (optional enhancement, not gate)
- DO NOT auto-verify anything (this is explicitly human verification)
- Preserve all existing spec content when adding Verification History

## Assumptions

- Acceptance criteria are in a parseable format (checkboxes or numbered list)
- AskUserQuestion tool is available for interactive prompts
- User has access to test the implementation before running /sf:verify
- Single-threaded interaction (one criterion at a time)

## Implementation Notes

- **Criteria Parsing**: Must handle both numbered list format (`1. criterion`) and checkbox format (`- [ ] criterion`) when extracting acceptance criteria from specifications

---

## Audit History

### Audit v1 (2026-01-25 16:45)
**Status:** APPROVED

**Recommendations:**
1. Observable Truth #5 says "Failed criteria block /sf:done" but Constraint #2 says "DO NOT require verification for /sf:done". Acceptance criterion #6 aligns with constraint ("warns"). Consider clarifying Observable Truth #5 to say "warns" instead of "blocks" for consistency.
2. Specify help.md placement: recommend adding /sf:verify to "Core Workflow" section after /sf:review.
3. Consider adding implementation note that criteria parsing should handle both numbered list (`1. criterion`) and checkbox (`- [ ] criterion`) formats.

**Comment:** Well-structured specification with clear problem statement, concrete requirements, and measurable acceptance criteria. The interactive loop design and section format are well-defined. Architecture aligns with existing SpecFlow patterns.

### Response v1 (2026-01-25 17:00)
**Applied:** All 3 recommendations

**Changes:**
1. [x] Observable Truth #5 wording inconsistency - Changed "Failed criteria block /sf:done" to "Failed criteria trigger warning in /sf:done (proceed requires confirmation)" to align with Constraint #2
2. [x] help.md placement note - Added "(place in 'Core Workflow' section after /sf:review)" to Files to Modify table entry for help.md
3. [x] Criteria parsing formats - Added new "Implementation Notes" section documenting that criteria parsing must handle both numbered list and checkbox formats

### Audit v2 (2026-01-25 17:15)
**Status:** APPROVED

**Verification of v1 Revisions:**
1. [x] Observable Truth #5 now says "trigger warning" - aligns with Constraint #2 and Criterion #6
2. [x] help.md placement explicitly specified in Files to Modify table
3. [x] Implementation Notes section added with criteria parsing guidance

**Comment:** All v1 recommendations properly addressed. Specification is internally consistent, complete, and ready for implementation. Small scope with clear requirements.

---

## Execution Summary

**Executed:** 2026-01-25 17:45
**Commits:** 3

### Files Created
- `commands/sf/verify.md` — Interactive UAT command with criteria parsing, interactive loop, versioned recording

### Files Modified
- `commands/sf/done.md` — Added Step 4.5 for verification status check before archiving
- `commands/sf/help.md` — Added /sf:verify to Core Workflow section after /sf:review

### Files Deleted
(none)

### Acceptance Criteria Status
- [x] 1. `/sf:verify` extracts all acceptance criteria from active specification
- [x] 2. Each criterion presented interactively with [y/n/skip] prompt
- [x] 3. User can provide optional notes for failed/skipped criteria
- [x] 4. Verification results recorded in spec with timestamp
- [x] 5. Summary displayed showing verified/failed/skipped counts
- [x] 6. `/sf:done` warns if verification has failures
- [x] 7. Multiple verification rounds supported (v1, v2, etc.)

### Deviations
(none - implementation followed specification exactly)

### Notes
- verify.md supports both numbered list (`1. criterion`) and checkbox (`- [ ] criterion`) formats as specified in Implementation Notes
- done.md Step 4.5 placed after Step 4 (review check) and before Step 5 (create archive) as requested
- Verification is optional and non-blocking per Constraint #2
