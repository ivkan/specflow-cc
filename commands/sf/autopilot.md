---
name: sf:autopilot
description: Run full spec lifecycle autonomously (audit -> run -> review -> done)
argument-hint: "[SPEC-XXX] [--all]"
# SPEC-011: Accepts optional SPEC-XXX; resolves via state resolve; FAILS when N>1 and no ID (no picker)
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
  - Task
---

<purpose>
Run the full specification lifecycle autonomously. Reads STATE.md to determine current phase, spawns appropriate agents, advances through audit -> revise -> run -> review -> fix -> done cycle without manual intervention. Includes cycle-detection safeguards to prevent infinite loops.
</purpose>

<context>
@.specflow/STATE.md
@.specflow/specs/SPEC-*.md
@.specflow/config.json
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

## Step 2: Parse Arguments and Determine Mode

Parse the command argument to determine execution mode:

| Argument | Mode | Behavior |
|----------|------|----------|
| (none) | single | Resolve active spec; fail fast if N>1 (no picker) |
| `SPEC-XXX` | single | Process this explicit spec ID |
| `--all` | batch | Process all actionable specs in Queue order; still requires explicit SPEC-ID if N>1 |

**CRITICAL — N>1 guard (autopilot must be unambiguous):**

Parse `$ARGUMENTS`:
- Let `FIRST_TOKEN` = first whitespace-separated token of `$ARGUMENTS`.
- If `FIRST_TOKEN` matches `^SPEC-\d{3,}$`:
  - Set `SPEC_ARG="$FIRST_TOKEN"`
  - Set `AUTOPILOT_SCOPE` = remainder of `$ARGUMENTS` after `FIRST_TOKEN` (trimmed)
- Else:
  - Set `SPEC_ARG=""` (resolver uses Active Specifications table)
  - Set `AUTOPILOT_SCOPE="$ARGUMENTS"`

Call:

```bash
node ~/.claude/specflow-cc/bin/sf-tools.cjs state resolve $SPEC_ARG
```

Use `AUTOPILOT_SCOPE` in the subsequent mode-determination step (e.g. `--all` flag).

Parse the JSON response:
- `{"action":"use","id":"SPEC-XXX"}` → proceed with SPEC-XXX
- `{"action":"error","code":"NO_ACTIVE_SPEC"}` → display error and exit:
  ```
  No active specification to process.

  Provide a spec ID: `/sf:autopilot SPEC-XXX`
  Or run on all specs: `/sf:autopilot --all`
  ```
- `{"action":"error","code":"SPEC_NOT_ACTIVE","id":"SPEC-XXX"}` → display error and exit:
  ```
  SPEC-XXX is not in the Active Specifications table.
  ```
- `{"action":"ask","options":[...]}` → **FAIL FAST** (do NOT show picker):
  ```
  Autopilot requires explicit SPEC-ID when >1 active specs.

  Active specs: {list SPEC-IDs from options}

  Provide a spec ID: `/sf:autopilot SPEC-XXX`
  ```
  Exit. (This applies to both plain `/sf:autopilot` AND `/sf:autopilot --all` without a SPEC-ID. `--all` controls within-spec behavior, not multi-spec iteration.)

**If single mode with explicit SPEC-ID:**
- SPEC-ID was resolved via state resolve above (action:use)

**If batch mode (--all):**
- Identify all actionable specs from Queue (any spec with status: draft, auditing, revision_requested, audited, running, review)

## Step 3: Set Configuration Constants

Read `.specflow/config.json` for autopilot configuration:

```bash
[ -f .specflow/config.json ] && cat .specflow/config.json
```

Parse the `"autopilot"` section if it exists:

```json
{
  "autopilot": {
    "max_audit_cycles": 3,
    "max_fix_cycles": 3
  }
}
```

**Configuration constants:**

| Constant | Default | Description |
|----------|---------|-------------|
| MAX_AUDIT_CYCLES | 3 | Max audit->revise iterations before halt |
| MAX_FIX_CYCLES | 3 | Max review->fix iterations before halt |

If config file doesn't exist or autopilot section is missing, use defaults.

## Step 4: Initialize Tracking State

