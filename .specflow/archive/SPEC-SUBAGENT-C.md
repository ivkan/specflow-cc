# SPEC: State Management & Reliability

---
id: SPEC-SUBAGENT-C
parent: SPEC-SUBAGENT-EXECUTION
type: feature
status: done
priority: high
complexity: medium
depends_on: [SPEC-SUBAGENT-B]
created: 2026-01-23
---

> Part 3 of 3 from SPEC-SUBAGENT-EXECUTION (Subagent-Based Execution Model)

## Context

### Problem Statement

Parallel execution can fail mid-way (context limits, errors, interruptions). Without state tracking, all progress is lost and execution must restart from scratch.

### This Sub-Spec's Role

This specification adds **reliability and resumption** to the orchestrated execution:
1. Execution state file to track progress
2. Resume capability to continue from last checkpoint
3. Pre/post wave verification for quality gates

### Prerequisites

- SPEC-SUBAGENT-A: Auditor detects large specs
- SPEC-SUBAGENT-B: Orchestrator and workers exist, mode detection works

## Task

Implement state management, resumption capability, and quality gates for orchestrated execution.

## Requirements

### 1. Execution State File

Create `.specflow/execution/SPEC-XXX-state.json` schema:

```json
{
  "spec_id": "SPEC-001",
  "mode": "orchestrated",
  "started": "2026-01-23T14:30:00Z",
  "waves": [
    {
      "id": 1,
      "groups": ["G1"],
      "status": "complete",
      "results": {...}
    },
    {
      "id": 2,
      "groups": ["G2", "G3", "G4"],
      "status": "in_progress",
      "results": {
        "G2": {...},
        "G3": "running",
        "G4": {...}
      }
    },
    {
      "id": 3,
      "groups": ["G5"],
      "status": "pending"
    }
  ],
  "commits": ["abc123", "def456", "..."],
  "last_checkpoint": "2026-01-23T14:45:00Z"
}
```

**State file lifecycle:**
- Created when orchestrated execution starts
- Updated after each wave completes
- Updated after each worker returns
- Deleted on successful completion (or archived)

### 2. Resumption Command

Add `/sf:run --resume` option:

**If execution state exists:**
```
Found interrupted execution for SPEC-XXX

**Progress:**
- Wave 1: ✓ Complete (G1)
- Wave 2: ⚡ In Progress
  - G2: ✓ Complete
  - G3: ✗ Failed (context limit)
  - G4: ✓ Complete
- Wave 3: ○ Pending (G5)

Resume from G3?
```

**Options:**
- "Yes, resume G3" → spawn worker for G3 only
- "Restart Wave 2" → re-run all Wave 2 groups
- "Abort" → clean up, mark failed

**Auto-detection:**
When running `/sf:run` on a spec with existing state file, prompt user:
```
Previous execution found. Resume? [Y/n]
```

### 3. Pre-Wave Verification

Before each wave executes:

```
Verify prerequisites:
- Previous wave commits exist in git
- Created files are readable
- No syntax errors in dependencies
```

**If verification fails:**
- Log specific failure
- Offer to retry previous wave or abort

### 4. Post-Wave Verification

After each wave completes:

```
Verify deliverables:
- All expected files created
- Git commits match expected count
- No uncommitted changes left
```

**If verification fails:**
- Flag specific issues
- Offer to retry wave, continue anyway, or abort

### 5. Update State Template

Modify `templates/state.md` to add execution tracking fields:

```markdown
## Execution Status

| Spec ID | Mode | Progress | Last Updated |
|---------|------|----------|--------------|
| SPEC-001 | orchestrated | Wave 2/3 (67%) | 2026-01-23 14:45 |
```

### 6. Checkpoint Format with Commit Hashes (from GSD)

State file must include commit hashes for verification on resume:

```json
{
  "waves": [
    {
      "id": 1,
      "status": "complete",
      "results": {
        "G1": {
          "status": "complete",
          "commits": ["abc1234", "def5678"],
          "files_created": ["src/types.ts"]
        }
      }
    }
  ]
}
```

**On resume:**
1. Verify commits exist: `git log --oneline | grep {hash}`
2. If commit missing → wave is NOT complete, must re-run
3. If commit exists → skip completed groups

### 7. Fresh Continuation Agents (from GSD)

When resuming interrupted execution:

- DO NOT resume existing agent context
- Spawn FRESH agent with checkpoint data
- Fresh agent verifies previous commits exist
- Fresh agent continues from resume point

