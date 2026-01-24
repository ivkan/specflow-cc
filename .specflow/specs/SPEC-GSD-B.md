# SPEC: Pre-Computed Waves

---
id: SPEC-GSD-B
parent: SPEC-GSD-IMPROVEMENTS
type: refactor
status: audited
priority: medium
complexity: small
depends_on: []
created: 2026-01-24
---

> Move wave computation from runtime (orchestrator) to planning phase (auditor), simplifying orchestrator logic.

## Context

### Current Behavior

1. Auditor generates Implementation Tasks with groups and dependencies
2. Orchestrator reads groups and dependencies at runtime
3. Orchestrator builds dependency graph
4. Orchestrator computes waves from graph
5. Orchestrator executes waves

### Problem

- Orchestrator does computational work (building graphs)
- Same computation repeated if execution restarts
- No visibility into waves until execution starts

### GSD Approach

Waves are **pre-computed during planning**:

```yaml
# PLAN.md frontmatter
wave: 2
depends_on: [plan-01, plan-02]
```

Orchestrator just reads wave numbers — no graph building.

## Requirements

### 1. Update Implementation Tasks Schema

Change from:

```markdown
| Group | Tasks | Dependencies | Est. Context |
|-------|-------|--------------|--------------|
| G1 | Create types | - | ~10% |
| G2 | Create handler | G1 | ~20% |
```

To:

```markdown
| Group | Wave | Tasks | Dependencies | Est. Context |
|-------|------|-------|--------------|--------------|
| G1 | 1 | Create types | - | ~10% |
| G2 | 2 | Create handler | G1 | ~20% |
| G3 | 2 | Create tests | G1 | ~15% |
| G4 | 3 | Wire integration | G2, G3 | ~10% |
```

And add an Execution Plan summary:

```markdown
### Execution Plan

**Wave 1:** G1 (sequential)
**Wave 2:** G2, G3 (parallel)
**Wave 3:** G4 (sequential)
```

### 2. Update Auditor to Compute Waves

Add wave computation algorithm to `agents/spec-auditor.md` as **new Step 4.5** (after Step 3.5: Execution Scope Check, before Step 5: Final Output):

```markdown
## Step 4.5: Compute Execution Waves

After generating task groups:

1. Initialize all groups with wave = 0
2. For each group with no dependencies: wave = 1
3. Repeat until all groups have waves:
   - For each unassigned group:
     - If all dependencies have waves:
       - wave = max(dependency waves) + 1
4. Validate: no circular dependencies (see error format below)

Add wave numbers to Implementation Tasks table.
Add Execution Plan summary showing:
- Which groups run in each wave
- Which waves can parallelize (>1 group)
```

### 3. Simplify Orchestrator

Update `agents/spec-executor-orchestrator.md`:

**Remove:**
- Dependency graph building
- Wave computation logic

**Keep:**
- Reading wave numbers from spec
- Grouping by wave
- Spawning workers per wave

New process:

```markdown
## Step 2: Parse Waves (simplified)

Read Implementation Tasks section.
Group task groups by wave number.

No graph building required — waves are pre-computed.

Waves = {
  1: [G1],
  2: [G2, G3],
  3: [G4]
}
```

### 4. Parallel Opportunity Marking

In the Execution Plan, explicitly mark parallel opportunities:

```markdown
### Execution Plan

| Wave | Groups | Parallel? | Workers |
|------|--------|-----------|---------|
| 1 | G1 | No | 1 |
| 2 | G2, G3 | Yes | 2 |
| 3 | G4 | No | 1 |

**Total workers needed:** 2 (max in any wave)
```

## Files to Modify

| File | Changes |
|------|---------|
| `agents/spec-auditor.md` | Add wave computation algorithm as Step 4.5, update Implementation Tasks format |
| `agents/spec-executor-orchestrator.md` | Remove graph building, simplify to read pre-computed waves |
| `templates/spec.md` | Update Implementation Tasks schema with Wave column |

## Acceptance Criteria

1. **Auditor computes wave numbers** during Implementation Tasks generation
2. **Spec includes Wave column** in Implementation Tasks table
3. **Spec includes Execution Plan** summary with parallel markers
4. **Orchestrator reads waves** without computing
5. **Orchestrator is simpler** (less code, less context usage)
6. **Backward compatible**: Specs without Wave column still work (orchestrator falls back to computing)