Initialize per-spec tracking variables (maintained in command memory, not persisted to files):

```
audit_cycles = 0
fix_cycles = 0
specs_processed = []   (batch mode)
specs_failed = []      (batch mode)
current_spec = null
```

## Step 5: Main Loop (per spec)

### 5.1 Load Current Spec State

Read `.specflow/specs/SPEC-XXX.md` to get frontmatter status (spec ID resolved in Step 2).

### 5.2 Determine Current Phase

Based on spec status, determine the phase and action:

| Spec Status | Phase | Action |
|-------------|-------|--------|
| `draft` | audit | Spawn spec-auditor agent |
| `auditing` | audit | Spawn spec-auditor agent |
| `revision_requested` | revise | Spawn spec-reviser agent with scope "all" |
| `audited` | run | Spawn spec-executor or spec-executor-orchestrator agent |
| `running` | run | Spawn spec-executor or spec-executor-orchestrator agent |
| `review` | review-or-fix | Check for latest review result (see 5.3) |
| `needs_decomposition` | halt | Halt with decomposition message |
| `paused` | halt | Halt with paused message |
| `done` | done | Run done logic (archive, update STATE.md) |

**Halt messages:**

**If `needs_decomposition`:**
```
Spec SPEC-XXX requires decomposition.

Run `/sf:split` manually, then restart autopilot.
```
Record as failed in batch mode. Exit in single mode.

**If `paused`:**
```
Spec SPEC-XXX is paused.

Resume with `/sf:resume` first.
```
Record as failed in batch mode. Exit in single mode.

### 5.3 Review Phase Logic

When spec status is `review`, inspect the Review History section:

**If no review exists yet OR last review entry is a Fix Response:**
- Spawn impl-reviewer agent

**If last review entry is APPROVED:**
- Proceed to done phase (5.5)

**If last review entry is CHANGES_REQUESTED:**
- Spawn spec-executor in fix mode with scope "all"

### 5.4 Spawn Agent for Phase

Spawn the appropriate agent based on phase (see Step 6 for details).

Include `<autopilot>true</autopilot>` context tag in all Task prompts.

**Agent spawning example:**

```
Task(prompt="
<specification>
@.specflow/specs/SPEC-XXX.md
</specification>

<project_context>
@.specflow/PROJECT.md
</project_context>

<autopilot>true</autopilot>

Execute this specification following the spec-executor agent instructions.
Implement all requirements with atomic commits.
", subagent_type="sf-spec-executor", model="{profile_model}", description="Execute specification (autopilot mode)")
```

### 5.5 After Agent Completes

1. **Re-read STATE.md and spec file** to get updated status
2. **Check STATE.md size and rotate if needed:**

```bash
node ~/.claude/specflow-cc/bin/sf-tools.cjs state rotate
```

Idempotent — a no-op when the file is already within limits, so it is safe to run every time. It moves old decision rows to `.specflow/DECISIONS_ARCHIVE.md`, compresses any oversized cell into a pointer, and prints a one-line integrity summary (lines, bytes, decision rows, largest row) worth a glance.

**Do NOT rotate by hand, and do NOT gate rotation on line count.** The previous guidance here read STATE.md, counted lines, and rewrote the file if it exceeded ~100 — which failed on both counts. A field STATE.md reached 205 KB at *91 lines*, because markdown rows grow in WIDTH, not number: the trigger never fired. And by then the file was far past the Read cap, so the rewrite step ran on a truncated read and destroyed the Decisions tail. `state rotate` triggers on BYTES and does the work in Node, which has no Read cap.

3. **Increment cycle counters:**
   - If just completed revise phase: `audit_cycles++`
   - If just completed fix phase: `fix_cycles++`

4. **Check cycle limits:**
   - If `audit_cycles >= MAX_AUDIT_CYCLES`: HALT with "Audit cycle limit reached (3/3)"
   - If `fix_cycles >= MAX_FIX_CYCLES`: HALT with "Fix cycle limit reached (3/3)"

5. **Reset cycle counters when transitioning between major phases:**
   - If spec transitions from audit/revise phase to run phase (status becomes "audited"): `audit_cycles = 0`
   - If spec enters review/fix phase (status becomes "review"): `fix_cycles = 0`