**Rationale:** Context handoff is unreliable. Fresh context + commit verification is safer.

### 8. /sf:pause and /sf:resume Commands

**`/sf:pause`:**
- Creates `.specflow/.continue-here` with current state
- Commits any pending work
- Safe stopping point

Output:
```
Execution paused at Wave 2, Group G3.

Progress saved to .specflow/.continue-here
Commits: 3 completed

To resume: /sf:resume
```

**`/sf:resume`:**
- Loads `.specflow/.continue-here`
- Verifies commits exist
- Spawns fresh continuation agent

Output:
```
Resuming SPEC-001 execution...

Verified:
- Wave 1: ✓ 2 commits found
- Wave 2/G2: ✓ 1 commit found

Continuing from Wave 2, Group G3...
```

## Files to Create

| File | Purpose |
|------|---------|
| `templates/execution-state.json` | State file schema/template |
| `commands/sf/pause.md` | Pause execution command |
| `commands/sf/resume.md` | Resume execution command |

## Files to Modify

| File | Changes |
|------|---------|
| `commands/sf/run.md` | Add --resume flag, state file handling, auto-detection |
| `templates/state.md` | Add Execution Status section |
| `agents/spec-executor-orchestrator.md` | Add state writing, verification logic, commit hash tracking |

## Acceptance Criteria

1. **State file created**: Execution creates `.specflow/execution/SPEC-XXX-state.json`
2. **State updated per wave**: Progress tracked accurately through execution
3. **Resumption works**: Interrupted execution can resume from last checkpoint
4. **Auto-detection works**: `/sf:run` detects existing state and prompts
5. **Pre-wave verification**: Prerequisites checked before each wave
6. **Post-wave verification**: Deliverables verified after each wave
7. **Failures handled gracefully**: Single worker failure doesn't lose other work
8. **Clean completion**: State file removed/archived on success
9. **Commit hashes stored**: Each completed group has commit hashes in state
10. **Commit verification on resume**: Fresh agent verifies commits exist before skipping
11. **/sf:pause works**: Creates .continue-here, commits pending work
12. **/sf:resume works**: Loads checkpoint, verifies, spawns fresh agent

## Constraints

- DO NOT require state management for single-mode execution
- DO NOT store sensitive data in state file
- State file MUST be human-readable (JSON with formatting)
- Verification MUST NOT significantly slow down execution

## Assumptions

- Git commits are the source of truth for completed work
- File system operations are reliable
- Orchestrator maintains execution control across waves
- SPEC-SUBAGENT-B completed successfully (orchestrator and workers exist)

## Audit History

### Audit v1 (2026-01-24 09:15)
**Status:** APPROVED

**Comment:** Specification is well-structured with clear requirements, concrete JSON schemas, and testable acceptance criteria. The dual-file approach (execution-state.json for auto-tracking, .continue-here for explicit pause) is sound. Prerequisites are clearly stated and architecture aligns with existing orchestrator patterns.

**Recommendations:**
1. Clarify the relationship between `.specflow/execution/SPEC-XXX-state.json` (auto-created during execution) and `.specflow/.continue-here` (explicit pause) in the documentation - these serve different purposes but could confuse implementers.
2. Specify the archive behavior: currently "deleted on successful completion (or archived)" is ambiguous. Define when to delete vs archive, or choose one approach.
3. Consider consolidating the 12 acceptance criteria to stay within the recommended 10 threshold (e.g., combine commit hash storage/verification into one, combine pause/resume into one).

---

## Execution Summary

**Executed:** 2026-01-24
**Mode:** single
**Commits:** 6

### Files Created

| File | Purpose |
|------|---------|
| `templates/execution-state.json` | State file schema with example and documentation |

### Files Modified

| File | Changes |
|------|---------|
| `templates/state.md` | Added Execution Status section for tracking orchestrated progress |
| `commands/sf/run.md` | Added Step 4.5 for state detection, --resume flag, orchestrated prompts |
| `agents/spec-executor-orchestrator.md` | Added state management, verification, resume support, pre/post wave checks |
| `commands/sf/pause.md` | Added .continue-here creation for orchestrated execution |
| `commands/sf/resume.md` | Added checkpoint loading, commit verification, fresh agent spawning |

### Acceptance Criteria Status

