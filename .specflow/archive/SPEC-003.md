# SPEC: Segmented Execution Within Task Groups

---
id: SPEC-003
type: feature
status: done
priority: medium
complexity: medium
created: 2026-02-06
---

## Context

### Problem Statement

When the orchestrator executes a large specification, it splits work into task groups and runs each group in a worker subagent. However, a single task group can itself be large enough to degrade quality as the worker's context fills up. Currently there is no mechanism to subdivide a task group into smaller pieces that each run in a fresh context.

### Why This Matters

LLM output quality degrades as context usage increases:

| Context Range | Expected Quality |
|---------------|------------------|
| 0-30% | PEAK |
| 30-50% | GOOD |
| 50-70% | DEGRADING |
| 70%+ | POOR |

A task group estimated at ~25-30% context will push a worker into the DEGRADING range once you add overhead (reading files, processing instructions, writing code, committing). By splitting the group into 2-3 segments, each segment stays in the PEAK range.

### Current Architecture

```
Orchestrator
  |
  +-- Wave 1: [G1] -> 1 worker (full group)
  |
  +-- Wave 2: [G2, G3] -> 2 workers (each gets full group)
  |
  +-- Wave 3: [G4] -> 1 worker (full group)
```

### Target Architecture

```
Orchestrator
  |
  +-- Wave 1: [G1] -> 1 worker (small group, no segmentation)
  |
  +-- Wave 2: [G2, G3] -> G2 is large, gets segmented:
  |     |
  |     +-- G2-S1 -> worker (fresh context, files 1-3)
  |     +-- G2-S1 complete -> G2-S2 -> worker (fresh context, files 4-6, receives G2-S1 summary)
  |     |
  |     +-- G3 -> 1 worker (small group, no segmentation)
  |
  +-- Wave 3: [G4] -> 1 worker (full group)
```

### GSD Inspiration

The GSD execute-plan pattern runs each plan segment as an autonomous subagent with fresh context, passing only a compact summary of prior work to the next segment. This prevents context accumulation and quality degradation on long tasks.

### Goal Analysis

**Goal:** Maintain PEAK/GOOD quality throughout execution of large task groups by preventing context accumulation within individual workers.

**Observable Truths:**
1. A task group with estimated context above the segmentation threshold is automatically divided into sequential segments by the orchestrator
2. Each segment executes in a fresh worker subagent with its own full 200k context window
3. A segment receives only a compact handoff summary from prior segments (not the full prior context)
4. The orchestrator aggregates all segment results into a single standard worker JSON response per task group
5. Non-large task groups execute exactly as they do today (no behavior change)
6. The auditor can optionally pre-compute segment hints in the Implementation Tasks table

**Required Artifacts:**
- `agents/spec-executor-orchestrator.md` (both versions) -- segmentation decision logic, segment spawning, segment result aggregation
- `agents/spec-executor-worker.md` -- segment-awareness (accepting prior-segment summary, scoped deliverables)
- `agents/spec-auditor.md` -- optional segment hints in task group generation

**Key Links:**
- Orchestrator segmentation threshold -> auditor's Est. Context values (must be consistent)
- Segment handoff summary -> worker's prior-segment intake (format must match)
- Per-segment results -> orchestrator's aggregation logic (must produce standard group JSON)

## Task

Add segmented execution capability to the orchestrator and worker agents so that large task groups are automatically subdivided into sequential segments, each executed in a fresh subagent context.

## Requirements

### 1. Segmentation Decision Logic in Orchestrator

Add segmentation logic to both `spec-executor-orchestrator.md` and `sf-spec-executor-orchestrator.md`.

**New Step 3.05: Evaluate Segmentation (insert before Step 3.1: Spawn Workers)**

**Note on step numbering:** The two orchestrator files use different step numbering schemes. See the "Orchestrator Step Numbering Reference" section below for equivalent insertion points.

The orchestrator evaluates each task group in the current wave before spawning workers:

