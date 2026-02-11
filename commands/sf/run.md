---
name: sf:run
description: Execute the specification (implement the code)
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
  - Task
  - AskUserQuestion
---

<purpose>
Execute the active specification by implementing all requirements. Creates atomic commits during implementation and prepares for review.
</purpose>

<context>
@.specflow/STATE.md
@.specflow/PROJECT.md
@~/.claude/specflow-cc/agents/spec-executor.md
@~/.claude/specflow-cc/agents/spec-executor-orchestrator.md
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

## Step 2: Get Active Specification

Read `.specflow/STATE.md` and extract Active Specification.

**If no active specification:**
```
No active specification to execute.

Run `/sf:new "task description"` to create one.
```
Exit.

## Step 3: Load Specification

Read the active spec file: `.specflow/specs/SPEC-XXX.md`

## Step 4: Check Audit Status

**If status is "audited":**
Continue to execution.

**If status is NOT "audited":**
Show warning:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 WARNING: Specification has not passed audit
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Specification:** SPEC-XXX
**Current Status:** {status}

{If audit exists and has issues:}
### Outstanding Issues

From last audit (v{N}):

**Critical:**
1. {Issue 1}
2. {Issue 2}

**Recommendations:**
3. {Recommendation 1}

---

Proceeding without audit approval may result in:
- Implementation that doesn't meet requirements
- Rework needed after review

Continue anyway?
```

Use AskUserQuestion with options:
- "Yes, proceed anyway" → continue, log warning
- "No, run audit first" → exit with `/sf:audit` suggestion

**If user proceeds anyway:**
Log in STATE.md Warnings table:
```
| {date} | SPEC-XXX | Executed without audit approval |
```

## Step 4.5: Determine Execution Mode

Check specification complexity to choose execution mode.

**If `## Implementation Tasks` section exists in spec:**
- Count task groups (G1, G2, G3, etc.)
- Check for parallel opportunities (groups with no dependencies on each other)
- If groups > 1 AND parallelism exists → use `orchestrated` mode

**If no Implementation Tasks but large spec:**
- Count requirements sections
- Estimate scope from Files to Create/Modify counts
- If total files > 5 OR requirements sections > 3 → suggest running `/sf:audit` first to generate tasks

**Mode selection logic:**

| Condition | Mode |
|-----------|------|
| No Implementation Tasks section | single |
| 1 task group only | single |
| Multiple groups, no parallelism (all sequential) | single |
| Multiple groups with parallel opportunities | orchestrated |

## Step 5: Pre-Execution Summary

Display what will be implemented:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 EXECUTING: SPEC-XXX
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Title:** {spec title}
**Type:** {feature|refactor|bugfix}
**Complexity:** {small|medium|large}
**Execution Mode:** {single|orchestrated}

{If orchestrated:}
- Task Groups: {count}
- Waves: {count}
- Parallelization: Wave {N} runs {count} workers simultaneously

### Scope

**Files to create:** {count}
**Files to modify:** {count}
**Files to delete:** {count}

### Acceptance Criteria

- [ ] {Criterion 1}
- [ ] {Criterion 2}
- [ ] {Criterion 3}

---

