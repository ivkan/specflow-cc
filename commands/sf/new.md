---
name: sf:new
description: Create a new specification from task description
argument-hint: "[--research RES-XXX] [--discuss PRE-XXX | DISC-XXX] <task description>"
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
  - Task
  - AskUserQuestion
---

<purpose>
Create a new specification from a task description. Asks critical questions if needed, estimates complexity, and creates a well-structured SPEC-XXX.md file.
</purpose>

<context>
@.specflow/PROJECT.md
@.specflow/STATE.md
@~/.claude/specflow-cc/templates/spec.md
@~/.claude/specflow-cc/agents/spec-creator.md
</context>

<workflow>

## Step 1: Verify Initialization

```bash
[ -d .specflow ] && echo "OK" || echo "NOT_INITIALIZED"
```

**If NOT_INITIALIZED:**
```
SpecFlow not initialized.

Run `/sf:init` first.
```
Exit.

## Step 2: Parse Arguments

Extract from command arguments:
- `--research RES-XXX` — optional research document to include as context
- `--discuss PRE-XXX` or `--discuss DISC-XXX` — optional prior discussion to include as context
- Task description — what to build

**If --research provided:**
```bash
[ -f .specflow/research/RES-XXX.md ] && echo "FOUND" || echo "NOT_FOUND"
```

If NOT_FOUND, warn user and continue without research context.

**If --discuss provided:**
```bash
[ -f .specflow/discussions/PRE-XXX.md ] && echo "FOUND" || [ -f .specflow/discussions/DISC-XXX.md ] && echo "FOUND" || echo "NOT_FOUND"
```

If NOT_FOUND, warn user and continue without discussion context.

**If no description provided:**
Use AskUserQuestion:
- header: "Task"
- question: "What do you want to build?"
- options: (freeform text input)

## Step 3: Determine Model Profile

Check `.specflow/config.json` for model profile setting:

```bash
[ -f .specflow/config.json ] && cat .specflow/config.json | grep -o '"model_profile"[[:space:]]*:[[:space:]]*"[^"]*"' | cut -d'"' -f4 || echo "balanced"
```

**Profile Table:**

| Profile | spec-creator | spec-auditor | spec-splitter | discusser | spec-executor | spec-executor-orchestrator | spec-executor-worker | impl-reviewer | spec-reviser | researcher | codebase-scanner |
|---------|--------------|--------------|---------------|-----------|---------------|---------------------------|---------------------|---------------|--------------|------------|-----------------|
| quality | opus | opus | opus | opus | opus | opus | opus | sonnet | sonnet | sonnet | sonnet |
| balanced | opus | opus | opus | opus | sonnet | sonnet | sonnet | sonnet | sonnet | sonnet | sonnet |
| budget | sonnet | sonnet | sonnet | sonnet | sonnet | sonnet | sonnet | haiku | sonnet | haiku | haiku |

Use model for `spec-creator` from selected profile (default: balanced = opus).

## Step 4: Spawn Spec Creator Agent

Launch the spec-creator subagent with context:

```
Task(prompt="
<task_description>
{user's task description}
</task_description>

<project_context>
@.specflow/PROJECT.md
</project_context>

<current_state>
@.specflow/STATE.md
</current_state>

{If --research provided:}
<research_context>
@.specflow/research/RES-XXX.md
</research_context>

{If --discuss provided:}
<prior_discussion>
@.specflow/discussions/{PRE-XXX or DISC-XXX}.md
</prior_discussion>

Create a specification following the spec-creator agent instructions.
{If research provided, add: "Use the research findings to inform the specification."}
{If discussion provided, add: "Use the prior discussion decisions to inform the specification. Do not re-ask questions already decided."}
", subagent_type="sf-spec-creator", model="{profile_model}", description="Create specification")
```

## Step 5: Handle Agent Response

The agent will:
1. Ask critical questions (0-3) if needed
2. Create SPEC-XXX.md (with Prior Discussion section if --discuss was provided)
3. Update STATE.md
4. Update PRE-XXX.md or DISC-XXX.md `used_by` field if --discuss was provided
5. Return structured result

## Step 6: Display Result

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 SPECIFICATION CREATED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**ID:** SPEC-XXX
**Title:** [title]
**Type:** [feature | refactor | bugfix]
**Complexity:** [small | medium | large]

### Assumptions Made

- [List assumptions agent made]

---

📄 **File:** `.specflow/specs/SPEC-XXX.md`

---

## Next Step

`/sf:audit` — audit specification before implementation

<sub>/clear recommended → auditor needs fresh context</sub>

<sub>Optional: `/sf:discuss SPEC-XXX` — clarify assumptions before audit</sub>

{If complexity is large:}

### Warning

Specification is large (>150k tokens estimated).
Consider `/sf:split SPEC-XXX` to decompose into smaller specs.
```

</workflow>

<fallback>

**If agent spawning fails**, execute inline:

## Inline Spec Creation

### Get Next Spec Number

```bash
LAST=$(ls .specflow/specs/SPEC-*.md 2>/dev/null | sort -V | tail -1 | grep -oP 'SPEC-\K\d+')
NEXT=$(printf "%03d" $((${LAST:-0} + 1)))
echo "SPEC-$NEXT"
```

### Analyze Task

Based on task description:
- Determine type: feature/refactor/bugfix
- Identify likely files to modify
- Estimate complexity

### Write Specification

Create `.specflow/specs/SPEC-XXX.md` with:
- Frontmatter (id, type, status: draft, priority: medium, complexity, created)
- Context section
- Task section
- Requirements section
- Acceptance criteria
- Constraints
- Assumptions

### Update STATE.md

```markdown
## Current Position

- **Active Specification:** SPEC-XXX
- **Status:** drafting
- **Next Step:** /sf:audit
```

Add to Queue table.

</fallback>

<success_criteria>
- [ ] SpecFlow initialization verified
- [ ] Task description obtained
- [ ] SPEC-XXX.md created with all sections
- [ ] Complexity estimated (small/medium/large)
- [ ] Assumptions documented
- [ ] STATE.md updated with new spec
- [ ] User knows next step is /sf:audit
</success_criteria>