```markdown
## Step 3.05: Evaluate Segmentation

For each task group in the current wave, check if segmentation is needed.

**Segmentation threshold:** Est. Context >= 20%

**Decision logic:**

| Est. Context | Segment Count | Rationale |
|--------------|---------------|-----------|
| < 20% | 1 (no segmentation) | Fits comfortably in fresh context |
| 20-35% | 2 segments | Split to keep each segment in PEAK range |
| 35-50% | 3 segments | Three-way split for larger groups |
| > 50% | 4 segments (default) + warning | Group should have been split by auditor; flag as warning but proceed with 4-way split |

**How to determine segment boundaries:**

Parse the task group's task list and divide at natural boundaries:
1. File boundaries (each segment handles a subset of files)
2. Logical unit boundaries (types first, then implementations, then wiring)
3. If tasks are numbered (T1, T2, T3...), divide the task numbers evenly

**Segment plan format:**

For each segmented group, create a segment plan:

| Segment | Tasks | Files | Est. Context |
|---------|-------|-------|--------------|
| G2-S1 | Create types, Create handler-a | types.ts, handler-a.ts | ~12% |
| G2-S2 | Create handler-b, Create tests | handler-b.ts, tests.ts | ~13% |

**Pre-computed segments from auditor:**

If the Implementation Tasks table includes a `Segments` column, use those segment boundaries instead of computing them at runtime.
```

### 2. Sequential Segment Spawning in Orchestrator

Add segment spawning logic to both orchestrator agents.

**Modify Step 3.1: Spawn Workers to handle segmented groups**

```markdown
### 3.1 Spawn Workers

For each task group in the current wave:

**If group is NOT segmented (standard path):**

Spawn worker as today (unchanged).

**If group IS segmented:**

Execute segments sequentially within the group, each in a fresh worker:

Segment 1:
Task(prompt="<task_group>G2-S1: Create types and handler-a</task_group>
<segment_info>
Segment 1 of 2 for group G2.
This is the FIRST segment. No prior work exists.
</segment_info>
<requirements>{G2-S1 requirements}</requirements>
<project_patterns>@.specflow/PROJECT.md</project_patterns>
<context_budget>
Estimated: ~12%
Target max: 25%
</context_budget>
Implement this segment. Create atomic commits.
Return JSON: {group, segment, status, files_created, files_modified, commits, criteria_met, deviations, error}
", subagent_type="sf-spec-executor-worker", model="{profile_model}", description="Execute G2 segment 1/2")

Wait for Segment 1 result, then:

Segment 2:
Task(prompt="<task_group>G2-S2: Create handler-b and tests</task_group>
<segment_info>
Segment 2 of 2 for group G2.
Prior segment completed. Summary of prior work:
</segment_info>
<prior_segment_summary>
Files created: types.ts, handler-a.ts
Key exports: Type definitions (UserType, ConfigType), HandlerA class with process() method
Commits: abc123, def456
</prior_segment_summary>
<requirements>{G2-S2 requirements}</requirements>
<project_patterns>@.specflow/PROJECT.md</project_patterns>
<context_budget>
Estimated: ~13%
Target max: 25%
</context_budget>
Implement this segment. Create atomic commits.
You can reference files created by prior segments but do NOT re-read them unless you need specific details.
Return JSON: {group, segment, status, files_created, files_modified, commits, criteria_met, deviations, error}
", subagent_type="sf-spec-executor-worker", model="{profile_model}", description="Execute G2 segment 2/2")

**Important:** Segments within a group are ALWAYS sequential (never parallel) because later segments depend on earlier ones.

**Parallel behavior:** Non-segmented groups in the same wave still run in parallel alongside segmented groups. The segmented group's sequential segments run independently of other groups.
```

**Note:** The example shown above (lines 180-184) is abbreviated for illustration. The canonical handoff summary format with full structure is defined in Requirement 3 below.

### 3. Segment Handoff Summary Format

Define the compact handoff format that passes between segments.

**Handoff summary structure (passed from orchestrator to next segment worker):**

