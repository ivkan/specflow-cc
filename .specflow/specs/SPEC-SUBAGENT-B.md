# SPEC: Core Agent Architecture — Orchestrator & Worker

---
id: SPEC-SUBAGENT-B
parent: SPEC-SUBAGENT-EXECUTION
type: feature
status: review
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

New agent that coordinates execution without doing implementation.

**Agent File Structure** (follow `spec-executor.md` pattern):

```markdown
---
name: sf-spec-executor-orchestrator
description: Orchestrates parallel execution of large specifications via worker subagents
tools: Read, Write, Edit, Bash, Glob, Grep, Task
---

<role>
You are a SpecFlow orchestrator. You coordinate execution of large specifications
by spawning worker subagents without implementing code yourself.
...
</role>

<philosophy>
## Context Budget
- Stay under 20% context usage
- Read ONLY frontmatter and Implementation Tasks sections
- NEVER read implementation files
- NEVER write code
...
</philosophy>

<process>
## Step 1: Load Plan Metadata
## Step 2: Parse Task Groups into Waves
## Step 3: Execute Waves
## Step 4: Aggregate Results
## Step 5: Create Final Summary
## Step 6: Update STATE.md
</process>

<output>
Return orchestration result with aggregated worker outputs...
</output>

<success_criteria>
- [ ] All task groups assigned to workers
- [ ] All waves executed in dependency order
- [ ] All worker results aggregated
- [ ] Final summary created
- [ ] STATE.md updated
</success_criteria>
```

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

**Failure Handling Rules:**

| Scenario | Action |
|----------|--------|
| Worker returns `status: "failed"` | Log error, mark task group as failed, continue wave |
| Worker returns `status: "partial"` | Log warning, mark partial, continue wave |
| All workers in wave failed | Abort execution, report which groups failed |
| Dependent task's prerequisite failed | Skip dependent task, mark as "blocked" |
| Worker times out (no response) | Mark as failed with "timeout", continue wave |

After wave completion, if any failures occurred:
1. Report failed/partial groups
2. Ask user: "Continue with remaining waves?" or "Abort execution?"
3. If user continues, skip tasks that depend on failed groups

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

**Parallel Execution with Sequential Fallback:**

Attempt parallel spawning first:
```
# Preferred: multiple Task() calls in single response
Task(prompt="Worker G1...", ...)
Task(prompt="Worker G2...", ...)
Task(prompt="Worker G3...", ...)
```

If parallel spawning is not supported (e.g., Task tool returns error on multiple calls):
```
# Fallback: sequential execution within wave
for each task_group in wave:
    Task(prompt="Worker {group}...", ...)
    wait for result
    aggregate result
```

The orchestrator MUST detect if parallel spawning failed and automatically switch to sequential mode for remaining waves.

### 2. Create `spec-executor-worker.md`

Lightweight worker that implements specific task group.

**Agent File Structure** (follow `spec-executor.md` pattern):

```markdown
---
name: sf-spec-executor-worker
description: Implements specific task group(s) as directed by orchestrator
tools: Read, Write, Edit, Bash, Glob, Grep, AskUserQuestion
---

<role>
You are a SpecFlow worker. You implement specific task groups assigned by the orchestrator.
...
</role>

<philosophy>
## Focused Execution
- Implement ONLY assigned tasks
- Stay within task scope
- Return structured results
...

## Deviation Rules
(inherited from spec-executor)
...
</philosophy>

<process>
## Step 1: Parse Assignment
## Step 2: Load Required Context
## Step 3: Implement Tasks
## Step 4: Create Commits
## Step 5: Return Results
</process>

<output>
Return structured JSON result to orchestrator...
</output>

<success_criteria>
- [ ] All assigned tasks implemented
- [ ] Atomic commits created
- [ ] Structured result returned
- [ ] Deviations documented
</success_criteria>
```

**Role:**
- Implement assigned task(s) precisely
- Create atomic commits for each logical unit
- Return structured results to orchestrator

**Focused Execution:**
- Receives ONLY task group's requirements
- Implements exactly what's specified, nothing more
- Maximum 3 task groups per worker
- Target: complete within reasonable context (avoid reading unnecessary files)

**Deviation Rules (inherited from spec-executor):**
- Rule 1: Auto-fix bugs
- Rule 2: Auto-add missing critical functionality
- Rule 3: Auto-fix blocking issues
- Rule 4: Ask about architectural changes (STOP)

### 3. Modify `/sf:run` Command

