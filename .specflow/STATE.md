# SpecFlow State
## Active Specifications

| SPEC-ID | Status | Next Step |
|---------|--------|-----------|
| SPEC-013 | review | /sf:review |

## Queue

| Priority | ID | Title | Status | Complexity | Depends On |
|----------|-----|-------|--------|------------|------------|
| p1 | SPEC-013 | Audit/Review Recommendation Field + --apply=minor Quick-Fix Path | audited | medium | -- |
| p1 | SPEC-006 | Adopt Superpowers Patterns: Debugging, Evidence, Anti-Patterns, Two-Stage Review, TDD | draft | large | -- |
| p2 | SPEC-009 | Delta Specs for Brownfield Tasks — ADDED/MODIFIED/REMOVED Change Sections | draft | medium | -- |

**Master Spec:** SPEC-GSD-IMPROVEMENTS (umbrella for GSD adoption) - COMPLETE

## Decisions

| Date | Decision |
|------|----------|
| 2026-02-11 | SPEC-005: Review v1 APPROVED — implementation passes all 10 acceptance criteria, no issues found |
| 2026-02-11 | SPEC-005: COMPLETED — autopilot mode for autonomous spec lifecycle execution |
| 2026-03-05 | SPEC-007: COMPLETED — centralized CLI tooling (bin/sf-tools.cjs) with modular lib/ structure, 42 tests |
| 2026-03-23 | SPEC-008: COMPLETED — safe init protection with --force flag, timestamped backup, and defense-in-defense per-file guards |
| 2026-03-23 | SPEC-009: Audit v2 APPROVED — all v1 fixes verified, no new issues, ready for parallel implementation |
| 2026-04-08 | SPEC-010: COMPLETED — migrated TODO storage from monolithic TODO.md to per-file TODO-XXX.md with YAML frontmatter |
| 2026-05-02 | SPEC-011: COMPLETED — multi-active STATE.md table, advisory file-rename lock, resolver CLI, 15 command files updated, 43 tests pass |
| 2026-05-15 | SPEC-012: COMPLETED — L1 archive summary layer (~24-line summaries, ~94% token reduction), 4 agents prefer-summary-with-fallback, idempotent backfill, 55 tests pass |
| 2026-05-19 | SPEC-013: DRAFTED — recommendation field on /sf:audit & /sf:review output, --apply=minor flag on /sf:done & /sf:run; based on DISC-001 |
| 2026-05-19 | SPEC-013: Audit v1 NEEDS_REVISION — 3 critical (action verb conflict for review-path blockers, /sf:revise side-effects on status, missing severity-filter strategy for /sf:fix and /sf:revise) + 7 recommendations |
| 2026-05-19 | SPEC-013: DISC-002 COMPLETE — verb→`fix` for review blockers (A), `--internal` flag on /sf:revise (A), numbered `"1,2,3"` filter via existing API (A); ready for /sf:revise all |
| 2026-05-19 | SPEC-013: Audit v2 APPROVED — all 3 v1 criticals resolved + Goal Analysis added; 2 optional recs applied directly (R2.5 `spec validate` contract + G3/G4 parser spot-check); status `auditing` → `audited`, ready for /sf:run |
| 2026-05-19 | SPEC-013: Audit v2 APPROVED — all 3 v1 criticals cleanly resolved; symmetric --internal on fix.md added; Goal Analysis added; 2 optional recommendations remain |
| 2026-05-19 | SPEC-013: EXECUTED — 5 commits, 3 files created (recommend.cjs, recommend.test.cjs, spec-validate.test.cjs), 9 files modified, 88 tests pass; ready for /sf:review |

## Notes

### Completed
- SPEC-SUBAGENT-A: Auditor detects large specs (NEEDS_DECOMPOSITION)
- SPEC-SUBAGENT-B: Orchestrator/worker architecture for parallel execution
- SPEC-GSD-B: Pre-computed waves in auditor, simplified orchestrator
- SPEC-SFNEXT-001: Queue position as source of truth for /sf:next
- SPEC-GSD-C: Explicit context % thresholds for decomposition decisions
- SPEC-GSD-A: Goal-backward methodology in spec creator and auditor
- SPEC-SUBAGENT-C: State management and reliability for orchestrated execution
- SPEC-VERIFY-001: Interactive user acceptance testing (/sf:verify command)
- SPEC-QUICK-001: Quick mode for minor tasks (/sf:quick command)
- SPEC-MODEL-001: Model profiles for cost-efficient agent execution (quality/balanced/budget)
- SPEC-STATE-001: STATE.md size constraint with automatic decision archiving
- SPEC-PREDISCUSS-001: Pre-spec discussion mode with feature-type-specific questions
- SPEC-001: Add ready-to-use commands to spec creation recommendations
- SPEC-002: Ensure spec-creator and spec-splitter always include Wave column in Implementation Tasks
- SPEC-003: Segmented execution within task groups
- SPEC-004: Replace Bash/awk/sed markdown mutations with Read+Write tool instructions
- SPEC-005: Add Autopilot Mode (`/sf:autopilot`)
- SPEC-007: Centralized CLI Tooling (bin/sf-tools.cjs)
- SPEC-008: Safe Init Protection — Prevent Data Loss on Re-initialization
- SPEC-010: Migrate TODO Storage from Monolithic TODO.md to Per-Task Files
- SPEC-011: Parallel Specification Execution — Multi-Active STATE.md and Per-Command Spec ID Resolution
- SPEC-012: L1 Archive Summary Layer — Compact Summaries Over Completed Specs

### Architecture Alignment with GSD
| Aspect | SF Status |
|--------|-----------|
| Thin orchestrator | Implemented |
| Fresh subagent contexts | Implemented |
| Wave-based execution | Implemented |
| Pre-computed waves | Implemented (SPEC-GSD-B) - DONE |
| Context % estimation | Implemented (SPEC-GSD-C) - DONE |
| Goal-backward | Implemented (SPEC-GSD-A) - DONE |
| Pause/Resume | Implemented (SPEC-SUBAGENT-C) - DONE |
| Human UAT | Implemented (SPEC-VERIFY-001) - DONE |
| Quick Mode | Implemented (SPEC-QUICK-001) - DONE |
| Model Profiles | Implemented (SPEC-MODEL-001) - DONE |
| STATE.md Size Limit | Implemented (SPEC-STATE-001) - DONE |
| Pre-spec Discussion | Implemented (SPEC-PREDISCUSS-001) - DONE |
| Segmented execution | Implemented (SPEC-003) - DONE |
| Autopilot Mode | Implemented (SPEC-005) - DONE |
| Multi-Active STATE.md | Implemented (SPEC-011) - DONE |

---
*Last updated: 2026-05-19 (SPEC-013 EXECUTED — recommend.cjs module, CLI dispatches, agent wiring, --apply=minor command handlers, documentation; 88/88 tests pass; ready for /sf:review)*
