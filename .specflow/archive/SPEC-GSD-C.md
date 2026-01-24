# SPEC: Explicit Context Thresholds

---
id: SPEC-GSD-C
parent: SPEC-GSD-IMPROVEMENTS
type: refactor
status: done
priority: high
complexity: small
depends_on: []
created: 2026-01-24
---

> Replace file-count-based thresholds with context percentage estimates for better decomposition decisions.

## Context

### Current Behavior

Auditor uses file counts to determine complexity:

```
Files to create: ≤5
Files to modify: ≤3
Acceptance criteria: ≤10
Total requirements: ≤15
```

### Problem

- File counts don't reflect actual context consumption
- A single complex file can exceed limits while multiple simple files stay within
- No correlation with Claude's quality degradation curve

### GSD Approach

GSD models Claude's performance curve explicitly:

```
0-30%:   PEAK quality
30-50%:  GOOD quality  <- Target range
50-70%:  DEGRADING
70%+:    POOR
```

Plans are split to stay in the 30-50% range per worker.

## Requirements

### 1. Context Estimation Model

Define context estimation rules:

```markdown
## Context Estimation Rules

| Component | Base Est. | Modifier |
|-----------|-----------|----------|
| Read existing file | 2-3% | +1% per 200 lines |
| Create new file | 3-5% | +2% if complex logic |
| Modify existing file | 4-6% | +1% per section changed |
| Write tests | 3-4% | Per test file |
| Complex integration | +5-10% | Cross-module wiring |
| External API calls | +3-5% | Each unique endpoint |

### Complexity Multipliers

| Factor | Multiplier |
|--------|------------|
| Straightforward CRUD | 1.0x |
| Business logic | 1.3x |
| State management | 1.5x |
| Async/concurrent | 1.7x |
| Security-sensitive | 1.5x |
```

### 2. Update Auditor Execution Scope Check

Replace file counts with context estimates:

**Current:**
```markdown
| Metric | Value | Threshold | Status |
|--------|-------|-----------|--------|
| Files to create | {N} | <=5 | Y/W/X |
| Files to modify | {N} | <=3 | Y/W/X |
```

**New:**
```markdown
| Metric | Est. Context | Target | Status |
|--------|--------------|--------|--------|
| Total spec context | ~45% | <=50% | Y |
| Largest task group | ~25% | <=30% | Y |
| Worker overhead | ~5% | <=10% | Y |

### Worker Overhead Definition

Worker overhead = fixed "entry cost" per subagent, independent of task size:

| Component | Est. Context |
|-----------|--------------|
| PROJECT.md loading | ~2% |
| Task parsing from orchestrator | ~1% |
| JSON result formatting | ~1% |
| Deviation buffer | ~1% |
| **Total** | **~5%** |

This is the "price of admission" for each worker invocation.

### Quality Projection

| Context Range | Expected Quality | Status |
|---------------|------------------|--------|
| 0-30% | PEAK | - |
| 30-50% | GOOD | <- Current estimate |
| 50-70% | DEGRADING | - |
| 70%+ | POOR | - |
```

### 3. Decomposition Triggers

Update NEEDS_DECOMPOSITION logic:

**Old triggers:**
- Files to create > 5
- Files to modify > 3
- Acceptance criteria > 10

**New triggers:**
- Total estimated context > 50%
- Any single task group > 30%
- Multiple subsystems (different concerns) in one spec
- Both creation AND complex modification in same group

### 4. Per-Task-Group Estimation

In Implementation Tasks, show context estimate per group:

```markdown
| Group | Wave | Tasks | Est. Context | Cumulative |
|-------|------|-------|--------------|------------|
| G1 | 1 | Create types | ~8% | 8% |
| G2 | 2 | Create handler A | ~22% | 30% |
| G3 | 2 | Create handler B | ~18% | 48% |
| G4 | 3 | Integration | ~12% | 60% W |
```

#### Warning Thresholds (Two Purposes)

| Metric | Threshold | Purpose | Action |
|--------|-----------|---------|--------|
| Per-group | >30% | Single group too large for one worker | Split group into subgroups |
| Cumulative | >60% | Spec large but groups are reasonable | Use orchestrated mode |

**Examples:**

- 3 groups × 20% = 60% cumulative, but per-group OK → orchestrated mode handles it
- 1 group at 35% = per-group warning → must split that group

Both thresholds serve different decomposition decisions.

