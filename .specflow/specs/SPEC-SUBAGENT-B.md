# SPEC: Core Agent Architecture — Orchestrator & Worker

---
id: SPEC-SUBAGENT-B
parent: SPEC-SUBAGENT-EXECUTION
type: feature
status: draft
priority: high
complexity: medium
depends_on: [SPEC-SUBAGENT-A]
created: 2026-01-23
---

> Part 2 of 3 from SPEC-SUBAGENT-EXECUTION (Subagent-Based Execution Model)

## Context

### Problem Statement

Large specifications exhaust context before completion. SPEC-SUBAGENT-A established detection of large specs via the auditor's Execution Scope Check.

### This Sub-Spec's Role

This specification implements the **core parallel execution architecture**:
1. Orchestrator agent that coordinates without implementing
2. Worker agents that implement specific task groups
3. Mode detection in `/sf:run` to choose single vs orchestrated execution

### GSD Reference Architecture

```
┌─────────────────────────────────────┐
│  ORCHESTRATOR (~10-15% context)     │
│  - Reads plan metadata only         │
│  - Parses tasks into waves          │
│  - Spawns parallel subagents        │
│  - Aggregates results               │
│  - Never reads implementation files │
└─────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────┐
│  WORKER SUBAGENTS (fresh 200k each) │
│  - Receives specific task(s)        │
│  - Full context for that task       │
│  - Implements, commits, returns     │
│  - Isolated from other workers      │
└─────────────────────────────────────┘
```

## Task

Create the orchestrator and worker agents, and integrate mode detection into `/sf:run`.

## Requirements

### 1. Create `spec-executor-orchestrator.md`

New agent that coordinates execution without doing implementation:

**Role:**
- Parse specification into task groups
- Determine execution waves (dependencies)
- Spawn worker subagents in parallel where possible
- Aggregate results and handle failures
- Create final execution summary

**Context Budget:**
- Orchestrator stays under 20% context
- Read ONLY frontmatter and task sections of specs
- NEVER read implementation files (workers do that)
- NEVER write code (workers do that)
- Aggregate results from workers, don't reprocess

**Wave Execution:**
```
Wave 1: [Task A, Task B, Task C] → parallel Task() calls
         ↓ all complete
Wave 2: [Task D (needs A), Task E (needs B,C)] → parallel
         ↓ all complete
Wave 3: [Task F (needs D,E)] → single Task() call
```

**Worker Protocol:**
Each worker receives:
- Specific task(s) from one group
- Relevant spec sections only (not full spec)
- PROJECT.md for patterns
- Clear deliverables list

Worker returns:
```json
{
  "group": "G2",
  "status": "complete|partial|failed",
  "files_created": ["path/to/file.ts"],
  "files_modified": [],
  "commits": ["abc123", "def456"],
  "criteria_met": ["Criterion 1", "Criterion 2"],
  "deviations": [],
  "error": null
}
```

### 2. Create `spec-executor-worker.md`

Lightweight worker that implements specific task group:

**Role:**
- Implement assigned task(s) precisely
- Create atomic commits for each logical unit
- Return structured results to orchestrator

**Focused Execution:**
- Receives ONLY task group's requirements
- Implements exactly what's specified, nothing more
- 2-3 tasks per worker maximum
- Target ~25% context usage per worker

**Deviation Rules (inherited from spec-executor):**
- Rule 1: Auto-fix bugs
- Rule 2: Auto-add missing critical functionality
- Rule 3: Auto-fix blocking issues
- Rule 4: Ask about architectural changes (STOP)

### 3. Modify `/sf:run` Command

#### 3.1 Execution Mode Detection

Check specification complexity:

**If Implementation Tasks section exists:**
- Count task groups
- Check for parallel opportunities
- If groups > 1 with parallelism → use orchestrator mode

**If no Implementation Tasks but large spec:**
- Estimate complexity from Requirements
- If estimated context > 50% → auto-generate tasks, use orchestrator

**Execution modes:**
- `single`: Traditional spec-executor (default for small specs)
- `orchestrated`: Parallel subagent execution (for large specs)

Display:
```
**Execution Mode:** orchestrated (5 task groups, 3 waves)

Estimated context per worker: ~25%
Parallelization: Wave 2 runs 3 workers simultaneously
```

#### 3.2 Orchestrator Spawn

```
**If mode == "single":**
Task(prompt="...", subagent_type="sf-spec-executor", ...)

**If mode == "orchestrated":**
Task(prompt="...", subagent_type="sf-spec-executor-orchestrator", ...)
```

## Files to Create

| File | Purpose |
|------|---------|
| `agents/spec-executor-orchestrator.md` | Orchestrator agent definition |
| `agents/spec-executor-worker.md` | Worker agent definition |

## Files to Modify

| File | Changes |
|------|---------|
| `commands/sf/run.md` | Add mode detection, orchestrator spawn logic |

## Acceptance Criteria

1. **Orchestrator created**: Agent can parse specs and spawn workers
2. **Worker created**: Agent can implement task groups and return structured results
3. **Mode detection works**: `/sf:run` correctly identifies when to use orchestrated mode
4. **Parallel execution works**: Independent task groups run simultaneously
5. **Context stays bounded**: Each worker uses ≤50% context
6. **Commits remain atomic**: Each task produces meaningful commit(s)
7. **Results aggregated correctly**: Final summary reflects all workers' output

## Constraints

- DO NOT change behavior for small/medium specs (use single mode)
- DO NOT require manual task decomposition (auto-generate if missing)
- DO NOT break existing spec-executor for simple cases
- DO NOT spawn workers for single-task specs
- Orchestrator MUST stay lean (~15% context max)

## Assumptions

- SPEC-SUBAGENT-A is complete (auditor detects large specs)
- Task tool supports parallel spawning via multiple calls in single message
- Worker agents have access to Read, Write, Edit, Bash, Glob, Grep tools
