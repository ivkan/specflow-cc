# SPEC: State Management & Reliability

---
id: SPEC-SUBAGENT-C
parent: SPEC-SUBAGENT-EXECUTION
type: feature
status: draft
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

## Files to Create

| File | Purpose |
|------|---------|
| `templates/execution-state.json` | State file schema/template |

## Files to Modify

| File | Changes |
|------|---------|
| `commands/sf/run.md` | Add --resume flag, state file handling, auto-detection |
| `templates/state.md` | Add Execution Status section |
| `agents/spec-executor-orchestrator.md` | Add state writing, verification logic |

## Acceptance Criteria

1. **State file created**: Execution creates `.specflow/execution/SPEC-XXX-state.json`
2. **State updated per wave**: Progress tracked accurately through execution
3. **Resumption works**: Interrupted execution can resume from last checkpoint
4. **Auto-detection works**: `/sf:run` detects existing state and prompts
5. **Pre-wave verification**: Prerequisites checked before each wave
6. **Post-wave verification**: Deliverables verified after each wave
7. **Failures handled gracefully**: Single worker failure doesn't lose other work
8. **Clean completion**: State file removed/archived on success

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
