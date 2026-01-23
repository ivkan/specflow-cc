# SpecFlow State

## Active Specification

**SPEC-SUBAGENT-B** — Core Agent Architecture

**Status:** review
**Next Step:** `/sf:review`

## Queue

| Priority | ID | Title | Status | Complexity | Depends On |
|----------|-----|-------|--------|------------|------------|
| 1 | SPEC-SUBAGENT-B | Core Agent Architecture | audited | medium | — |
| 2 | SPEC-SUBAGENT-C | State Management & Reliability | draft | medium | SPEC-SUBAGENT-B |

## Decisions

| Date | Decision |
|------|----------|
| 2026-01-23 | Split SPEC-SUBAGENT-EXECUTION into 3 parts (A: Foundation, B: Core, C: Reliability) |
| 2026-01-23 | SPEC-SUBAGENT-A: Established NEEDS_DECOMPOSITION audit status for large specs |

## Notes

- All three specs are part of the Subagent-Based Execution Model feature
- Execute in order: A → B → C (sequential dependencies)
- Each spec can be audited and implemented independently once dependencies are met
- SPEC-SUBAGENT-A completed and archived