This is the canonical format. The abbreviated example in Requirement 2 is for illustration only.

```markdown
<prior_segment_summary>
## Completed Segments

### Segment 1 of N
**Status:** complete
**Files created:**
- `path/to/file1.ts` -- brief description (key exports: X, Y)
- `path/to/file2.ts` -- brief description (key exports: Z)

**Files modified:**
- `path/to/existing.ts` -- what changed

**Commits:** hash1, hash2

**Key interfaces/types defined:**
- InterfaceName: { field1: type, field2: type }
- TypeName: description

### Segment 2 of N (if applicable)
...
</prior_segment_summary>
```

**Rules for handoff summary:**
- Include file paths and key exports (not full file contents)
- Include interface/type signatures if they are needed by later segments
- Include commit hashes for state tracking
- Maximum ~500 words per segment summary
- Do NOT include implementation details, only the public API surface

### 4. Segment-Aware Worker Response

Modify `spec-executor-worker.md` to accept and return segment information.

**Update Step 1: Parse Assignment to handle segment info:**

```markdown
## Step 1: Parse Assignment

From orchestrator prompt, extract:
- Task group ID (e.g., "G2")
- **Segment info (if present):** segment number, total segments
- **Prior segment summary (if present):** files created, key exports, commits
- Task description
- Requirements for this group/segment
- Interfaces/types to use
- Project patterns reference

**If segment info is present:**
- This is a segmented execution
- Focus ONLY on tasks assigned to this segment
- Use prior segment summary to understand what already exists
- Do NOT re-read files from prior segments unless you need specific implementation details
```

**Update Step 6: Return Results to include segment field:**

```markdown
## Step 6: Return Results

Output structured JSON for orchestrator:

{Standard response for non-segmented execution - unchanged}

**For segmented execution, add segment fields:**

{
  "group": "G2",
  "segment": 1,
  "segment_total": 2,
  "status": "complete",
  "files_created": ["path/to/types.ts", "path/to/handler-a.ts"],
  "files_modified": [],
  "commits": ["abc123", "def456"],
  "criteria_met": ["Types defined", "HandlerA implemented"],
  "deviations": [],
  "error": null,
  "handoff_summary": {
    "key_exports": ["UserType", "ConfigType", "HandlerA"],
    "interfaces": "UserType: { id: string, name: string }",
    "notes": "HandlerA expects ConfigType in constructor"
  }
}
```

**The `handoff_summary` field** is generated by the worker to help the orchestrator create the `<prior_segment_summary>` for the next segment. It contains:
- Key exports from created files
- Interface/type signatures that later segments will need
- Brief notes about design decisions or conventions established

### 5. Segment Result Aggregation in Orchestrator

Add result aggregation logic that merges segment results into a single group result.

**New Step 3.15: Aggregate Segment Results (after collecting all segment results for a group)**

```markdown
### 3.15 Aggregate Segment Results

After all segments for a group complete, merge results into a single group result:

{
  "group": "G2",
  "status": "{worst status among segments: failed > partial > complete}",
  "files_created": ["{union of all segments' files_created}"],
  "files_modified": ["{union of all segments' files_modified}"],
  "commits": ["{concatenation of all segments' commits in order}"],
  "criteria_met": ["{union of all segments' criteria_met}"],
  "deviations": ["{concatenation of all segments' deviations}"],
  "error": "{first non-null error, or null}",
  "segmented": true,
  "segment_count": 2,
  "segment_results": [
    {"segment": 1, "status": "complete", ...},
    {"segment": 2, "status": "complete", ...}
  ]
}

This aggregated result feeds into the existing Step 3.2 (Collect Results) and Step 3.3 (Update State Per Worker) unchanged.
```

**Segment failure handling:**

| Scenario | Action |
|----------|--------|
| Segment N fails | Abort remaining segments for this group, mark group as failed |
| Segment N partial | Continue to next segment with available results, mark group as partial |
| All segments complete | Aggregate into single group result, mark group as complete |

### 6. Optional Segment Hints in Auditor