6. **Loop back to 5.2** with the updated status

**Halt behavior when cycle limit reached:**
1. Leave the spec in its current state in STATE.md (do not archive, do not clear active)
2. Record as failed in specs_failed list with reason "Audit cycle limit (3/3)" or "Fix cycle limit (3/3)"
3. In batch mode: attempt next spec in queue (do not abort the entire batch)
4. In single mode: proceed directly to summary report (Step 9)

### 5.6 Done Phase (inline)

When spec reaches done status OR last review is APPROVED, execute the done logic inline:

1. **Create archive directory:**
```bash
mkdir -p .specflow/archive
```

2. **Update spec frontmatter:**
   - status → "done"
   - Add Completion section with timestamp and commit/review counts

```markdown
---

## Completion

**Completed:** {date} {time}
**Total Commits:** {count from Execution Summary}
**Review Cycles:** {count of Review v[N] entries}
```

3. **Extract decisions:**
   - Scan specification for technology choices mentioned in Context or Assumptions
   - Scan for patterns established during implementation
   - If significant decisions found, add to STATE.md Decisions table:
   ```markdown
   | {date} | SPEC-XXX | {decision description} |
   ```

4. **Archive specification:**
```bash
mv .specflow/specs/SPEC-XXX.md .specflow/archive/
```

5. **Update STATE.md:**
   Remove SPEC-XXX from Active Specifications table:
   ```bash
   node ~/.claude/specflow-cc/bin/sf-tools.cjs state remove-active SPEC-XXX
   ```

**NEVER write `.specflow/STATE.md` with the Write tool** — it may exceed your Read cap, and a full-file Write after a truncated Read destroys it. Use `sf-tools state ...` only; if it cannot express the change, use a single anchored `Edit` with a unique `old_string`, never a full rewrite.
   Remove SPEC-XXX row from Queue table:
   ```bash
   node ~/.claude/specflow-cc/bin/sf-tools.cjs queue remove SPEC-XXX
   ```

6. **Check STATE.md size and rotate** (same logic as 5.5 step 2)

7. **Create final commit:**
```bash
git add .specflow/
git commit -m "docs(sf): complete SPEC-XXX"
```

8. **Record completion:**
   - In batch mode: add to specs_processed list with outcome "COMPLETED"

## Step 6: Agent Spawning Details

For each phase, determine the agent type and model profile:

| Phase | Agent | Subagent Type | Auto-Resolution |
|-------|-------|---------------|-----------------|
| audit | spec-auditor | sf-spec-auditor | N/A (no interactive prompts) |
| revise | spec-reviser | sf-spec-reviser | scope = "all" |
| run | spec-executor or spec-executor-orchestrator | sf-spec-executor / sf-spec-executor-orchestrator | Skip audit-status warning (proceed anyway) |
| review | impl-reviewer | sf-impl-reviewer | N/A (no interactive prompts) |
| fix | spec-executor (fix mode) | sf-spec-executor | scope = "all" |
| done | (inline logic) | N/A | Skip review/verify warnings (proceed anyway) |

### 6.1 Determine Model Profile

Check `.specflow/config.json` for model profile setting:

```bash
[ -f .specflow/config.json ] && cat .specflow/config.json | grep -o '"model_profile"[[:space:]]*:[[:space:]]*"[^"]*"' | cut -d'"' -f4 || echo "balanced"
```

**Profile Table:**

| Profile | spec-auditor | spec-reviser | spec-executor | spec-executor-orchestrator | spec-executor-worker | impl-reviewer |
|---------|--------------|--------------|---------------|---------------------------|---------------------|---------------|
| max | opus | opus | opus | opus | opus | opus |
| quality | opus | sonnet | opus | opus | opus | sonnet |
| balanced | opus | sonnet | sonnet | sonnet | sonnet | sonnet |
| budget | sonnet | sonnet | sonnet | sonnet | sonnet | haiku |

### 6.2 Determine Execution Mode (run phase)

When spawning execution agent, check specification complexity:

