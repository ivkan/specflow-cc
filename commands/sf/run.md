---
name: sf:run
description: Execute the specification (implement the code)
# SPEC-011: Accepts optional SPEC-XXX as first positional arg; resolves via state resolve
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

## Step 2: Resolve Active Specification

Parse `$ARGUMENTS`:
- Let `FIRST_TOKEN` = first whitespace-separated token of `$ARGUMENTS`.
- If `FIRST_TOKEN` matches `^SPEC-\d{3,}$`:
  - Set `SPEC_ARG="$FIRST_TOKEN"`
  - Set `RUN_SCOPE` = remainder of `$ARGUMENTS` after `FIRST_TOKEN` (trimmed)
- Else:
  - Set `SPEC_ARG=""` (resolver uses Active Specifications table)
  - Set `RUN_SCOPE="$ARGUMENTS"`

Call:

```bash
node ~/.claude/specflow-cc/bin/sf-tools.cjs state resolve $SPEC_ARG
```

Use `RUN_SCOPE` in the subsequent argument-parsing step (Step 3.5).

Parse the JSON response:
- `{"action":"use","id":"SPEC-XXX"}` → proceed with SPEC-XXX
- `{"action":"error","code":"NO_ACTIVE_SPEC"}` → display error and exit:
  ```
  No active specification to execute.

  Run `/sf:new "task description"` to create one.
  ```
- `{"action":"error","code":"SPEC_NOT_ACTIVE","id":"SPEC-XXX"}` → display error and exit:
  ```
  SPEC-XXX is not in the Active Specifications table.
  ```
- `{"action":"ask","options":[...]}` → use AskUserQuestion to show picker:
  ```
  Multiple active specifications. Which one to run?
  Options: {id — title (status)} for each entry
  ```

## Step 3: Load Specification

Read the active spec file: `.specflow/specs/SPEC-XXX.md`

## Step 3.5: Handle `--apply=minor` Flag

**Check if `RUN_SCOPE` contains `--apply=minor`.**

**If `--apply=minor` is NOT present:** Continue to Step 4 (existing behavior unchanged).

**If `--apply=minor` IS present:**

### 3.5.a Verify Status Precondition

Confirm the resolved spec has `status == "audited"` in its frontmatter.

If status is NOT `audited`:
```
Error: --apply=minor requires status 'audited' (current: {status})
```
Exit 1. No state mutation.

### 3.5.b Parse Severity Counts from Latest Audit History

Read the spec file and find the most recent `### Audit v[N]` entry in Audit History.

Extract Critical count and Recommendations count from that entry. Map Recommendations count to `--minor` (per R2 CLI contract).

Run:
```bash
node ~/.claude/specflow-cc/bin/sf-tools.cjs recommend --source audit --critical N --minor M
```

Parse the JSON response.

If `action != "run --apply=minor"`:
```
Error: --apply=minor requires only Recommendations (found {N} Critical). Run /sf:revise instead.
```
Exit 1. No state mutation.

### 3.5.c Apply Recommendations via `/sf:revise` Machinery

Parse the latest Audit History Recommendations list and extract numbered items as a comma-separated string (e.g. `"2,3,5"` — the sequence numbers as they appear in the Recommendations section).

Invoke existing `/sf:revise` machinery passing the numbered target list and `--internal` flag (so `/sf:revise` Step 8 does NOT mutate STATE.md — the caller owns the status transition; status must remain `audited` until the structural-validate gate passes):
```
/sf:revise SPEC-XXX "{N,M,K}" --internal
```

This reuses `/sf:revise`'s existing per-item commit behavior. Do NOT duplicate revise logic.

### 3.5.d Structural Validation Gate

Run spec structural validation:
```bash
node ~/.claude/specflow-cc/bin/sf-tools.cjs spec validate SPEC-XXX
```

This is the exact gate specified in R2.5: verifies frontmatter parses, required fields present (`id`, `type`, `status`, `priority`), and `## Requirements` heading present. No fallback path.

If `spec validate` exits non-zero:
- Print error output
- Leave STATE.md status as `audited` (no transition)
- Exit 1
- Note: Revise commits remain in git history; user can manually `git revert` or run full `/sf:revise` cycle. STATE.md status is the sole rollback signal.

### 3.5.e On Gate Success: Continue to Execution

On validation passing: skip Steps 4–7 (audit status check, mode determination, pre-execution summary, model profile, status update) and proceed directly to Step 8 (Spawn Executor Agent) with mode="orchestrated" (or "single" based on the spec's Implementation Tasks section — same logic as Step 4.5).

All STATE.md mutations go through `sf-tools state ...` / `sf-tools queue ...` — never a Read+Write of the whole file, and never Bash/awk/sed. (This supersedes the SPEC-004 Read+Write rule: STATE.md can outgrow the Read cap, and a full-file write after a truncated read destroys it.)

---

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

```bash
node ~/.claude/specflow-cc/bin/sf-tools.cjs state add-active SPEC-XXX running "(in progress)"
```

**NEVER write `.specflow/STATE.md` with the Write tool** — it may exceed your Read cap, and a full-file Write after a truncated Read destroys it. Use `sf-tools state ...` only; if it cannot express the change, use a single anchored `Edit` with a unique `old_string`, never a full rewrite.

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

```bash
node ~/.claude/specflow-cc/bin/sf-tools.cjs state rotate
```

Idempotent — a no-op when the file is already within limits, so it is safe to run every time. It moves old decision rows to `.specflow/DECISIONS_ARCHIVE.md`, compresses any oversized cell into a pointer, and prints a one-line integrity summary (lines, bytes, decision rows, largest row) worth a glance.

**Do NOT rotate by hand, and do NOT gate rotation on line count.** The previous guidance here read STATE.md, counted lines, and rewrote the file if it exceeded ~100 — which failed on both counts. A field STATE.md reached 205 KB at *91 lines*, because markdown rows grow in WIDTH, not number: the trigger never fired. And by then the file was far past the Read cap, so the rewrite step ran on a truncated read and destroyed the Decisions tail. `state rotate` triggers on BYTES and does the work in Node, which has no Read cap.

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