Update `spec-auditor.md` to optionally provide segment hints for large task groups.

**Add to Step 4 (Generate Implementation Tasks), after the existing task group generation:**

```markdown
### Segment Hints for Large Groups

After generating task groups, check if any single group has Est. Context >= 20%.

If so, add a `Segments` column to the Implementation Tasks table:

| Group | Wave | Tasks | Dependencies | Est. Context | Segments |
|-------|------|-------|--------------|--------------|----------|
| G1 | 1 | Create types | - | ~8% | 1 |
| G2 | 2 | Create handlers, tests, validation | G1 | ~28% | 2 |
| G3 | 2 | Create UI components | G1 | ~10% | 1 |

For groups with Segments > 1, add segment breakdown in the Execution Plan:

**G2 Segments:**
- S1: Create handlers (handler-a.ts, handler-b.ts) -- ~14%
- S2: Create tests and validation (handler.test.ts, validation.ts) -- ~14%
```

### 7. Update State File for Segment Tracking

Extend the execution state JSON to track segment progress within groups.

**In `spec-executor-orchestrator.md`, update the state structure in the State Management philosophy section:**

```json
{
  "waves": [
    {
      "id": 2,
      "status": "in_progress",
      "results": {
        "G2": {
          "status": "in_progress",
          "segmented": true,
          "segment_count": 2,
          "segments": [
            {
              "segment": 1,
              "status": "complete",
              "commits": ["abc123"],
              "files_created": ["types.ts"],
              "handoff_summary": "..."
            },
            {
              "segment": 2,
              "status": "running",
              "commits": [],
              "files_created": []
            }
          ]
        },
        "G3": {
          "status": "complete",
          "segmented": false,
          "commits": ["def456"]
        }
      }
    }
  ]
}
```

This enables resume to pick up at the exact segment that was interrupted.

### Orchestrator Step Numbering Reference

The two orchestrator files use different step numbering schemes. Use this table to locate equivalent insertion points:

| Change | Full Orchestrator (`spec-executor-orchestrator.md`) | Simpler Orchestrator (`sf-spec-executor-orchestrator.md`) |
|--------|-----------------------------------------------------|----------------------------------------------------------|
| **Evaluate Segmentation** (Req 1) | Insert as **Step 3.05** (before Step 3.1: Spawn Workers) | Insert as **Step 3.05** (before Step 3.1: Spawn Workers, which is under Step 4: Execute Waves) |
| **Modify Spawn Workers** (Req 2) | Modify existing **Step 3.1: Spawn Workers** | Modify existing **Step 3.1: Spawn Workers** (under Step 4: Execute Waves) |
| **Aggregate Segment Results** (Req 5) | Insert as **Step 3.15** (after Step 3.1 completes per group) | Insert as **Step 3.15** (after Step 3.1 completes per group, before Step 3.2: Collect Results) |
| **State File Updates** (Req 7) | Update state structure in **State Management philosophy section** | N/A (simpler orchestrator has no state management) |

**Key difference:** The simpler orchestrator (`sf-spec-executor-orchestrator.md`) nests the execution steps under "Step 4: Execute Waves" with sub-steps 3.1, 3.2, 3.3, while the full orchestrator uses "Step 3: Execute Waves" with sub-steps 3.0-3.6. Despite the different top-level step numbers, the sub-step numbers (3.05, 3.1, 3.15) should be consistent across both files for easier cross-referencing.

## Files to Modify

| File | Changes |
|------|---------|
| `agents/spec-executor-orchestrator.md` | Add Step 3.05 (segmentation evaluation), modify Step 3.1 (segment spawning), add Step 3.15 (segment aggregation), update state structure for segments |
| `agents/sf-spec-executor-orchestrator.md` | Same changes as above (this is a copy without state management features) |
| `agents/spec-executor-worker.md` | Update Step 1 (parse segment info), update Step 6 (return segment-aware JSON with handoff_summary) |
| `agents/spec-auditor.md` | Add segment hints to Step 4 (optional Segments column in Implementation Tasks) |