**If `## Implementation Tasks` section exists in spec:**
- Count task groups (G1, G2, G3, etc.)
- Check for parallel opportunities (groups with no dependencies on each other)
- If groups > 1 AND parallelism exists → use `spec-executor-orchestrator`
- Otherwise → use `spec-executor`

**If no Implementation Tasks section:**
- Use `spec-executor`

### 6.3 Agent Prompts

**Audit phase (spec-auditor):**
```
Task(prompt="
<specification>
@.specflow/specs/SPEC-XXX.md
</specification>

<project_context>
@.specflow/PROJECT.md
</project_context>

<autopilot>true</autopilot>

Audit this specification following the spec-auditor agent instructions.
Check for completeness, clarity, feasibility, and alignment with project patterns.
", subagent_type="sf-spec-auditor", model="{profile_model}", description="Audit specification (autopilot mode)")
```

**Revise phase (spec-reviser):**
```
Task(prompt="
<specification>
@.specflow/specs/SPEC-XXX.md
</specification>

<project_context>
@.specflow/PROJECT.md
</project_context>

<autopilot>true</autopilot>
<scope>all</scope>

Revise this specification to address ALL audit findings.
Follow the spec-reviser agent instructions.
", subagent_type="sf-spec-reviser", model="{profile_model}", description="Revise specification (autopilot mode)")
```

**Run phase (spec-executor):**
```
Task(prompt="
<specification>
@.specflow/specs/SPEC-XXX.md
</specification>

<project_context>
@.specflow/PROJECT.md
</project_context>

<autopilot>true</autopilot>

Execute this specification following the spec-executor agent instructions.
Implement all requirements with atomic commits.
Proceed even if audit status is not 'audited'.
", subagent_type="sf-spec-executor", model="{profile_model}", description="Execute specification (autopilot mode)")
```

**Run phase (spec-executor-orchestrator):**
```
Task(prompt="
<specification>
@.specflow/specs/SPEC-XXX.md
</specification>

<project_context>
@.specflow/PROJECT.md
</project_context>

<autopilot>true</autopilot>

Orchestrate execution of this large specification.
Parse task groups from Implementation Tasks section.
Determine execution waves based on dependencies.
Spawn worker subagents in parallel where possible.
Proceed even if audit status is not 'audited'.
", subagent_type="sf-spec-executor-orchestrator", model="{profile_model}", description="Orchestrate specification execution (autopilot mode)")
```

**Review phase (impl-reviewer):**
```
Task(prompt="
<specification>
@.specflow/specs/SPEC-XXX.md
</specification>

<project_context>
@.specflow/PROJECT.md
</project_context>

<autopilot>true</autopilot>

Review the implementation against the specification.
Follow the impl-reviewer agent instructions.
", subagent_type="sf-impl-reviewer", model="{profile_model}", description="Review implementation (autopilot mode)")
```

**Fix phase (spec-executor):**
```
Task(prompt="
<specification>
@.specflow/specs/SPEC-XXX.md
</specification>

<project_context>
@.specflow/PROJECT.md
</project_context>

<autopilot>true</autopilot>
<mode>fix</mode>
<scope>all</scope>

Fix ALL issues identified in the latest review.
Follow the spec-executor agent instructions in fix mode.
", subagent_type="sf-spec-executor", model="{profile_model}", description="Fix implementation issues (autopilot mode)")
```

## Step 7: Batch Mode — Advance to Next Spec

If `--all` mode (batch execution):

1. **Record completed spec** in specs_processed list:
   - Spec ID
   - Title
   - Outcome (COMPLETED or reason for failure)
   - Audit cycles used
   - Fix cycles used

2. **Read STATE.md Queue** for next actionable spec:
   - First spec in Queue by Priority that has an actionable status
   - Actionable statuses: draft, auditing, revision_requested, audited, running, review

3. **If next spec found:**
   - Update STATE.md active spec to the next spec
   - Reset cycle counters: `audit_cycles = 0`, `fix_cycles = 0`
   - Loop to Step 5

4. **If no more actionable specs:**
   - Proceed to Step 9 (summary report)

## Step 8: Handle Agent Failures