### 5. Worker Budget Guidance

Orchestrator passes context budget to workers:

```markdown
<context_budget>
Estimated: ~22%
Target max: 30%
If approaching limit, prioritize core functionality over edge cases.
</context_budget>
```

Workers can use this to make trade-off decisions.

## Files to Modify

| File | Changes |
|------|---------|
| `agents/spec-auditor.md` | Replace file counts with context %, add quality projection |
| `agents/spec-executor-orchestrator.md` | Add context budget to worker prompts |
| `templates/spec.md` | Update Implementation Tasks with Est. Context column |

## Acceptance Criteria

1. **Auditor estimates context %** per task group
2. **Quality curve shown** in audit output
3. **NEEDS_DECOMPOSITION at >50%** total estimated context
4. **Warning at >30%** per task group
5. **Workers receive budget guidance** from orchestrator
6. **Backward compatible**: Old specs without estimates still work

## Constraints

- Estimates are heuristics, not guarantees
- Don't over-engineer estimation — rough accuracy is fine
- Workers should not fail solely based on budget (guidance only)

## Scope Sanity Thresholds (from GSD)

| Metric | Target | Warning | Blocker |
|--------|--------|---------|---------|
| Tasks/plan | 2-3 | 4 | 5+ |
| Files/plan | 5-8 | 10 | 15+ |
| Total context | ~50% | ~70% | 80%+ |

**Red flags:**
- Plan with 5+ tasks (quality degrades)
- Plan with 15+ file modifications
- Single task with 10+ files
- Complex work (auth, payments) crammed into one plan

## Estimation Heuristics

### File-Based Rough Estimate

Auditor estimates by file type/purpose — **does NOT read source files** during audit (avoids context overhead).

| File Type | Typical Lines | Est. Context |
|-----------|---------------|--------------|
| Types/interfaces | 50-100 | 2-3% |
| Simple handler | 100-200 | 3-5% |
| Complex handler | 200-400 | 5-8% |
| Test file | 150-300 | 3-5% |
| Config/utility | 50-100 | 2-3% |

### File Count Impact (from GSD)

| Files Modified | Context Impact |
|----------------|----------------|
| 0-3 files | ~10-15% (small) |
| 4-6 files | ~20-30% (medium) |
| 7+ files | ~40%+ (large — split) |

### Task-Based Rough Estimate (from GSD)

| Task Complexity | Context/Task |
|-----------------|--------------|
| Simple CRUD | ~15% |
| Business logic | ~25% |
| Complex algorithms | ~40% |
| Domain modeling | ~35% |

**Planning budget by complexity:**

| Task Complexity | Tasks/Plan | Context/Task | Total |
|-----------------|------------|--------------|-------|
| Simple (CRUD, config) | 3 | ~10-15% | ~30-45% |
| Complex (auth, payments) | 2 | ~20-30% | ~40-50% |
| Very complex (migrations) | 1-2 | ~30-40% | ~30-50% |

### Example Calculation

Task: "Create user authentication handler"
- Create auth-handler.ts (~300 lines, estimated): 3% + 1.5% = 4.5%
- Modify user-types.ts (add ~50 lines, estimated): 4% + 0.25% = 4.25%
- Create auth.test.ts (~200 lines, estimated): 3% + 1% = 4%
- Multiplier (auth = security-sensitive): 1.5x

**Total:** (4.5% + 4.25% + 4%) x 1.5 = **19.1%** estimated

---

## Audit History

### Audit v1 (2026-01-24)
**Status:** APPROVED

**Comment:** Well-structured specification with clear estimation heuristics and concrete acceptance criteria. The context-percentage approach aligns with GSD patterns and provides better decomposition guidance than file counts.

**Recommendations:**
1. Consider clarifying how "Worker overhead" metric is calculated (currently undefined).
2. Note inconsistency between per-group warning (>30%) and cumulative warning (60%+) in examples - both are valid but serve different purposes.
3. For line-count estimation, auditor may need to estimate based on file type/purpose rather than reading files (to avoid context overhead).

### Response v1 (2026-01-24)
**Applied:** All 3 recommendations + GSD pattern integration