## Acceptance Criteria

1. **Segmentation threshold defined:** Task groups with Est. Context >= 20% are automatically evaluated for segmentation in the orchestrator
2. **Segment count calculated:** Orchestrator determines 2-4 segments based on estimated context ranges (20-35% = 2, 35-50% = 3, >50% = 4 with warning)
3. **Segments execute sequentially:** Each segment of a segmented group runs in a fresh worker subagent, one after another
4. **Handoff summary passed:** Each segment after the first receives a compact summary of prior segments' output (file paths, key exports, commits) not exceeding ~500 words per prior segment
5. **Worker returns segment-aware JSON:** Worker response includes `segment`, `segment_total`, and `handoff_summary` fields when executing a segment
6. **Segment results aggregated:** Orchestrator merges all segment results into a single standard group result before feeding into existing collection/state logic
7. **Non-segmented groups unchanged:** Task groups below the threshold execute identically to current behavior
8. **Auditor generates segment hints:** Auditor adds `Segments` column to Implementation Tasks table when any group has Est. Context >= 20%
9. **State tracks segments:** Execution state JSON includes per-segment progress for segmented groups, enabling resume at the exact interrupted segment

## Constraints

- DO NOT change behavior for task groups below the segmentation threshold (< 20% Est. Context)
- DO NOT run segments in parallel (they are sequential by design since later segments depend on earlier ones)
- DO NOT pass full file contents in handoff summaries (only paths, key exports, and interface signatures)
- DO NOT modify the `/sf:run` command (changes are contained within the orchestrator and worker agents, and the auditor)
- Segmentation is transparent to the final execution summary (the summary shows group results, not individual segment results)
- Maintain backward compatibility with specs that lack a Segments column

## Assumptions

- The existing `Est. Context` values in Implementation Tasks tables are reasonably accurate (within +/-10%)
- The orchestrator has enough context budget to manage segment plans and handoff summaries (these are small, ~2-3% overhead per segmented group)
- Two orchestrator files exist (`spec-executor-orchestrator.md` and `sf-spec-executor-orchestrator.md`) and both need the same segmentation changes -- the `sf-` prefixed version is the simpler one without state management, so state-related segment tracking applies only to the full version
- Natural segment boundaries exist in most task groups (file-level or logical-unit-level division points)
- G1 is estimated at exactly 20% but for markdown modifications this is likely conservative (~15-18% in practice); if implementation proves complex, G1 may be split into separate evaluation/spawning and aggregation sub-groups during execution

## Implementation Tasks

| Group | Wave | Tasks | Dependencies | Est. Context |
|-------|------|-------|--------------|--------------|
| G1 | 1 | Add segmentation evaluation and segment spawning logic to both orchestrator agents | - | ~20% |
| G2 | 1 | Update worker agent to accept segment info and return segment-aware JSON with handoff summary | - | ~12% |
| G3 | 2 | Add segment hints generation to auditor's Implementation Tasks step | G1 | ~10% |
| G4 | 2 | Add segment tracking to execution state structure in full orchestrator | G1 | ~8% |

### Execution Plan

| Wave | Groups | Parallel? | Workers |
|------|--------|-----------|---------|
| 1 | G1, G2 | Yes | 2 |
| 2 | G3, G4 | Yes | 2 |

**Total workers needed:** 2 (max in any wave)

## Audit History

### Audit v1 (2026-02-06)
**Status:** APPROVED

**Context Estimate:** ~50% total

**Per-Group Breakdown:**

| Group | Est. Context | Status |
|-------|--------------|--------|
| G1 | ~20% | At threshold but acceptable for markdown modifications |
| G2 | ~12% | OK |
| G3 | ~10% | OK |
| G4 | ~8% | OK |

**Quality Projection:** GOOD range (at boundary of GOOD/DEGRADING)

**Comment:** Well-structured specification with thorough coverage of segmentation mechanics. All 10 audit dimensions pass. Goal Analysis is complete with full truth-artifact-wiring coverage. Strategic fit is strong -- this is the last major GSD alignment item. No critical issues found.