If a Task agent fails to spawn or encounters an unrecoverable error:

1. **Log the error** with full details:
   - Phase where failure occurred
   - Spec ID
   - Error message from Task agent

2. **Record as failed:**
   - Add to specs_failed list with reason: "Agent failure: [phase] - {error message}"

3. **Continue execution:**
   - In batch mode: continue to next spec in queue (do not abort the entire batch)
   - In single mode: proceed directly to summary report (Step 9)

4. **Leave spec in current state:**
   - Do not archive
   - Do not modify status
   - Leave in `.specflow/specs/` directory

## Step 9: Display Summary Report

**IMPORTANT:** Output the following directly as formatted text, NOT wrapped in a markdown code block:

**Single mode:**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 AUTOPILOT COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Mode:** single
**Spec:** SPEC-XXX

### Result

**Outcome:** {COMPLETED | HALTED}
**Audit Cycles:** {count}/{MAX_AUDIT_CYCLES}
**Fix Cycles:** {count}/{MAX_FIX_CYCLES}

{If COMPLETED:}
✓ Specification processed from {start_status} to done
  - Files created: {count}
  - Files modified: {count}
  - Total commits: {count}
  - Total review cycles: {count}

{If HALTED:}
✗ Halted at phase: {phase}
  Reason: {reason}

---

## Next Steps

{If COMPLETED and queue has more specs:}
`/sf:autopilot --all` — process remaining queue

{If COMPLETED and queue is empty:}
All specs completed. Queue is empty.

{If HALTED:}
Review spec status with `/sf:status` and `/sf:show SPEC-XXX`.
Address the issue manually, then resume autopilot.
```

**Batch mode:**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 AUTOPILOT COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Mode:** batch
**Specs Processed:** {count}
**Specs Completed:** {completed_count}
**Specs Failed:** {failed_count}

### Results

| Spec | Title | Outcome | Audit Cycles | Fix Cycles |
|------|-------|---------|--------------|------------|
{For each spec in specs_processed:}
| SPEC-XXX | {title} | COMPLETED | 2 | 1 |

{If any failures:}
### Failures

| Spec | Title | Halted At | Reason |
|------|-------|-----------|--------|
{For each spec in specs_failed:}
| SPEC-ZZZ | {title} | {phase} | Fix cycle limit (3/3) |

---

## Next Steps

{If all succeeded and queue empty:}
All specs processed successfully. Queue is empty.

{If all succeeded and queue has more:}
Queue has {count} remaining specs.
`/sf:autopilot --all` — process remaining queue

{If failures occurred:}
Failed specs remain in `.specflow/specs/` with their current status.
Review manually with `/sf:status` and `/sf:show SPEC-ZZZ`.
Fix issues, then resume with `/sf:autopilot --all`.
```

</workflow>

<fallback>

If Task agent spawning fails for any phase, the command handles it via Step 8 (Handle Agent Failures).

The autopilot does NOT have an inline fallback for agent logic itself — it relies on the specialized agents to execute their phases correctly.

**Agent failure handling:**
1. Log error details (phase, spec ID, error message)
2. Record spec as failed with reason "Agent failure: [phase]"
3. In batch mode: continue to next spec
4. In single mode: proceed to summary report
5. Leave spec in current state (do not archive or modify status)

This ensures one agent failure does not crash the entire autopilot run.

</fallback>

<success_criteria>
- [ ] Mode determined correctly (single vs batch)
- [ ] Configuration constants loaded from config.json
- [ ] Spec processed from current status through to "done" (single mode)
- [ ] All actionable specs processed (batch mode)
- [ ] Audit cycle limit enforced (MAX_AUDIT_CYCLES)
- [ ] Fix cycle limit enforced (MAX_FIX_CYCLES)
- [ ] Cycle counters reset when transitioning between major phases
- [ ] STATE.md decision rotation performed when needed
- [ ] Summary report displayed with accurate metrics
- [ ] AskUserQuestion never called by autopilot command itself
- [ ] STATE.md accurate at every point
- [ ] No infinite loops possible
- [ ] Agent failures handled gracefully (do not crash entire run)
</success_criteria>