## Constraints

- Wave computation must handle complex dependency graphs
- Circular dependency detection is required (fail audit if found)
- Orchestrator fallback for old specs must remain

## Algorithm

```python
def compute_waves(groups):
    waves = {}
    remaining = set(groups.keys())

    while remaining:
        progress = False
        for group_id in list(remaining):
            deps = groups[group_id].dependencies
            if all(d in waves for d in deps):
                if deps:
                    waves[group_id] = max(waves[d] for d in deps) + 1
                else:
                    waves[group_id] = 1
                remaining.remove(group_id)
                progress = True

        if not progress and remaining:
            raise CircularDependencyError(remaining)

    return waves
```

### Circular Dependency Error Format

When circular dependencies are detected, the auditor MUST fail with this error format:

```
AUDIT FAILED: Circular dependency detected

Cycle involves groups: [G2, G3, G4]
Dependency chain: G2 -> G3 -> G4 -> G2

Resolution: Review and remove one dependency to break the cycle.
```

The error must include:
- List of groups involved in the cycle
- The dependency chain showing the circular path
- Guidance to resolve

---

## Audit History

### Audit v1 (2026-01-24 14:30)
**Status:** APPROVED

**Comment:** Well-structured refactor specification with clear before/after examples, concrete algorithm, and appropriate scope. All 8 quality dimensions pass. Files to modify is at threshold (3) but acceptable for this focused change.

**Recommendations:**
1. Requirement 1 markdown example has formatting issue (unclosed code block before "### Execution Plan") - minor, implementer can interpret
2. Algorithm placement in spec-auditor.md could be more specific (suggest: as new Step 4.5 after scope check)
3. Circular dependency error message format not specified - implementer should choose clear format

### Response v1 (2026-01-24 15:45)
**Applied:** All 3 recommendations

**Changes:**
1. [x] Markdown formatting in Requirement 1 — Split into two separate code blocks (table and Execution Plan) with explanatory text between them
2. [x] Algorithm placement specificity — Updated Requirement 2 to specify "new Step 4.5 (after Step 3.5: Execution Scope Check, before Step 5: Final Output)"
3. [x] Circular dependency error format — Added new "Circular Dependency Error Format" section under Algorithm with concrete error template and required elements

### Audit v2 (2026-01-24 16:15)
**Status:** APPROVED

**Comment:** Re-audit confirms all 3 recommendations from Audit v1 have been properly addressed. The specification is well-structured with clear before/after examples, a concrete algorithm with cycle detection, specific file placement instructions, and explicit error format. All 8 quality dimensions pass. Ready for implementation.

---

## Execution Summary

**Executed:** 2026-01-24
**Commits:** 3

### Files Created
- None

### Files Modified
- `templates/spec.md` — Updated Implementation Tasks schema with Wave column and structured Execution Plan table
- `agents/spec-auditor.md` — Added Step 4 (Generate Implementation Tasks) and Step 4.5 (Compute Execution Waves) with wave algorithm and circular dependency detection
- `agents/spec-executor-orchestrator.md` — Simplified Step 2 to read pre-computed waves with backward compatibility fallback

### Files Deleted
- None

### Acceptance Criteria Status
- [x] Auditor computes wave numbers during Implementation Tasks generation
- [x] Spec includes Wave column in Implementation Tasks table
- [x] Spec includes Execution Plan summary with parallel markers
- [x] Orchestrator reads waves without computing
- [x] Orchestrator is simpler (less code, less context usage)
- [x] Backward compatible: Specs without Wave column still work (orchestrator falls back to computing)

### Deviations
- [Rule 2 - Missing] Added Step 4 (Generate Implementation Tasks) to auditor — the original auditor did not have explicit guidance for creating task groups; this was needed to properly support Step 4.5's wave computation

### Notes
- The auditor now has a complete flow: Step 3.5 (Execution Scope Check) determines if spec is large, Step 4 generates task groups, Step 4.5 computes waves
- Orchestrator retains full backward compatibility via fallback algorithm for legacy specs
- All step numbers after the new steps were renumbered (5, 6, 7, 8) to maintain proper ordering