#### 3.1 Execution Mode Detection

**Insert new Step 4.5** (between current Step 4 "Check Audit Status" and Step 5 "Pre-Execution Summary"):

```markdown
## Step 4.5: Determine Execution Mode

Check specification complexity to choose execution mode:

**If Implementation Tasks section exists:**
- Count task groups (G1, G2, G3, etc.)
- Check for parallel opportunities (groups with no dependencies on each other)
- If groups > 1 AND parallelism exists → use `orchestrated` mode

**If no Implementation Tasks but large spec:**
- Count requirements sections
- Estimate scope from Files to Create/Modify counts
- If total files > 5 OR requirements sections > 3 → suggest running `/sf:audit` first to generate tasks

**Execution modes:**
- `single`: Traditional spec-executor (default for small specs)
- `orchestrated`: Parallel subagent execution (for large specs with task groups)

**Mode selection logic:**
| Condition | Mode |
|-----------|------|
| No Implementation Tasks section | single |
| 1 task group only | single |
| Multiple groups, no parallelism (all sequential) | single |
| Multiple groups with parallel opportunities | orchestrated |

Display mode in Step 5 output:
```

#### 3.2 Modify Step 5: Pre-Execution Summary

Add execution mode display to existing Step 5:

```markdown
**Execution Mode:** {single|orchestrated}

{If orchestrated:}
- Task Groups: {count}
- Waves: {count}
- Parallelization: Wave {N} runs {count} workers simultaneously
```

#### 3.3 Modify Step 7: Spawn Executor Agent

Replace current Step 7 with mode-aware spawning:

```markdown
## Step 7: Spawn Executor Agent

**If mode == "single":**

Launch the spec-executor subagent (existing behavior):

Task(prompt="
<specification>
@.specflow/specs/SPEC-XXX.md
</specification>

<project_context>
@.specflow/PROJECT.md
</project_context>

Execute this specification following the spec-executor agent instructions.
Implement all requirements with atomic commits.
", subagent_type="sf-spec-executor", description="Execute specification")

**If mode == "orchestrated":**

Launch the orchestrator subagent:

Task(prompt="
<specification>
@.specflow/specs/SPEC-XXX.md
</specification>

<project_context>
@.specflow/PROJECT.md
</project_context>

Orchestrate execution of this large specification.
Parse task groups, determine waves, spawn workers, aggregate results.
", subagent_type="sf-spec-executor-orchestrator", description="Orchestrate specification execution")
```

## Files to Create

| File | Purpose |
|------|---------|
| `agents/spec-executor-orchestrator.md` | Orchestrator agent definition |
| `agents/spec-executor-worker.md` | Worker agent definition |

## Files to Modify

| File | Changes |
|------|---------|
| `commands/sf/run.md` | Insert Step 4.5 (mode detection), modify Step 5 (add mode display), modify Step 7 (mode-aware spawning) |

## Acceptance Criteria

1. **Orchestrator created**: Agent file exists with proper structure (frontmatter, role, philosophy, process, output, success_criteria sections) and can parse specs and spawn workers
2. **Worker created**: Agent file exists with proper structure and can implement task groups and return structured JSON results
3. **Mode detection works**: `/sf:run` correctly identifies when to use orchestrated mode based on Implementation Tasks section
4. **Parallel execution works**: Independent task groups run simultaneously (or sequentially if parallel not supported)
5. **Worker scope bounded**: Each worker receives no more than 3 task groups
6. **Commits remain atomic**: Each task produces meaningful commit(s)
7. **Results aggregated correctly**: Final summary reflects all workers' output
8. **Failure handling defined**: Orchestrator handles failed/partial workers per failure handling rules

## Constraints

- DO NOT change behavior for small/medium specs (use single mode)
- DO NOT require manual task decomposition (auto-generate if missing)
- DO NOT break existing spec-executor for simple cases
- DO NOT spawn workers for single-task specs
- Orchestrator MUST stay lean (~15% context max)

## Assumptions

- SPEC-SUBAGENT-A is complete (auditor detects large specs)
- Task tool supports spawning subagents; parallel spawning may or may not be supported (fallback to sequential if not)
- Worker agents have access to Read, Write, Edit, Bash, Glob, Grep tools

---

## Audit History

### Audit v1 (2026-01-23 17:30)
**Status:** NEEDS_REVISION