**Recommendations:**
1. [Architecture] G1 is estimated at exactly the 20% segmentation threshold. For markdown modifications the estimate is likely conservative (~15-18% in practice), but consider whether G1 should be split into separate evaluation/spawning and aggregation sub-groups if implementation proves complex.
2. [Completeness] Handoff summary format differs between Requirement 2 (flat text example on lines 180-184) and Requirement 3 (structured format with headers on lines 207-228). Clarify that Requirement 3 is the canonical format and Requirement 2's example is abbreviated for illustration.
3. [Completeness] The `sf-spec-executor-orchestrator.md` uses different step numbering (Step 3/Step 4 with sub-step "3.1") compared to the full orchestrator (Step 3 with sub-steps 3.0-3.6). The spec should note the equivalent insertion points for the simpler orchestrator so implementers do not misplace the new steps.
4. [Cognitive Load] The >50% decision table entry says "segment into 3-4" which is ambiguous. Consider specifying a concrete default (e.g., always 4 for >50%) to reduce implementer judgment calls.

### Response v1 (2026-02-06 14:30)
**Applied:** All 4 recommendations

**Changes:**
1. [✓] G1 threshold note — Added assumption that G1's 20% estimate is likely conservative (~15-18% in practice) for markdown modifications, with note that G1 may be split during execution if implementation proves complex (line 444 in Assumptions section)
2. [✓] Handoff format clarity — Added explicit note after Requirement 2 example (line 200) clarifying that the abbreviated format is for illustration only and Requirement 3 contains the canonical structured format
3. [✓] Step numbering reference — Added new "Orchestrator Step Numbering Reference" subsection (after Requirement 7) with table mapping step insertion points between full and simpler orchestrator files, explaining the different top-level numbering but consistent sub-step numbering
4. [✓] >50% segment count — Changed decision table entry from "segment into 3-4" to "4 segments (default) + warning" (line 114), removing ambiguity by specifying concrete default of 4 segments with warning flag

**Skipped:** None

### Audit v2 (2026-02-06 15:00)
**Status:** APPROVED

**Context Estimate:** ~50% total

**Revisions Verified:** All 4 recommendations from Audit v1 confirmed applied correctly:
1. G1 threshold note in Assumptions -- verified at line 464
2. Handoff format canonical/abbreviated clarification -- verified at lines 203 and 211
3. Orchestrator Step Numbering Reference table -- verified at lines 415-426
4. >50% segment count changed to "4 segments (default) + warning" -- verified at line 116

**Comment:** Specification is well-structured, complete, and ready for implementation. All 10 audit dimensions pass. Goal Analysis has full truth-artifact-wiring coverage. All v1 recommendations have been properly integrated. The spec clearly defines segmentation thresholds, handoff formats, aggregation logic, and failure handling with concrete, testable acceptance criteria.

**Recommendations:**
1. [Accuracy] Requirement 4 references "Step 5: Return Results" in the worker agent, but the actual worker file (`agents/spec-executor-worker.md`) has Step 5 as "Self-Check" and Step 6 as "Return Results." The implementer should update the correct step (Step 6). The spec's content examples are unambiguous, so this is a minor reference error that will not block implementation.

### Response v2 (2026-02-06)
**Applied:** Audit v2 recommendation 1

**Changes:**
1. [✓] Worker step number reference — Changed "Update Step 5: Return Results" to "Update Step 6: Return Results" in Requirement 4 (line 269) to match actual worker agent step numbering

**Skipped:** None

### Audit v3 (2026-02-06)
**Status:** APPROVED

**Context Estimate:** ~50% total

**Revisions Verified:** Audit v2 recommendation 1 was partially applied:
1. Worker step reference in instruction heading (line 269) -- FIXED: now says "Update Step 6: Return Results" (correct)
2. Worker step reference inside code block (line 272) -- NOT FIXED: still says `## Step 5: Return Results` instead of `## Step 6: Return Results`
3. Worker step reference in Files to Modify table (line 434) -- NOT FIXED: still says "update Step 5" instead of "update Step 6"

