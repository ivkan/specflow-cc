# SPEC: GSD-Inspired Improvements

---
id: SPEC-GSD-IMPROVEMENTS
type: feature
status: draft
priority: high
complexity: large
depends_on: [SPEC-SUBAGENT-B]
created: 2026-01-24
---

> Adopting proven patterns from get-shit-done (GSD) project to improve SpecFlow execution reliability and quality.

## Context

### GSD vs SpecFlow Comparison

After analyzing the GSD project, we identified several patterns that would significantly improve SpecFlow:

| Feature | GSD | SF Current | Gap |
|---------|-----|------------|-----|
| Goal-backward planning | Yes | No | Critical |
| Pre-computed waves | Yes | Runtime | Medium |
| Context % thresholds | Explicit (50%) | File counts | Medium |
| Pause/Resume | Yes | No | Critical |
| Plan verification loop | Yes (3x max) | 1x audit | Low |

### Architecture Alignment

Current alignment: **~70%**

| Aspect | Status |
|--------|--------|
| Thin orchestrator + fat workers | Aligned |
| Fresh subagent contexts | Aligned |
| Wave-based execution | Aligned |
| Atomic commits | Aligned |
| State persistence | MISSING |
| Goal-backward derivation | MISSING |

## Sub-Specifications

This master spec breaks into 4 sub-specifications, ordered by priority and dependencies:

### Phase 1: SPEC-GSD-A — Goal-Backward Methodology

**Priority:** High | **Effort:** Medium | **Impact:** Quality of decomposition

Add goal-backward analysis to spec creation and auditing:

1. **Derive Observable Truths**: What user-visible behaviors must exist?
2. **Derive Required Artifacts**: What files enable those truths?
3. **Derive Required Wiring**: How do artifacts connect?
4. **Identify Key Links**: Which connections are critical/fragile?

**Files to modify:**
- `agents/spec-auditor.md` — Add goal-backward evaluation
- `agents/spec-creator.md` — Add goal-backward template
- `commands/sf/new.md` — Prompt for goal definition
- `templates/spec.md` — Add Goal Analysis section

**Acceptance Criteria:**
- [ ] Specs include "Observable Truths" section
- [ ] Auditor validates artifacts derive from truths
- [ ] Auditor checks wiring between artifacts
- [ ] Key links identified and flagged for careful implementation

### Phase 2: SPEC-GSD-B — Pre-Computed Waves

**Priority:** Medium | **Effort:** Low | **Impact:** Orchestrator simplicity

Move wave computation from runtime to planning phase:

1. **Spec frontmatter includes wave numbers**:
   ```yaml
   implementation_tasks:
     - group: G1
       wave: 1
       tasks: [...]
     - group: G2
       wave: 2
       depends_on: [G1]
   ```

2. **Auditor computes waves during audit** (not orchestrator at runtime)

3. **Orchestrator just reads wave numbers** (no dependency graph building)

**Files to modify:**
- `agents/spec-auditor.md` — Add wave computation to Implementation Tasks generation
- `agents/spec-executor-orchestrator.md` — Simplify to read pre-computed waves
- `templates/spec.md` — Update Implementation Tasks schema

**Acceptance Criteria:**
- [ ] Auditor generates wave numbers in Implementation Tasks
- [ ] Orchestrator reads wave numbers without computing
- [ ] Parallel opportunities explicitly marked in spec

### Phase 3: SPEC-GSD-C — Explicit Context Thresholds

**Priority:** Medium | **Effort:** Low | **Impact:** Better split decisions

Replace file count thresholds with context % estimates:

1. **Quality curve model**:
   - 0-30%: PEAK quality
   - 30-50%: GOOD quality (target)
   - 50-70%: DEGRADING
   - 70%+: POOR

2. **Context estimation rules**:
   | Component | Est. Context |
   |-----------|--------------|
   | Each file read | ~2-5% |
   | Each file write | ~3-7% |
   | Complex logic | +5-10% |
   | Tests | +3-5% per file |

3. **Split triggers**:
   - Estimated context >50% → NEEDS_DECOMPOSITION
   - Any task with >30% estimated → split that task
   - Multiple subsystems → separate task groups

**Files to modify:**
- `agents/spec-auditor.md` — Replace file counts with context % estimation
- `agents/spec-executor-orchestrator.md` — Add context budget tracking per worker

**Acceptance Criteria:**
- [ ] Auditor estimates context % per task group
- [ ] Specs show estimated context in Implementation Tasks
- [ ] NEEDS_DECOMPOSITION triggered at >50% estimated
- [ ] Workers receive context budget guidance

### Phase 4: SPEC-SUBAGENT-C (existing) — State Management & Resumption

**Priority:** High | **Effort:** Medium | **Impact:** Reliability

Already defined in SPEC-SUBAGENT-C.md. Key additions from GSD:

1. **Checkpoint format with commit hashes** (for verification on resume)
2. **Fresh continuation agents** (not context resume)
3. **/sf:pause and /sf:resume commands**

**Additional requirements from GSD:**
- `.specflow/.continue-here` file for session handoff
- Completed tasks table with commit hashes
- Agent verifies commits exist before skipping tasks

## Execution Order

```
Phase 1 (SPEC-GSD-A) ────────────────────────────┐
  Goal-backward methodology                      │
                                                 ├──> All improve spec quality
Phase 2 (SPEC-GSD-B) ────────────────────────────┤     and execution reliability
  Pre-computed waves                             │
                                                 │
Phase 3 (SPEC-GSD-C) ────────────────────────────┤
  Context % thresholds                           │
                                                 │
Phase 4 (SPEC-SUBAGENT-C) ───────────────────────┘
  State management & resumption
```

**Dependencies:**
- Phases 1, 2, 3 are independent (can run in parallel)
- Phase 4 depends on orchestrator being stable (after Phase 2)

**Recommended order:** 2 → 3 → 1 → 4

Rationale:
- Phase 2 (waves) is lowest effort, immediate simplification
- Phase 3 (context %) builds on Phase 2's task groups
- Phase 1 (goal-backward) is most complex, can evolve
- Phase 4 (state) is critical but benefits from stable orchestrator

## Success Metrics

After all phases complete:

| Metric | Current | Target |
|--------|---------|--------|
| Specs requiring manual decomposition | ~50% | <10% |
| Execution failures from context overflow | ~20% | <5% |
| Interrupted executions recoverable | 0% | >90% |
| Orchestrator context usage | ~20% | <15% |

## Constraints

- Changes must be backward compatible with existing specs
- Single-mode execution must continue to work unchanged
- No breaking changes to `/sf:run` default behavior
- All new features are opt-in or auto-detected
