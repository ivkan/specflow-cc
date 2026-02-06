---
id: SPEC-002
title: Ensure spec-creator and spec-splitter always include Wave column in Implementation Tasks
type: feature
status: done
priority: medium
complexity: small
created: 2026-02-06
---

# Ensure spec-creator and spec-splitter always include Wave column in Implementation Tasks

## Context

The SpecFlow framework already has wave-based parallelization infrastructure:
- The **spec-auditor** computes waves in Step 4 + Step 4.5 (added by SPEC-GSD-B), but only for large specs that trigger NEEDS_DECOMPOSITION.
- The **spec-executor-orchestrator** reads pre-computed wave numbers from the Implementation Tasks table, with a fallback for legacy specs.
- The **spec template** (`templates/spec.md`) already includes Wave column in its example Implementation Tasks table.

However, the **spec-creator** agent (`agents/spec-creator.md`) contains no instructions to generate Implementation Tasks with Wave numbers. When a spec-creator produces a medium-complexity spec that includes an Implementation Tasks section, waves are absent. The orchestrator must then fall back to computing waves from dependencies at runtime, defeating the purpose of pre-computation.

Similarly, the **spec-splitter** agent (`agents/spec-splitter.md`) creates child specifications but does not include Wave columns in their Implementation Tasks tables.

This creates an inconsistency: the auditor and template define the Wave column, but the two agents that create specs from scratch (creator and splitter) do not generate it.

## Task

Add explicit instructions to `agents/spec-creator.md` and `agents/spec-splitter.md` requiring them to include the Wave column and Execution Plan in any Implementation Tasks section they generate.

## Requirements

### Files to Modify

1. **`agents/spec-creator.md`**
   - Add a new step (or extend Step 5) with instructions to generate Implementation Tasks with Wave column for medium and large specs.
   - Include the wave assignment algorithm (same as auditor Step 4.5): groups with no dependencies get Wave 1; groups whose dependencies all have waves get Wave = max(dependency waves) + 1.
   - Include the Execution Plan summary table (Wave, Groups, Parallel?, Workers).
   - Reference the existing table format from `templates/spec.md`.

2. **`agents/spec-splitter.md`**
   - In Step 6 (Create Child Specifications), add instructions to include Implementation Tasks with Wave column when a child spec has multiple task groups.
   - Include the wave assignment algorithm.
   - Include the Execution Plan summary.

### Spec-Creator Changes (Detail)

In `agents/spec-creator.md`, add a new step between the current Step 5 (Create Specification) and Step 6 (Estimate Complexity). This step should instruct the creator to:

1. For **medium** and **large** complexity specs: always generate an Implementation Tasks section.
2. Group tasks logically (types/interfaces first, independent implementations in parallel, integration last).
3. Assign wave numbers using the algorithm:
   - Groups with no dependencies: Wave 1
   - Groups whose dependencies all have waves: Wave = max(dependency waves) + 1
   - If circular dependency detected: flag in spec as a note for auditor
4. Add the Task Groups table with columns: Group, Wave, Tasks, Dependencies, Est. Context.
5. Add the Execution Plan summary table.
6. For **small** complexity specs: Implementation Tasks section is optional (skip if only 1-2 files).

### Spec-Splitter Changes (Detail)

In `agents/spec-splitter.md`, update Step 6 (Create Child Specifications) to include:

1. When a child spec contains 3+ task groups, generate an Implementation Tasks section with Wave column.
2. Apply the same wave assignment algorithm.
3. Add the Execution Plan summary table.

### Wave Assignment Algorithm (for reference in both agents)

```
1. For each group with no dependencies: wave = 1
2. Repeat until all groups assigned:
   - For each unassigned group:
     - If all dependencies have assigned waves:
       - wave = max(dependency waves) + 1
3. If groups remain unassigned after a full pass with no progress: circular dependency exists
```

### Execution Plan Format (for reference in both agents)

```markdown
### Execution Plan

| Wave | Groups | Parallel? | Workers |
|------|--------|-----------|---------|
| 1 | G1 | No | 1 |
| 2 | G2, G3 | Yes | 2 |
| 3 | G4 | No | 1 |

**Total workers needed:** 2 (max in any wave)
```

## Acceptance Criteria

- [ ] 1. `agents/spec-creator.md` contains explicit instructions to generate Implementation Tasks with Wave column for medium and large specs
- [ ] 2. `agents/spec-creator.md` contains the wave assignment algorithm (groups with no deps get Wave 1; others get max(dep waves) + 1)
- [ ] 3. `agents/spec-creator.md` contains instructions to generate the Execution Plan summary table
- [ ] 4. `agents/spec-splitter.md` contains instructions to include Wave column in child spec Implementation Tasks when child has 3+ task groups
- [ ] 5. `agents/spec-splitter.md` contains the wave assignment algorithm
- [ ] 6. The wave assignment algorithm in both files is consistent with the algorithm in `agents/spec-auditor.md` Step 4.5
- [ ] 7. Small specs are explicitly exempted from mandatory Implementation Tasks generation