- [x] State file created: Execution creates `.specflow/execution/SPEC-XXX-state.json`
- [x] State updated per wave: Progress tracked accurately through execution
- [x] State updated per worker: Step 3.3 updates state after each worker returns
- [x] Resumption works: Interrupted execution can resume from last checkpoint
- [x] Auto-detection works: `/sf:run` detects existing state and prompts (Step 4.5)
- [x] Pre-wave verification: Prerequisites checked before each wave (Step 3.0)
- [x] Post-wave verification: Deliverables verified after each wave (Step 3.5)
- [x] Failures handled gracefully: Single worker failure doesn't lose other work
- [x] Clean completion: State file deleted on success (Step 6)
- [x] Commit hashes stored: Each completed group has commit hashes in state
- [x] Commit verification on resume: Fresh agent verifies commits exist (Step 1.5)
- [x] /sf:pause works: Creates .continue-here, commits pending work
- [x] /sf:resume works: Loads checkpoint, verifies, spawns fresh agent

### Deviations

None. All requirements implemented as specified.

### Implementation Notes

1. **Dual-file approach clarified**:
   - `execution-state.json` is auto-managed by orchestrator during execution
   - `.continue-here` is created by explicit `/sf:pause` command
   - Both support resumption but serve different purposes

2. **Archive behavior**: Implemented as delete-on-success. Archive option mentioned in Step 6 as alternative but not required.

3. **Fresh agent principle**: Consistently applied - all resumption spawns new agents with state data, no context handoff attempted.

---

## Review History

### Review v1 (2026-01-24 10:30)
**Result:** APPROVED
**Reviewer:** impl-reviewer (subagent)

**Findings:**

**Passed:**
- [x] State file schema: `templates/execution-state.json` exists with valid JSON, includes all required fields (spec_id, mode, started, waves, commits, last_checkpoint), has documentation section
- [x] State updated per wave: Orchestrator Step 3.6 updates state after each wave completes
- [x] State updated per worker: Orchestrator Step 3.3 updates state after each worker returns
- [x] Resumption works: Orchestrator Step 1.5 handles resume mode with commit verification
- [x] Auto-detection works: `commands/sf/run.md` Step 4.5 checks for existing state file and prompts user
- [x] Pre-wave verification: Orchestrator Step 3.0 verifies prerequisites before each wave
- [x] Post-wave verification: Orchestrator Step 3.5 verifies deliverables after each wave
- [x] Failures handled gracefully: Orchestrator failure handling rules table and Step 3.4 preserve completed work
- [x] Clean completion: Orchestrator Step 6 deletes state file on successful completion
- [x] Commit hashes stored: State structure includes commits array per group and global commits list
- [x] Commit verification on resume: Step 1.5 uses `git log --oneline | grep {hash}` to verify commits
- [x] /sf:pause works: `commands/sf/pause.md` Step 6 creates `.continue-here` for orchestrated execution with checkpoint commit
- [x] /sf:resume works: `commands/sf/resume.md` Step 2.5 loads checkpoint, verifies commits, spawns fresh orchestrator

**Compliance Check:**
- All 12 acceptance criteria met
- All 3 files to create exist: `templates/execution-state.json`, `commands/sf/pause.md`, `commands/sf/resume.md`
- All 3 files to modify updated: `commands/sf/run.md`, `templates/state.md`, `agents/spec-executor-orchestrator.md`
- Constraints respected: single-mode execution does not use state management (documented in run.md Step 4.6)

**Quality Check:**
- Code is well-structured with clear step numbering
- Error handling paths defined (pre-wave/post-wave verification failures offer retry, continue, abort)
- Fresh agent principle consistently applied
- JSON schema is valid and human-readable

**Architecture Check:**
- Dual-file approach properly documented: execution-state.json for auto-tracking, .continue-here for explicit pause
- Integrates properly with existing orchestrator/worker architecture from SPEC-SUBAGENT-B
- Commands already documented in README.md and help.md

**Minor Issues:**
1. The execution directory `.specflow/execution/` does not exist yet (created at runtime by orchestrator Step 2.5 via `mkdir -p`) - this is acceptable behavior, not a defect.

**Summary:** Implementation fully meets specification. All 12 acceptance criteria satisfied. State management, resumption, pre/post wave verification, and pause/resume commands are properly implemented with comprehensive error handling. The dual-file approach is clearly documented and the fresh agent principle is consistently applied.

---

## Completion

**Completed:** 2026-01-24
**Total Commits:** 6
**Audit Cycles:** 1
**Review Cycles:** 1

### Key Decisions

- Dual-file approach: execution-state.json for auto-tracking, .continue-here for explicit pause
- Fresh agent principle: All resumption spawns new agents with state data
- Git commits as source of truth for completed work