Beginning implementation...
```

## Step 6: Determine Model Profile

Check `.specflow/config.json` for model profile setting:

```bash
[ -f .specflow/config.json ] && cat .specflow/config.json | grep -o '"model_profile"[[:space:]]*:[[:space:]]*"[^"]*"' | cut -d'"' -f4 || echo "balanced"
```

**Profile Table:**

| Profile | spec-creator | spec-auditor | spec-splitter | discusser | spec-executor | spec-executor-orchestrator | spec-executor-worker | impl-reviewer | spec-reviser | researcher | codebase-scanner |
|---------|--------------|--------------|---------------|-----------|---------------|---------------------------|---------------------|---------------|--------------|------------|-----------------|
| max | opus | opus | opus | opus | opus | opus | opus | opus | opus | opus | opus |
| quality | opus | opus | opus | opus | opus | opus | opus | sonnet | sonnet | sonnet | sonnet |
| balanced | opus | opus | opus | opus | sonnet | sonnet | sonnet | sonnet | sonnet | sonnet | sonnet |
| budget | sonnet | sonnet | sonnet | sonnet | sonnet | sonnet | sonnet | haiku | sonnet | haiku | haiku |

Use model for `spec-executor` or `spec-executor-orchestrator` from selected profile based on execution mode.

## Step 7: Update Status

Update STATE.md:
- Status → "running"
- Next Step → "(in progress)"

Update spec frontmatter:
- status → "running"

## Step 8: Spawn Executor Agent

**If mode == "single":**

Launch the spec-executor subagent (traditional single-agent execution):

```
Task(prompt="
<specification>
@.specflow/specs/SPEC-XXX.md
</specification>

<project_context>
@.specflow/PROJECT.md
</project_context>

Execute this specification following the spec-executor agent instructions.
Implement all requirements with atomic commits.
", subagent_type="sf-spec-executor", model="{profile_model}", description="Execute specification")
```

**If mode == "orchestrated":**

Launch the orchestrator subagent (parallel multi-agent execution):

```
Task(prompt="
<specification>
@.specflow/specs/SPEC-XXX.md
</specification>

<project_context>
@.specflow/PROJECT.md
</project_context>

Orchestrate execution of this large specification.
Parse task groups from Implementation Tasks section.
Determine execution waves based on dependencies.
Spawn worker subagents in parallel where possible.
Aggregate results and create final execution summary.
", subagent_type="sf-spec-executor-orchestrator", model="{profile_model}", description="Orchestrate specification execution")
```

## Step 9: Handle Agent Response

The agent will:
1. Implement all requirements
2. Create atomic commits
3. Handle deviations
4. Add Execution Summary to spec
5. Update STATE.md status to "review"

**After agent returns, verify STATE.md is correct:**
- Active Specification must still be the SAME spec (not advanced to next)
- Status must be "review" (not "done" or "draft")
- Spec must still be in Queue (not moved to Completed)
- If agent over-advanced the state, revert to: active=SPEC-XXX, status=review, next=/sf:review

## Step 9.5: Check STATE.md Size and Rotate if Needed

After updating STATE.md, check if rotation is needed:

1. Use the Read tool to read `.specflow/STATE.md` and count total lines
2. If total lines <= 100, no action needed
3. If total lines > 100:
   a. Read the `## Decisions` section and extract all decision rows (lines matching `| YYYY-`)
   b. Count decision rows. If <= 7, no rotation needed
   c. If > 7 decisions:
      - Identify the 5 most recent decisions (last 5 rows) -- these STAY
      - Identify older decisions (all rows except last 5) -- these MOVE to archive
      - Read `.specflow/DECISIONS_ARCHIVE.md` (create with template if missing)
      - Write updated DECISIONS_ARCHIVE.md: insert old decisions after the table header row
      - Write updated STATE.md: replace Decisions section content with only the 5 most recent decisions

## Step 10: Display Result

**IMPORTANT:** Output the following directly as formatted text, NOT wrapped in a markdown code block:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 EXECUTION COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Specification:** SPEC-XXX
**Status:** Ready for review

### Summary

- **Files created:** {count}
- **Files modified:** {count}
- **Files deleted:** {count}
- **Commits:** {count}

### Acceptance Criteria

- [x] {Criterion 1}
- [x] {Criterion 2}
- [x] {Criterion 3}

{If deviations occurred:}
### Deviations

1. [Rule {N}] {description}

---

📄 File: .specflow/specs/SPEC-XXX.md

---

## Next Step

`/sf:review` — audit the implementation

Tip: `/clear` recommended — reviewer needs fresh context
```

</workflow>

<fallback>

**If agent spawning fails**, execute inline:

## Inline Execution

### Load Requirements

Parse specification for:
- Files to create/modify/delete
- Interfaces
- Acceptance criteria
- Constraints

### Implement

For each requirement:
1. Create/modify file
2. Follow project patterns
3. Meet acceptance criteria

### Commit

After each logical unit:
```bash
git add <files>
git commit -m "feat(sf-XXX): <description>"
```

### Handle Deletions

After replacements work:
1. Check no remaining references
2. Delete old files
3. Commit removal

### Update Specification

Append Execution Summary to spec.

### Update STATE.md

- Status → "review"
- Next Step → "/sf:review"

</fallback>

<success_criteria>
- [ ] Active specification identified
- [ ] Audit status checked (warning if not audited)
- [ ] All files created as specified
- [ ] All files modified as specified
- [ ] All files deleted as specified
- [ ] Atomic commits created
- [ ] Execution Summary added to spec
- [ ] STATE.md updated to "review"
- [ ] Clear next step shown
</success_criteria>