The instruction heading (line 269) is the primary reference that implementers will follow, so the fix addresses the most important location. The residual references inside the code block and the Files to Modify table are minor inconsistencies that will not block implementation, since the code block content and the corrected heading together make the intent unambiguous.

**Comment:** Specification remains well-structured, complete, and ready for implementation. All 10 audit dimensions continue to pass. The Response v2 fix was applied to the most important location (the instruction heading) but missed two secondary references. These are cosmetic inconsistencies, not critical issues.

**Recommendations:**
1. [Accuracy] The code block inside Requirement 4 (line 272) still says `## Step 5: Return Results` -- should be changed to `## Step 6: Return Results` to match both the instruction heading (line 269) and the actual worker agent file.
2. [Accuracy] The Files to Modify table (line 434) still says "update Step 5 (return segment-aware JSON with handoff_summary)" -- should be changed to "update Step 6" for consistency.

### Response v3 (2026-02-06)
**Applied:** All 2 recommendations from Audit v3

**Changes:**
1. [✓] Code block step reference — Changed `## Step 5: Return Results` to `## Step 6: Return Results` in Requirement 4 code block (line 272)
2. [✓] Files to Modify table — Changed "update Step 5" to "update Step 6" in worker row of Files to Modify table (line 434)

**Skipped:** None

### Audit v4 (2026-02-06)
**Status:** APPROVED

**Context Estimate:** ~50% total

**Revisions Verified:** Both recommendations from Audit v3 confirmed applied correctly:
1. Code block step reference (line 272) -- FIXED: now says `## Step 6: Return Results`
2. Files to Modify table (line 434) -- FIXED: now says "update Step 6 (return segment-aware JSON with handoff_summary)"

All step references across the specification are now consistent: instruction heading (line 269), code block (line 272), and Files to Modify table (line 434) all correctly reference Step 6.

**Comment:** Specification is complete, consistent, and ready for implementation. All 10 audit dimensions pass. All prior recommendations across 3 audit cycles have been fully applied and verified. No remaining issues of any kind. The spec provides thorough, unambiguous guidance for implementing segmented execution with concrete thresholds, well-defined handoff formats, clear failure handling, and proper backward compatibility.

---

## Execution Summary

**Executed:** 2026-02-06
**Mode:** orchestrated
**Commits:** 4

### Execution Waves

| Wave | Groups | Status |
|------|--------|--------|
| 1 | G1, G2 | complete |
| 2 | G3, G4 | complete |

### Files Modified

**Wave 1:**
- `agents/spec-executor-orchestrator.md` (G1) - Added segmentation evaluation, segment spawning, segment aggregation, and state tracking
- `agents/sf-spec-executor-orchestrator.md` (G1) - Added same segmentation capabilities to simpler orchestrator
- `agents/spec-executor-worker.md` (G2) - Added segment info parsing and segment-aware JSON response with handoff summary

**Wave 2:**
- `agents/spec-auditor.md` (G3) - Added segment hints generation in Step 4.45

### Commits

1. `2eb886c` - feat(sf-003): add segmented execution to full orchestrator
2. `76f7e59` - feat(sf-003): add segmented execution to simpler orchestrator
3. `b8ec1c0` - feat(sf-003): add segment awareness to worker agent
4. `1e1d8fc` - feat(sf-003): add segment hints to auditor

### Acceptance Criteria Status