**Changes:**
1. [x] Worker overhead — Refined with precise breakdown: PROJECT.md (~2%), task parsing (~1%), JSON result (~1%), deviation buffer (~1%) = ~5% total
2. [x] Warning thresholds — Added table with examples: 3x20%=60% cumulative but OK -> orchestrated mode; 1x35% per-group -> must split
3. [x] Line estimation — Replaced formula with clean table by file type (types 2-3%, handlers 3-8%, tests 3-5%)
4. [x] GSD patterns — Added File Count Impact table (0-3 files ~15%, 4-6 ~30%, 7+ split)
5. [x] GSD patterns — Added Task Complexity table (CRUD ~15%, business ~25%, algorithms ~40%)
6. [x] GSD patterns — Added Scope Sanity Thresholds (tasks/plan, files/plan, red flags)

### Audit v2 (2026-01-24)
**Status:** APPROVED

**Comment:** All v1 recommendations have been addressed comprehensively. The specification now includes detailed worker overhead breakdown, clarified warning threshold purposes with examples, file-type-based estimation tables, and integrated GSD patterns. The spec is well-structured, implementable, and ready for execution.

---

## Execution Summary

**Executed:** 2026-01-24
**Mode:** direct
**Commits:** 3

### Files Modified

- `agents/spec-auditor.md` — replaced file counts with context % estimates, added quality curve, estimation rules, worker overhead breakdown, scope sanity thresholds
- `agents/spec-executor-orchestrator.md` — added context budget guidance to worker protocol and prompts
- `templates/spec.md` — added Cumulative column to Task Groups table, added context threshold documentation

### Acceptance Criteria Status

- [x] **Auditor estimates context %** per task group — Added Per-Task-Group Breakdown table with Est. Context and Cumulative columns
- [x] **Quality curve shown** in audit output — Added Quality Projection table showing 0-30%/30-50%/50-70%/70%+ ranges
- [x] **NEEDS_DECOMPOSITION at >50%** total estimated context — Updated decomposition triggers in Step 3.5
- [x] **Warning at >30%** per task group — Added warning thresholds documentation
- [x] **Workers receive budget guidance** from orchestrator — Added context_budget section to worker protocol and example prompts
- [x] **Backward compatible**: Old specs without estimates still work — Orchestrator preserves fallback wave computation for legacy specs

### Deviations

None. All requirements implemented as specified.

### Notes

- The context estimation is heuristic-based (estimates by file type/purpose without reading source files)
- Worker overhead breakdown added: PROJECT.md (~2%), task parsing (~1%), JSON result (~1%), deviation buffer (~1%) = ~5% total
- Both per-group (>30%) and cumulative (>60%) thresholds documented with different purposes and actions

---

## Review History

### Review v1 (2026-01-24)
**Result:** APPROVED
**Reviewer:** impl-reviewer (subagent)

**Findings:**

**Passed:**
- [x] **Auditor estimates context %** per task group — Comprehensive context estimation rules added to `agents/spec-auditor.md` (lines 63-119), including file type tables, operation-based estimates, complexity multipliers, and per-task-group breakdown tables (lines 224-235)
- [x] **Quality curve shown** in audit output — Quality Projection table implemented at lines 52-62 (definition) and lines 211-220/447-458 (output templates) showing PEAK/GOOD/DEGRADING/POOR ranges
- [x] **NEEDS_DECOMPOSITION at >50%** total estimated context — Decomposition Triggers section (lines 236-242) explicitly lists "Total estimated context >50%" as a trigger
- [x] **Warning at >30%** per task group — Warning thresholds documented at lines 231-235 with clear guidance: "Per-group >30%: Single group too large -> split the group"
- [x] **Workers receive budget guidance** from orchestrator — Complete context_budget section added to `agents/spec-executor-orchestrator.md` (lines 88-104) with template and worker spawn examples (lines 175-191)
- [x] **Backward compatible** — Fallback for legacy specs explicitly handled in orchestrator (lines 146-165) with wave computation from dependencies

**File Verification:**
- [x] `agents/spec-auditor.md` — Context estimation rules, quality curve, scope sanity thresholds all present
- [x] `agents/spec-executor-orchestrator.md` — Context budget guidance in worker protocol and example prompts
- [x] `templates/spec.md` — Cumulative column in Task Groups table (line 54), context threshold documentation (lines 61-64)

**Summary:** All 6 acceptance criteria are fully implemented. The implementation follows the specification precisely with no deviations. Code quality is good with clear documentation and proper integration with existing SpecFlow patterns.

---

## Completion

**Completed:** 2026-01-24
**Total Commits:** 3
**Audit Cycles:** 2
**Review Cycles:** 1