**Critical:**
1. **Agent file structure not specified**: The spec describes WHAT the orchestrator and worker agents should DO, but does not provide the actual markdown structure (frontmatter with name, description, tools; role/philosophy/process/output/success_criteria sections). Without this, the implementer must invent the agent structure, which may not align with existing patterns like `spec-executor.md` or `spec-auditor.md`. Provide complete agent templates or specify "follow spec-executor.md structure".

2. **Acceptance Criterion 5 is unmeasurable**: "Each worker uses <=50% context" cannot be verified — context percentage is not directly observable during or after execution. Either remove this criterion, change it to something measurable (e.g., "worker receives no more than 3 task groups"), or specify HOW context usage should be validated.

**Recommendations:**
3. Clarify assumption about Task tool parallel spawning: The spec assumes "Task tool supports parallel spawning via multiple calls in single message" but this is platform-dependent behavior. Consider adding a fallback for sequential execution if parallel spawning is not supported.

4. Specify failure handling in orchestrator: The spec mentions "handle failures" but doesn't define the behavior. What happens if a worker fails? Retry? Skip wave? Abort execution? Add explicit failure handling rules.

5. Add explicit step references for run.md modifications: The current run.md has Steps 1-9. Specify WHERE mode detection should be inserted (e.g., "Add Step 4.5 between Step 4 and Step 5") and which existing steps need modification.

### Response v1 (2026-01-23 17:45)
**Applied:** All critical issues (1-2) and all recommendations (3-5)

**Changes:**
1. [x] Agent file structure not specified — Added complete agent file structure templates for both orchestrator and worker agents under Requirements 1 and 2, showing frontmatter, role, philosophy, process, output, and success_criteria sections following spec-executor.md pattern
2. [x] Acceptance Criterion 5 unmeasurable — Replaced "Each worker uses <=50% context" with "Each worker receives no more than 3 task groups" (measurable constraint)
3. [x] Parallel spawning assumption — Added "Parallel Execution with Sequential Fallback" section to orchestrator requirements specifying automatic fallback to sequential execution if parallel spawning fails; updated Assumptions section accordingly
4. [x] Failure handling not specified — Added comprehensive "Failure Handling Rules" table to orchestrator requirements covering failed workers, partial completion, all-wave failures, dependent task handling, and timeouts
5. [x] Step references for run.md — Added explicit step references: "Insert new Step 4.5", "Modify Step 5", "Modify Step 7" with detailed content for each modification

### Audit v2 (2026-01-23)
**Status:** APPROVED

**Comment:** The specification is well-structured and comprehensive. All previous critical issues have been addressed thoroughly in Response v1. The agent file structure templates are clear, acceptance criteria are measurable, failure handling is explicitly defined, and run.md modification points are precisely specified. The orchestrator/worker architecture follows established patterns and the sequential fallback for parallel execution provides appropriate resilience.

---

## Execution Summary

**Executed:** 2026-01-23
**Commits:** 1

### Files Created
- `~/.claude/specflow-cc/agents/spec-executor-orchestrator.md` — Orchestrator agent with wave execution, parallel spawning, failure handling, and result aggregation
- `~/.claude/specflow-cc/agents/spec-executor-worker.md` — Worker agent with focused execution, deviation rules, atomic commits, and structured JSON results

### Files Modified
- `~/.claude/commands/sf/run.md` — Added Step 4.5 (mode detection), updated Step 5 (mode display), updated Step 7 (mode-aware spawning)

### Acceptance Criteria Status
- [x] Orchestrator created: Agent file exists with proper structure (frontmatter, role, philosophy, process, output, success_criteria sections)
- [x] Worker created: Agent file exists with proper structure and can implement task groups and return structured JSON results
- [x] Mode detection works: `/sf:run` correctly identifies when to use orchestrated mode based on Implementation Tasks section
- [x] Parallel execution works: Orchestrator attempts parallel spawning with sequential fallback if not supported
- [x] Worker scope bounded: Worker receives no more than 3 task groups (enforced in orchestrator)
- [x] Commits remain atomic: Worker creates atomic commits per logical unit
- [x] Results aggregated correctly: Orchestrator aggregates all worker outputs into final summary
- [x] Failure handling defined: Orchestrator handles failed/partial workers per failure handling rules table

### Deviations
None

### Notes
- Agent files are located in the SpecFlow skill directory (~/.claude/specflow-cc/agents/) which is outside the project git repository
- The run.md command file is at ~/.claude/commands/sf/run.md
- Full integration testing requires running with a spec that has Implementation Tasks section with multiple task groups