## Constraints

- DO NOT modify `agents/spec-auditor.md` (it already has wave computation in Step 4.5)
- DO NOT modify `agents/spec-executor-orchestrator.md` (it already reads pre-computed waves)
- DO NOT modify `templates/spec.md` (it already has the correct format)
- DO NOT remove the orchestrator's fallback for legacy specs without Wave column
- DO NOT add spec/phase references in code comments
- KEEP the wave algorithm consistent across all three agents (creator, splitter, auditor) -- same logic, same format

## Assumptions

- The spec-creator should generate Implementation Tasks for medium specs (not just large ones), since medium specs can also benefit from wave-based execution planning
- The threshold for spec-splitter generating Implementation Tasks in child specs is 3+ task groups (below that, the overhead of an Implementation Tasks section outweighs its value)
- The wave assignment algorithm does not need circular dependency error formatting in the creator/splitter (the auditor will catch and format those errors during audit)
- The Execution Plan format matches the existing format in `templates/spec.md` and `agents/spec-auditor.md`

---

## Audit History

### Audit v1 (2026-02-06)
**Status:** APPROVED

**Context Estimate:** ~15% total

**Dimensions Evaluated:**
- Clarity: PASS -- title, context, task, and requirements are specific and unambiguous
- Completeness: PASS -- both target files identified, algorithm and format provided, edge cases (small specs) addressed
- Testability: PASS -- all 7 acceptance criteria are concrete and verifiable by inspecting file contents
- Scope: PASS -- 6 explicit constraints prevent scope creep, complexity "small" is accurate for adding instructional text to 2 markdown files
- Feasibility: PASS -- straightforward text additions to existing agent definitions
- Architecture fit: PASS -- extends existing wave infrastructure pattern consistently across agents
- Non-duplication: PASS -- explicitly reuses auditor algorithm and template format rather than inventing new ones
- Cognitive load: PASS -- same algorithm/format across all agents reduces developer confusion
- Strategic fit: PASS -- closes an identified inconsistency gap in the wave-based execution infrastructure
- Project compliance: PASS -- no PROJECT.md exists; spec is consistent with architecture decisions documented in STATE.md

**Assumptions Assessed:**

| # | Assumption | If wrong, impact |
|---|------------|------------------|
| A1 | Spec-creator has no wave instructions | Verified: confirmed by reading agents/spec-creator.md |
| A2 | Spec-splitter has no wave instructions | Verified: confirmed by reading agents/spec-splitter.md |
| A3 | Medium specs benefit from wave pre-computation | Low impact if wrong -- orchestrator fallback still works |
| A4 | 3+ task groups threshold for splitter | Low impact if wrong -- easily adjustable |

**Recommendations:**
1. The spec instructs adding "a new step between Step 5 and Step 6" in the creator, which will require renumbering existing Steps 6-7 to Steps 7-8 (or using Step 5.5). Consider specifying the preferred numbering approach to avoid implementer ambiguity -- the codebase already uses the "Step N.5" pattern (see Step 2.5 in spec-creator.md), which would avoid renumbering.

**Comment:** Well-structured, focused specification. The problem is clearly identified (inconsistency between agents), the solution is specific (add wave instructions to two files), and the acceptance criteria are concrete. The constraints properly protect existing infrastructure from unintended changes.

### Response v1 (2026-02-06)
**Applied:** User review of recommendations

**Changes:**
1. [✗] Step numbering approach (Step 5.5 vs renumbering) — Skipped by user; executor can decide numbering at implementation time

---

## Execution Summary

**Executed:** 2026-02-06
**Commits:** 2

### Files Modified

- `agents/spec-creator.md` — Added Step 5.5 with Wave column instructions for medium and large specs, including wave assignment algorithm and Execution Plan format
- `agents/spec-splitter.md` — Updated Step 6 with Wave column instructions for child specs with 3+ task groups, including wave assignment algorithm and Execution Plan format

### Acceptance Criteria Status