- [x] **Segmentation threshold defined:** Est. Context >= 20% triggers segmentation evaluation in both orchestrators (Step 3.05)
- [x] **Segment count calculated:** 2-4 segments based on context ranges (20-35%=2, 35-50%=3, >50%=4 with warning)
- [x] **Segments execute sequentially:** Step 3.1 spawns segments sequentially within a group, each in fresh worker
- [x] **Handoff summary passed:** Prior segment summary format defined with files, exports, commits, interfaces (~500 words max)
- [x] **Worker returns segment-aware JSON:** Worker Step 6 includes segment, segment_total, handoff_summary fields
- [x] **Segment results aggregated:** Step 3.15 merges all segment results into single group result
- [x] **Non-segmented groups unchanged:** Groups below 20% threshold execute identically to current behavior
- [x] **Auditor generates segment hints:** Step 4.45 adds Segments column to Implementation Tasks table for groups >= 20%
- [x] **State tracks segments:** Full orchestrator state structure includes per-segment progress for segmented groups

### Deviations

- G4 (state tracking) was completed as part of G1 since both changes were in the same file (`agents/spec-executor-orchestrator.md`)
- Sequential fallback mode was used instead of parallel worker spawning (Task tool not available in execution environment)

### Notes

All 9 acceptance criteria met. Implementation enables large task groups to be automatically subdivided into fresh-context segments, maintaining PEAK/GOOD quality throughout execution. Changes are backward compatible with specs lacking Segments column.

---

## Review History

### Review v1 (2026-02-06 17:30)
**Result:** APPROVED
**Reviewer:** impl-reviewer (subagent)

**Acceptance Criteria Verification:**

1. ✓ **Segmentation threshold defined** — Full orchestrator line 359 and simpler orchestrator line 149 both define "Est. Context >= 20%"
2. ✓ **Segment count calculated** — Decision tables (full: lines 363-368, simpler: lines 153-158) specify 2-4 segments based on ranges
3. ✓ **Segments execute sequentially** — Both orchestrators show sequential spawning with "Wait for Segment 1 result" and explicit note "Segments ALWAYS sequential (never parallel)"
4. ✓ **Handoff summary passed** — Canonical format (full: lines 451-468, simpler: lines 236-253) includes files, exports, commits, interfaces
5. ✓ **Worker returns segment-aware JSON** — Worker Step 1 (lines 82-93) parses segment info, Step 6 (lines 196-217) returns segment fields with handoff_summary
6. ✓ **Segment results aggregated** — Step 3.15 (full: lines 485-517, simpler: lines 270-302) merges segments into single group result with proper status priority
7. ✓ **Non-segmented groups unchanged** — Both orchestrators preserve existing behavior for groups < 20% (full: line 394, simpler: line 184)
8. ✓ **Auditor generates segment hints** — Step 4.45 (lines 470-500) adds Segments column and breakdown for groups >= 20%
9. ✓ **State tracks segments** — Full orchestrator state structure (lines 146-177) includes segmented flag, segment_count, segments array

**Passed:**

- [✓] All 9 acceptance criteria met with verified implementation
- [✓] Both orchestrators receive consistent segmentation logic (except state tracking, which correctly applies only to full orchestrator)
- [✓] Worker correctly parses segment info and returns segment-aware JSON with handoff_summary
- [✓] Auditor generates optional segment hints for groups >= 20% in Step 4.45
- [✓] State tracking added to full orchestrator only (simpler orchestrator correctly excluded per specification)
- [✓] Handoff summary format matches canonical specification from Requirement 3
- [✓] Segment failure handling properly defined in both orchestrators
- [✓] Non-segmented groups execute identically to current behavior
- [✓] All 4 commits exist and correspond to modified files
- [✓] No constraint violations detected
- [✓] Backward compatible with existing specifications lacking Segments column
- [✓] Step numbering consistent across both orchestrators (3.05, 3.1, 3.15)
- [✓] Context budget guidance included in segment spawning prompts

**Summary:** Implementation is complete, correct, and high-quality. All 9 acceptance criteria are met with proper code placement, consistent logic across both orchestrators, and full backward compatibility. The segmentation threshold (20%), segment count decision table (2-4 segments), sequential execution pattern, handoff summary format, and aggregation logic all match the specification exactly. No critical or major issues found.

---

## Completion

**Completed:** 2026-02-06
**Total Commits:** 4
**Audit Cycles:** 4
**Review Cycles:** 1

