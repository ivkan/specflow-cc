# SpecFlow State

## Active Specification

none

**Status:** idle
**Next Step:** /sf:next

## Queue

| Priority | ID | Title | Status | Complexity | Depends On |
|----------|-----|-------|--------|------------|------------|
| 1 | SPEC-GSD-C | Explicit Context Thresholds | draft | small | - |
| 2 | SPEC-GSD-A | Goal-Backward Methodology | draft | medium | - |
| 3 | SPEC-SUBAGENT-C | State Management & Reliability | draft | medium | SPEC-SUBAGENT-B |

**Execution Order Rationale:**
- SPEC-GSD-C (context %): Builds on task groups from auditor
- SPEC-GSD-A (goal-backward): Most complex, can evolve independently
- SPEC-SUBAGENT-C (state): Benefits from stable orchestrator

**Master Spec:** SPEC-GSD-IMPROVEMENTS (umbrella for GSD adoption)

## Decisions

| Date | Decision |
|------|----------|
| 2026-01-23 | Split SPEC-SUBAGENT-EXECUTION into 3 parts (A: Foundation, B: Core, C: Reliability) |
| 2026-01-23 | SPEC-SUBAGENT-A: Established NEEDS_DECOMPOSITION audit status for large specs |
| 2026-01-23 | SPEC-SUBAGENT-B: Established orchestrator/worker architecture for parallel execution of large specs |
| 2026-01-24 | Adopt GSD patterns: goal-backward methodology, pre-computed waves, context % thresholds |
| 2026-01-24 | SPEC-GSD-B: Audited and approved - pre-computed waves refactor |
| 2026-01-24 | SPEC-GSD-B: Applied all 3 audit recommendations (markdown fix, step placement, error format) |
| 2026-01-24 | SPEC-GSD-B: Re-audited (v2) and approved - ready for implementation |
| 2026-01-24 | SPEC-GSD-B: Implementation reviewed and APPROVED - all 6 acceptance criteria met |
| 2026-01-24 | SPEC-GSD-B: COMPLETED - Pre-computed waves pattern established for SpecFlow |
| 2026-01-24 | SPEC-SFNEXT-001: Created - fix /sf:next to use Queue position as source of truth |
| 2026-01-24 | SPEC-SFNEXT-001: Audited (v1) and APPROVED - ready for implementation |
| 2026-01-24 | SPEC-SFNEXT-001: Implementation reviewed (v1) and APPROVED - all 6 acceptance criteria met |
| 2026-01-24 | SPEC-SFNEXT-001: COMPLETED - Queue position is now source of truth for /sf:next |

## Notes

### Completed
- SPEC-SUBAGENT-A: Auditor detects large specs (NEEDS_DECOMPOSITION)
- SPEC-SUBAGENT-B: Orchestrator/worker architecture for parallel execution
- SPEC-GSD-B: Pre-computed waves in auditor, simplified orchestrator
- SPEC-SFNEXT-001: Queue position as source of truth for /sf:next

### In Progress
- GSD-inspired improvements adoption (3 specs remaining in queue)

### Architecture Alignment with GSD
| Aspect | SF Status |
|--------|-----------|
| Thin orchestrator | Implemented |
| Fresh subagent contexts | Implemented |
| Wave-based execution | Implemented |
| Pre-computed waves | Implemented (SPEC-GSD-B) - DONE |
| Context % estimation | Pending (SPEC-GSD-C) |
| Goal-backward | Pending (SPEC-GSD-A) |
| Pause/Resume | Pending (SPEC-SUBAGENT-C) |

---
*Last updated: 2026-01-24*