- [x] 1. `agents/spec-creator.md` contains explicit instructions to generate Implementation Tasks with Wave column for medium and large specs
- [x] 2. `agents/spec-creator.md` contains the wave assignment algorithm (groups with no deps get Wave 1; others get max(dep waves) + 1)
- [x] 3. `agents/spec-creator.md` contains instructions to generate the Execution Plan summary table
- [x] 4. `agents/spec-splitter.md` contains instructions to include Wave column in child spec Implementation Tasks when child has 3+ task groups
- [x] 5. `agents/spec-splitter.md` contains the wave assignment algorithm
- [x] 6. The wave assignment algorithm in both files is consistent with the algorithm in `agents/spec-auditor.md` Step 4.5
- [x] 7. Small specs are explicitly exempted from mandatory Implementation Tasks generation

### Implementation Details

**spec-creator.md:**
- Added Step 5.5 (between Step 5 and Step 6) to avoid renumbering existing steps
- Instructions include when to include Implementation Tasks (medium/large mandatory, small optional)
- Wave assignment algorithm matches auditor's algorithm exactly
- Implementation Tasks table format includes Wave column
- Execution Plan format matches template and auditor
- Circular dependency detection note added for creator awareness

**spec-splitter.md:**
- Updated Step 6 to include Implementation Tasks instructions
- 3+ task groups threshold for including Implementation Tasks section
- Wave assignment algorithm matches auditor's algorithm exactly
- Same table and Execution Plan formats as creator and auditor
- Threshold note clarifies when to include Implementation Tasks

**Algorithm Consistency Verification:**
All three agents (spec-creator.md, spec-splitter.md, spec-auditor.md) now use the identical wave assignment algorithm:
1. Initialize all groups with wave = 0
2. Groups with no dependencies get wave = 1
3. Groups whose dependencies all have waves get wave = max(dep waves) + 1
4. Circular dependency detection if groups remain unassigned

### Notes

- No deviations applied (Rules 1-3)
- Implementation follows specification exactly
- Wave algorithm is now consistent across all three agents
- Execution Plan format is consistent with templates/spec.md
- Small spec exemption explicitly documented in both agents

---

## Review History

### Review v1 (2026-02-06)
**Result:** APPROVED
**Reviewer:** impl-reviewer (subagent)

**Findings:**

**Passed:**
- [✓] Acceptance Criterion 1 — `agents/spec-creator.md` Step 5.5 contains explicit instructions for Wave column in medium and large specs (lines 133-137)
- [✓] Acceptance Criterion 2 — `agents/spec-creator.md` contains wave assignment algorithm (lines 156-164), matches specification exactly
- [✓] Acceptance Criterion 3 — `agents/spec-creator.md` contains Execution Plan summary table format (lines 186-199)
- [✓] Acceptance Criterion 4 — `agents/spec-splitter.md` Step 6 contains Wave column instructions for 3+ task groups (line 117, lines 162-164)
- [✓] Acceptance Criterion 5 — `agents/spec-splitter.md` contains wave assignment algorithm (lines 121-129), matches specification exactly
- [✓] Acceptance Criterion 6 — Wave assignment algorithms are identical across all three agents (verified via grep: spec-creator.md, spec-splitter.md, spec-auditor.md all use same 4-step algorithm)
- [✓] Acceptance Criterion 7 — Small specs explicitly exempted in `agents/spec-creator.md` line 137: "Small complexity specs: Optional (skip if only 1-2 files or simple change)"
- [✓] Constraint compliance — No modifications to `agents/spec-auditor.md`, `agents/spec-executor-orchestrator.md`, or `templates/spec.md` (verified via git log)
- [✓] Wave algorithm consistency — All three files use identical algorithm: initialize wave=0, no deps get wave=1, others get max(dep waves)+1, circular dependency detection
- [✓] Execution Plan format consistency — All three agents use identical table format with Wave, Groups, Parallel?, Workers columns
- [✓] Implementation Tasks table format — All three agents use identical format with Group, Wave, Tasks, Dependencies, Est. Context columns
- [✓] Code quality — Clear, readable additions; follows existing document structure and formatting patterns
- [✓] Integration — New Step 5.5 in spec-creator fits naturally between Step 5 and Step 6; spec-splitter update integrates smoothly into Step 6
- [✓] Documentation clarity — Instructions are specific and actionable; examples provided match template format

**Summary:**

Implementation is complete and fully compliant with all acceptance criteria and constraints. The wave assignment algorithm is now consistent across all three agents (spec-creator, spec-splitter, spec-auditor), matching the specification exactly. Both modified files include proper Wave column instructions, wave assignment algorithms, and Execution Plan formats. Small specs are appropriately exempted, and the 3+ task group threshold for spec-splitter is clearly documented. No constrained files were modified. Code quality is high, with clear integration into existing agent structures.

---

## Completion

**Completed:** 2026-02-06
**Total Commits:** 2
**Review Cycles:** 1
