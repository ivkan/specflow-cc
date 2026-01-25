# SPEC: Model Profiles for Cost-Efficient Agent Execution

---
id: SPEC-MODEL-001
type: feature
status: draft
priority: medium
complexity: medium
created: 2026-01-25
---

> Configure Claude model selection per agent type to optimize cost vs. capability tradeoff.

## Context

### Problem Statement

SpecFlow currently uses the same Claude model for all subagent tasks, regardless of task complexity. This is wasteful:

- **Spec creation/auditing** requires architectural reasoning (needs Opus)
- **Spec execution** follows existing plans (Sonnet sufficient)
- **Implementation review** checks compliance (Sonnet sufficient)

### GSD Pattern Reference

GSD uses model profiles to achieve 30-40% token savings:

| Agent | quality | balanced | budget |
|-------|---------|----------|--------|
| planner | Opus | Opus | Sonnet |
| executor | Opus | Sonnet | Sonnet |
| verifier | Sonnet | Sonnet | Haiku |

### SpecFlow Agent Mapping

| SpecFlow Agent | Role | Recommended Model |
|----------------|------|-------------------|
| spec-creator | Critical architectural decisions | Opus |
| spec-auditor | Validates spec quality | Opus |
| spec-splitter | Decomposes complex specs | Opus |
| discusser | Explores requirements | Opus |
| spec-executor | Follows plan (small specs) | Sonnet |
| spec-executor-orchestrator | Thin coordination | Sonnet |
| spec-executor-worker | Follows plan (task groups) | Sonnet |
| impl-reviewer | Checks compliance | Sonnet |
| spec-reviser | Applies audit feedback | Sonnet |
| researcher | Information gathering | Sonnet |
| codebase-scanner | Pattern extraction | Sonnet |

## Task

Add model profile configuration to SpecFlow, allowing per-agent model selection with sensible defaults matching the GSD pattern.

## Goal Analysis

### Goal Statement

Reduce token costs by 30-40% by routing simple tasks to smaller models while preserving quality for critical decisions.

### Observable Truths

When this spec is complete, a user will observe:

1. Running `/sf:new` spawns spec-creator with Opus model
2. Running `/sf:run` spawns spec-executor with Sonnet model
3. Running `/sf:audit` spawns spec-auditor with Opus model
4. Running `/sf:review` spawns impl-reviewer with Sonnet model
5. Profile can be changed via `.specflow/config.json` or command flag
6. Default profile is "balanced" (Opus for planning, Sonnet for execution)

### Required Artifacts

| Artifact | Enables Truth # | Purpose |
|----------|-----------------|---------|
| Model profile definitions | 5, 6 | Map agent types to models per profile |
| Task() model parameter usage | 1, 2, 3, 4 | Pass model to subagent calls |
| Config file support | 5 | User customization |

### Required Wiring

| From | To | Connection Type |
|------|-----|-----------------|
| Command files | Task() calls | Add model parameter |
| Config file | Commands | Read profile setting |
| Profile definitions | Commands | Map agent to model |

### Key Links

1. **Task() API Compatibility**: Model parameter must work with Claude Agent SDK
   - Risk: SDK may not support model override in Task()
   - Verification: Test with actual Task() call before full implementation

2. **Profile Configuration**: User needs to change profile
   - Risk: Overcomplicating simple use case
   - Verification: Single config value changes all agents appropriately

## Requirements

### Model Profile Definitions

Define three profiles in command files (inline, no external config required):

```markdown
<!-- Model Profiles (balanced is default) -->
| Agent | quality | balanced | budget |
|-------|---------|----------|--------|
| spec-creator | opus | opus | sonnet |
| spec-auditor | opus | opus | sonnet |
| spec-splitter | opus | opus | sonnet |
| discusser | opus | opus | sonnet |
| spec-executor | opus | sonnet | sonnet |
| spec-executor-orchestrator | opus | sonnet | sonnet |
| spec-executor-worker | opus | sonnet | sonnet |
| impl-reviewer | sonnet | sonnet | haiku |
| spec-reviser | sonnet | sonnet | sonnet |
| researcher | sonnet | sonnet | haiku |
| codebase-scanner | sonnet | sonnet | haiku |
```

### Task() Call Modification

Add `model` parameter to all Task() calls:

**Before:**
```
Task(prompt="...", subagent_type="sf-spec-creator", description="Create specification")
```

**After:**
```
Task(prompt="...", subagent_type="sf-spec-creator", model="{profile_model}", description="Create specification")
```

Where `{profile_model}` is determined by:
1. Check `.specflow/config.json` for `model_profile` setting
2. If not set, use "balanced"
3. Look up agent in profile table
4. Return model name (opus/sonnet/haiku)

### Profile Selection Logic

Add to each command that uses Task():

```markdown
## Step N: Determine Model

Read `.specflow/config.json` (if exists):
- Extract `model_profile` field
- Default to "balanced" if not set

Look up model for this agent type from profile table.
```

### Config File Format

Optional `.specflow/config.json`:

```json
{
  "model_profile": "balanced"
}
```

Valid values: "quality", "balanced", "budget"

### Files to Modify

| File | Changes |
|------|---------|
| `commands/sf/new.md` | Add model lookup, pass to Task() |
| `commands/sf/plan.md` | Add model lookup, pass to Task() |
| `commands/sf/audit.md` | Add model lookup, pass to Task() |
| `commands/sf/run.md` | Add model lookup, pass to Task() (3 places) |
| `commands/sf/review.md` | Add model lookup, pass to Task() |
| `commands/sf/revise.md` | Add model lookup, pass to Task() |
| `commands/sf/split.md` | Add model lookup, pass to Task() |
| `commands/sf/discuss.md` | Add model lookup, pass to Task() |
| `commands/sf/research.md` | Add model lookup, pass to Task() |
| `commands/sf/scan.md` | Add model lookup, pass to Task() |
| `commands/sf/fix.md` | Add model lookup, pass to Task() |
| `commands/sf/resume.md` | Add model lookup, pass to Task() |
| `agents/spec-executor-orchestrator.md` | Add model lookup for worker spawning |

### Files to Create

None. Profile definitions are inline in commands.

## Implementation Tasks

### G1: Profile Lookup Helper

**Dependencies:** None

Add profile lookup section to each command that needs it. Since commands are markdown (not code), this is a documentation pattern, not a function.

**Pattern to add:**

```markdown
## Step X: Determine Model Profile

1. Check if `.specflow/config.json` exists
2. If exists, read `model_profile` field
3. If not exists or field missing, use "balanced"

**Profile Table:**

| Profile | spec-creator | spec-auditor | spec-executor | impl-reviewer | ... |
|---------|--------------|--------------|---------------|---------------|-----|
| quality | opus | opus | opus | sonnet | ... |
| balanced | opus | opus | sonnet | sonnet | ... |
| budget | sonnet | sonnet | sonnet | haiku | ... |

Use model for `{agent-type}` from selected profile.
```

### G2: Update Planning Commands

**Dependencies:** G1

Modify commands that do critical planning:
- `commands/sf/new.md` (spec-creator)
- `commands/sf/plan.md` (spec-creator)
- `commands/sf/audit.md` (spec-auditor)
- `commands/sf/split.md` (spec-splitter)
- `commands/sf/discuss.md` (discusser)

Add profile lookup step and model parameter to Task() calls.

### G3: Update Execution Commands

**Dependencies:** G1

Modify commands that execute/review:
- `commands/sf/run.md` (spec-executor, orchestrator)
- `commands/sf/review.md` (impl-reviewer)
- `commands/sf/fix.md` (spec-executor)
- `commands/sf/resume.md` (orchestrator)

Add profile lookup step and model parameter to Task() calls.

### G4: Update Support Commands

**Dependencies:** G1

Modify utility commands:
- `commands/sf/revise.md` (spec-reviser)
- `commands/sf/research.md` (researcher)
- `commands/sf/scan.md` (codebase-scanner)

Add profile lookup step and model parameter to Task() calls.

### G5: Update Orchestrator Worker Spawning

**Dependencies:** G1

Modify `agents/spec-executor-orchestrator.md`:
- Add profile lookup before spawning workers
- Pass model parameter to worker Task() calls

### Execution Waves

```
Wave 1: [G1]           (profile pattern established)
Wave 2: [G2, G3, G4]   (parallel - independent command groups)
Wave 3: [G5]           (depends on G1 pattern)
```

## Acceptance Criteria

1. `/sf:new` uses Opus model in balanced profile (check Task() call includes model=opus)
2. `/sf:run` uses Sonnet model for spec-executor in balanced profile
3. `/sf:audit` uses Opus model in balanced profile
4. `/sf:review` uses Sonnet model in balanced profile
5. Creating `.specflow/config.json` with `"model_profile": "budget"` changes all agents to use budget models
6. All 13 command/agent files with Task() calls updated to include model parameter
7. Profile table is consistent across all modified files

## Constraints

- DO NOT create a separate config parsing utility file (keep inline in commands)
- DO NOT add model profile to STATE.md (it's project-wide config, not spec-specific)
- DO NOT require config.json to exist (balanced is default)
- DO NOT change agent behavior based on model (agents work the same, just different model capability)
- PRESERVE all existing Task() parameters (add model, don't remove anything)

## Assumptions

- Task() tool in Claude Agent SDK accepts a `model` parameter
- Model names are "opus", "sonnet", "haiku" (standard Claude naming)
- All commands can read .specflow/config.json if it exists
- Profile changes apply to new subagent calls only (not mid-execution)
- User understands tradeoff: budget = faster/cheaper but potentially lower quality

## Risks

### Medium: Task() API May Not Support Model Parameter

**Mitigation:** Verify Task() signature before implementation. If not supported, this spec needs revision or SDK enhancement.

**Fallback:** Document model selection as manual user responsibility (set default model in Claude settings).

---

## Audit History

<!-- Filled by /sf:audit -->
