---
id: SPEC-005
type: feature
status: done
priority: high
complexity: medium
created: 2026-02-11
source: TODO-006
---

# Add Autopilot Mode (`/sf:autopilot`)

## Context

 SpecFlow's core workflow (audit -> revise -> run -> review -> fix -> done) requires manual invocation of each step. With a 96% fully-achieved rate across 49 sessions (per Claude Code Insights), the pipeline is reliable enough for full autonomy. Users should be able to start a spec (or batch of specs) and walk away while the system processes them end-to-end.

Currently, a user must:
1. Run `/sf:audit`, read the output, decide to `/sf:revise` or proceed
2. Run `/sf:run`, wait, then invoke `/sf:review`
3. If review requests changes, invoke `/sf:fix`, then `/sf:review` again
4. Finally invoke `/sf:done`

This is 4-7 manual invocations per spec. Autopilot eliminates this by reading STATE.md's "Next Step" field after each phase and invoking the corresponding agent inline, with cycle-detection safeguards.

## Goal Analysis

### Goal Statement
Users can invoke a single command that processes one or more specifications through the complete lifecycle without further manual intervention, stopping only on unrecoverable errors.

### Observable Truths
1. Running `/sf:autopilot` on an active spec in "draft" status results in the spec being archived in `.specflow/archive/` with status "done"
2. Running `/sf:autopilot --all` processes every actionable spec in the Queue sequentially to completion
3. An audit->revise cycle that exceeds MAX_AUDIT_CYCLES (default: 3) halts autopilot with a clear error rather than looping infinitely
4. A review->fix cycle that exceeds MAX_AUDIT_CYCLES (default: 3) halts autopilot with a clear error rather than looping infinitely
5. A summary report is displayed at the end showing all specs processed, their outcomes, and cycle counts
6. Interactive prompts (AskUserQuestion) in sub-steps are auto-resolved with safe defaults (e.g., "fix all", "apply all", "yes proceed")
7. STATE.md reflects accurate state at every point during autopilot execution

### Required Artifacts
- `commands/sf/autopilot.md` -- the autopilot command file
- `commands/sf/help.md` -- updated to include autopilot in command listing

### Required Wiring
- `autopilot.md` reads STATE.md to determine current phase and next step
- `autopilot.md` spawns existing agents (spec-auditor, spec-reviser, spec-executor/orchestrator, impl-reviewer, spec-executor in fix mode) inline via Task tool
- `autopilot.md` reads spec frontmatter to determine status after each agent completes
- `autopilot.md` invokes `/sf:next` logic to advance to the next queued spec in batch mode

### Key Links
- STATE.md "Next Step" field drives the phase-transition logic (fragile if agents write unexpected values)
- Cycle counters must persist across agent invocations within the autopilot command (maintained in local state, not STATE.md)
- Agent spawning must pass `<autopilot>true</autopilot>` context tag so interactive steps auto-resolve

## Task

Create a new command file `commands/sf/autopilot.md` that orchestrates the full spec lifecycle. The command reads STATE.md to determine the current phase, spawns the appropriate agent for that phase, reads the result, and advances to the next phase. It tracks audit and fix cycle counts to prevent infinite loops.

## Requirements

### Files to Create

1. **`commands/sf/autopilot.md`** -- Autopilot command

   The command file follows the established command pattern (frontmatter, purpose, context, workflow, fallback, success_criteria).

   **Frontmatter:**
   ```yaml
   ---
   name: sf:autopilot
   description: Run full spec lifecycle autonomously (audit -> run -> review -> done)
   argument-hint: "[SPEC-XXX] [--all]"
   allowed-tools:
     - Read
     - Write
     - Bash
     - Glob
     - Grep
     - Task
   ---
   ```

   Note: AskUserQuestion is deliberately excluded from allowed-tools. Autopilot must never prompt the user mid-execution. However, the exclusion of AskUserQuestion from autopilot's allowed-tools does NOT prevent spawned Task agents from using it — spawned agents inherit their own agent file's allowed-tools list, not the parent command's. The `<autopilot>true</autopilot>` context tag in the Task prompt is the operative mechanism for auto-resolution, signaling to agents to skip interactive prompts and use safe defaults.

   **Workflow Steps:**

   **Step 1: Verify Initialization** -- standard `.specflow` directory check.

   **Step 2: Parse Arguments and Determine Mode**

   | Argument | Mode | Behavior |
   |----------|------|----------|
   | (none) | single | Process the active spec in STATE.md |
   | `SPEC-XXX` | single | Set SPEC-XXX as active, then process it |
   | `--all` | batch | Process all actionable specs in Queue order |

   If single mode and no active spec exists and no SPEC-XXX argument: display error and exit.

   **Step 3: Set Configuration Constants**

   Read `.specflow/config.json` for overrides, otherwise use defaults:

   | Constant | Default | Description |
   |----------|---------|-------------|
   | MAX_AUDIT_CYCLES | 3 | Max audit->revise iterations before halt |
   | MAX_FIX_CYCLES | 3 | Max review->fix iterations before halt |

   These are read from `config.json` under an `"autopilot"` key if present:
   ```json
   {
     "autopilot": {
       "max_audit_cycles": 3,
       "max_fix_cycles": 3
     }
   }
   ```

   **Step 4: Initialize Tracking State**

   Initialize per-spec tracking variables (maintained in command memory, not persisted to files):

   ```
   audit_cycles = 0
   fix_cycles = 0
   specs_processed = []   (batch mode)
   specs_failed = []      (batch mode)
   current_spec = null
   ```

   **Step 5: Main Loop (per spec)**

   For each spec to process:

   5.1. Read STATE.md to get active spec and status.

   5.2. Read spec file to get frontmatter status.

   5.3. Determine current phase from spec status:

   | Spec Status | Phase | Action |
   |-------------|-------|--------|
   | `draft` | audit | Spawn spec-auditor agent |
   | `auditing` | audit | Spawn spec-auditor agent |
   | `revision_requested` | revise | Spawn spec-reviser agent with scope "all" |
   | `audited` | run | Spawn spec-executor or spec-executor-orchestrator agent |
   | `running` | run | Spawn spec-executor or spec-executor-orchestrator agent |
   | `review` | review-or-fix | Check for latest review result (see 5.4) |
   | `needs_decomposition` | halt | Halt with "Spec requires decomposition. Run `/sf:split` manually, then restart autopilot." Record as failed in batch mode. |
   | `paused` | halt | Halt with "Spec is paused. Resume with `/sf:resume` first." Record as failed in batch mode. |
   | `done` | done | Run done logic (archive, update STATE.md) |

   5.4. For `review` status, inspect spec's Review History:
   - If no review exists yet OR last review entry is a Fix Response: spawn impl-reviewer agent
   - If last review entry is APPROVED: proceed to done phase
   - If last review entry is CHANGES_REQUESTED: spawn spec-executor in fix mode with scope "all"

   5.5. After each agent completes:
   - Re-read STATE.md and spec file to get updated status
   - Perform STATE.md decision rotation check (same logic as other commands: >100 lines, >7 decisions triggers rotation)
   - Increment the appropriate cycle counter (audit_cycles++ after revise, fix_cycles++ after fix)
   - Check cycle limits:
     - If audit_cycles >= MAX_AUDIT_CYCLES: HALT with "audit cycle limit reached"
     - If fix_cycles >= MAX_FIX_CYCLES: HALT with "fix cycle limit reached"
   - Loop back to 5.3 with the updated status

   5.6. Reset cycle counters when transitioning between major phases:
   - audit_cycles resets to 0 when spec transitions from audit/revise phase to run phase (status becomes "audited")
   - fix_cycles resets to 0 when spec enters the review/fix phase (status becomes "review") — this ensures counters are fresh for the new phase, even though the reset-to-0 upon final transition to "done" is effectively a no-op as the loop exits

   **Step 6: Agent Spawning Details**

   For each phase, the autopilot spawns the same agents that the individual commands use, with the same model profile lookup:

   | Phase | Agent | Subagent Type | Auto-Resolution |
   |-------|-------|---------------|-----------------|
   | audit | spec-auditor | sf-spec-auditor | N/A (no interactive prompts) |
   | revise | spec-reviser | sf-spec-reviser | scope = "all" |
   | run | spec-executor or spec-executor-orchestrator | sf-spec-executor / sf-spec-executor-orchestrator | Skip audit-status warning (proceed anyway) |
   | review | impl-reviewer | sf-impl-reviewer | N/A (no interactive prompts) |
   | fix | spec-executor (fix mode) | sf-spec-executor | scope = "all" |
   | done | (inline logic) | N/A | Skip review/verify warnings (proceed anyway) |

   Each Task() prompt includes `<autopilot>true</autopilot>` context tag so agents know to skip interactive prompts and use safe defaults.

   Model profile lookup uses the same `.specflow/config.json` profile table as existing commands.

   **Step 7: Done Phase (inline)**

   When spec reaches done status, execute the done logic inline (same as `sf:done` command Steps 5-10):
   1. Update spec frontmatter status to "done", add Completion section
   2. Extract decisions
   3. Move spec to archive: `mv .specflow/specs/SPEC-XXX.md .specflow/archive/`
   4. Update STATE.md: clear active spec, remove from queue, set idle
   5. Create final commit: `git add .specflow/ && git commit -m "docs(sf): complete SPEC-XXX"`

   **Step 8: Batch Mode -- Advance to Next Spec**

   If `--all` mode:
   1. Record completed spec in specs_processed list with outcome and cycle counts
   2. Read STATE.md Queue for next actionable spec (same logic as `/sf:next` Step 3)
   3. If next spec found: update STATE.md active spec, reset cycle counters, loop to Step 5
   4. If no more actionable specs: proceed to Step 9

   **Step 9: Display Summary Report**

   ```
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    AUTOPILOT COMPLETE
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

   **Mode:** {single | batch}
   **Specs Processed:** {count}
   **Specs Failed:** {count}

   ### Results

   | Spec | Title | Outcome | Audit Cycles | Fix Cycles |
   |------|-------|---------|--------------|------------|
   | SPEC-XXX | {title} | COMPLETED | 2 | 1 |
   | SPEC-YYY | {title} | COMPLETED | 1 | 0 |

   {If any failures:}
   ### Failures

   | Spec | Title | Halted At | Reason |
   |------|-------|-----------|--------|
   | SPEC-ZZZ | {title} | review | Fix cycle limit (3/3) |

   ### Next Steps

   {If all succeeded and queue empty:}
   All specs processed successfully. Queue is empty.

   {If all succeeded and queue has more:}
   `/sf:autopilot --all` -- process remaining queue

   {If failures occurred:}
   Failed specs remain in `.specflow/specs/` with their current status.
   Review manually with `/sf:status` and `/sf:show SPEC-ZZZ`.
   ```

   **Halt Behavior (Step 5 cycle limit reached):**

   When a cycle limit is reached:
   1. Leave the spec in its current state in STATE.md (do not archive, do not clear active)
   2. Record as failed in specs_failed list
   3. In batch mode: attempt next spec in queue (do not abort the entire batch)
   4. In single mode: proceed directly to summary report

   **Fallback Behavior:**

   The autopilot command relies on spawning Task agents for each phase. If a Task agent fails to spawn or encounters an unrecoverable error:

   1. Log the error with full details (phase, spec ID, error message)
   2. Record the spec as failed in the specs_failed list with reason "Agent failure: [phase]"
   3. In batch mode: continue to the next spec in queue (do not abort the entire batch)
   4. In single mode: proceed directly to the summary report showing the failure
   5. Leave the spec in its current state in `.specflow/specs/` (do not archive, do not modify status)

   This ensures that a single agent failure does not crash the entire autopilot run, and the user receives clear diagnostic information about what went wrong.

### Files to Modify

2. **`commands/sf/help.md`** -- Add autopilot to the command listing

   In the "Core Workflow" table (Step 2b overview), add a new section after "Quick Execution":

   ```markdown
   ## Autonomous Execution

   | Command      | Description                             |
   |--------------|-----------------------------------------|
   | /sf:autopilot | Run full lifecycle autonomously         |
   ```

   In the "Typical Session" section, add autopilot alternative:

   ```
   ## Autonomous Alternative

   ```
   /sf:autopilot          # Process active spec end-to-end
   /sf:autopilot --all    # Process entire queue
   ```
   ```

   In the "Quick Start" section, add step 8:

   ```
   8. Or skip steps 4-7: `/sf:autopilot` -- run everything autonomously
   ```

## Acceptance Criteria

1. A file `commands/sf/autopilot.md` exists with valid command frontmatter (name, description, argument-hint, allowed-tools)
2. The command processes a spec from "draft" status all the way to "done" status (archived) when run on a well-formed spec
3. The command halts (does not loop infinitely) when audit->revise cycles exceed MAX_AUDIT_CYCLES
4. The command halts (does not loop infinitely) when review->fix cycles exceed MAX_FIX_CYCLES
5. The `--all` argument causes the command to process all actionable specs in Queue order
6. A summary report is displayed at the end showing specs processed, outcomes, and cycle counts
7. AskUserQuestion is NOT in the allowed-tools list (autopilot never prompts the user)
8. The command uses the same model profile lookup as existing commands (reads config.json)
9. STATE.md is updated correctly after each phase transition (status and next step reflect current reality)
10. `commands/sf/help.md` includes `/sf:autopilot` in its command listing under a new "Autonomous Execution" section

## Constraints

- Do NOT create a new agent file; autopilot is a command that orchestrates existing agents
- Do NOT modify any existing agent files (spec-auditor.md, impl-reviewer.md, etc.)
- Do NOT modify STATE.md format or schema
- Do NOT modify config.json format (only add optional `autopilot` section)
- Do NOT add AskUserQuestion to allowed-tools; autopilot must be fully non-interactive
- Do NOT persist cycle counters to disk; they exist only in command execution memory
- Do NOT skip the audit phase; every spec must pass audit before execution, even in autopilot
- Do NOT abort batch processing when a single spec fails; continue to the next spec

## Assumptions

- **Agents respect `<autopilot>true</autopilot>` context tag:** The spec-reviser, spec-executor, and done logic will auto-resolve interactive prompts when this tag is present. This works because agents already receive structured prompts and the autopilot command controls the Task() prompt content. Agents that encounter AskUserQuestion without it in their allowed-tools will fall through to their default/fallback behavior.
- **STATE.md "Next Step" field is reliable:** All existing agents consistently update this field, validated by the 96% success rate across 49 sessions.
- **Spec status in frontmatter is the canonical state:** Autopilot reads spec frontmatter status directly rather than relying solely on STATE.md Status field, since agent updates may be partial.
- **Review History parsing determines review-or-fix branching:** The spec's Review History section structure (Review vN vs Fix Response vN entries) is consistent enough to determine whether the next step is to review or fix.
- **Default MAX_AUDIT_CYCLES=3 and MAX_FIX_CYCLES=3 are appropriate:** Based on the observation that SPEC-003 took 4 audit cycles (the most observed), a default of 3 provides reasonable tolerance while catching genuine infinite loops. Users can increase via config.json if needed.
- **`/sf:done` logic can be inlined:** Rather than spawning a separate agent for the done phase, autopilot executes the archive/commit steps inline since they are simple file operations without complex decision-making.
- **Batch mode processes specs sequentially, not in parallel:** This is intentional for simplicity and because specs may have dependencies. Parallel spec execution is a separate TODO (TODO-013).

## Implementation Tasks

### Task Groups

| Group | Wave | Tasks | Dependencies | Est. Context |
|-------|------|-------|--------------|--------------|
| G1 | 1 | Create `commands/sf/autopilot.md` with full workflow (Steps 1-9), including argument parsing, phase detection, agent spawning, cycle detection, halt logic, done logic, batch mode, and summary report | -- | ~20% |
| G2 | 1 | Update `commands/sf/help.md` to add autopilot to command listings | -- | ~5% |

### Execution Plan

| Wave | Groups | Parallel? | Workers |
|------|--------|-----------|---------|
| 1 | G1, G2 | Yes | 2 |

**Total workers needed:** 2 (max in any wave)

## Notes

### Future Considerations

- **--dry-run flag:** A `--dry-run` mode that shows what autopilot would do without executing could be useful for previewing autopilot behavior. Not required for initial implementation.

## Audit History

### Audit v1 (2026-02-11)
**Status:** NEEDS_REVISION

**Context Estimate:** ~25% total

**Critical:**
1. Missing `needs_decomposition` status in the phase transition table (Step 5.3). The spec-auditor agent can set a spec's status to `needs_decomposition` (confirmed in `agents/spec-auditor.md` line 685), but this status is not handled in the Step 5.3 lookup table. If autopilot encounters this status, behavior is undefined. Add a row: `needs_decomposition` -> halt with "Spec requires decomposition. Run `/sf:split` manually, then restart autopilot." Record as failed in batch mode.

**Recommendations:**
2. Add `paused` status handling to the Step 5.3 table. If a spec is in "paused" state (from `/sf:pause`), autopilot should halt with "Spec is paused. Resume with `/sf:resume` first." rather than having undefined behavior.
3. Step 5.6 states `fix_cycles` resets when transitioning to "done", but at that point the loop exits -- the reset is a no-op. Consider removing to avoid confusion, or clarify it only matters if future logic changes.
4. Clarify the `<autopilot>true</autopilot>` mechanism. The spec's frontmatter excludes AskUserQuestion from autopilot's own allowed-tools, but spawned Task agents inherit their own agent file's tool list, not the parent command's. The autopilot tag in the Task prompt is the actual mechanism for auto-resolution, but the spec should explicitly note that the parent's tool restrictions do NOT propagate to spawned agents -- the tag is the operative mechanism.
5. G1 context estimate of ~40% is overstated. Based on comparable command files in the codebase (run.md ~370 lines, done.md ~350 lines), a markdown command file of this nature is closer to ~20%. Consider updating to a more accurate estimate.
6. [Strategic] Consider adding a `--dry-run` flag that shows what autopilot would do without executing. This is a minor future enhancement, not blocking for this spec.

### Response v1 (2026-02-11)
**Applied:** All critical issues and recommendations

**Changes:**
1. [✓] Missing `needs_decomposition` status — Added row to Step 5.3 table with halt action and "Spec requires decomposition. Run `/sf:split` manually, then restart autopilot." message
2. [✓] Add `paused` status handling — Added row to Step 5.3 table with halt action and "Spec is paused. Resume with `/sf:resume` first." message
3. [✓] Step 5.6 fix_cycles reset clarification — Updated text to clarify reset occurs when entering review phase, and note that final reset to "done" is a no-op
4. [✓] Clarify `<autopilot>true</autopilot>` mechanism — Added explicit note in frontmatter section explaining parent tool restrictions do NOT propagate to spawned agents, tag is operative mechanism
5. [✓] G1 context estimate overstated — Updated from ~40% to ~20% in Implementation Tasks table
6. [✓] --dry-run flag consideration — Added "Future Considerations" section with note about --dry-run as a potential enhancement

### Audit v2 (2026-02-11)
**Status:** APPROVED

**Context Estimate:** ~25% total

**Execution Scope:**

| Metric | Est. Context | Target | Status |
|--------|--------------|--------|--------|
| Total spec context | ~25% | <=50% | OK |
| Largest task group (G1) | ~20% | <=30% | OK |
| Worker overhead | ~10% | <=10% | OK |

**Quality Projection:**

| Context Range | Expected Quality | Status |
|---------------|------------------|--------|
| 0-30% | PEAK | <-- Current estimate |
| 30-50% | GOOD | - |
| 50-70% | DEGRADING | - |
| 70%+ | POOR | - |

**Goal-Backward Validation:**

| Check | Status | Notes |
|-------|--------|-------|
| Truth 1 (draft->done) has artifacts | OK | G1 Steps 5-7 |
| Truth 2 (--all batch) has artifacts | OK | G1 Step 8 |
| Truth 3 (audit cycle limit) has artifacts | OK | G1 Step 5.5 |
| Truth 4 (fix cycle limit) has artifacts | OK | G1 Step 5.5 |
| Truth 5 (summary report) has artifacts | OK | G1 Step 9 |
| Truth 6 (auto-resolved prompts) has artifacts | OK | autopilot tag + scope="all" |
| Truth 7 (STATE.md accuracy) has artifacts | OK | Step 5.5 re-read + rotation |
| All artifacts have purpose | OK | No orphans |
| Wiring complete | OK | All connections defined |
| Key links identified | OK | 3 critical paths flagged |

**Strategic fit:** Aligned with project goals -- directly reduces user friction, prerequisite for parallel spec execution (TODO-013).

**Project compliance:** No PROJECT.md exists; spec follows all observable codebase conventions.

**Assumptions Assessment:**

| # | Assumption | If wrong, impact |
|---|------------|------------------|
| A1 | Agents respect autopilot tag | Agents may prompt user via AskUserQuestion; mitigated by scope="all" bypassing interactive mode for revise/fix |
| A2 | STATE.md Next Step field is reliable | Phase transitions could stall; mitigated by reading spec frontmatter as canonical state |
| A3 | Review History structure is consistent | review-or-fix branching may fail; low risk given established pattern |
| A4 | Default cycle limits of 3 are appropriate | May halt prematurely on complex specs; mitigated by config.json override |

**Comment:** Well-structured specification with comprehensive detail. All v1 critical issues and recommendations have been addressed. The spec follows established command patterns exactly, provides clear state machine logic, and handles edge cases (halt statuses, cycle limits, batch failures). Ready for implementation.

**Recommendations:**
1. Key Links section (line 52 in original) still references `--autopilot` instead of `<autopilot>true</autopilot>`. This is inconsistent with the rest of the spec. Minor -- the implementor can resolve from context, but cleaning it up would improve consistency.
2. The spec does not mention a `<fallback>` section for autopilot.md. Every existing command file (run.md, done.md, audit.md, review.md, fix.md, revise.md) includes a `<fallback>` section describing inline behavior when agent spawning fails. Consider adding a brief fallback note (e.g., "If Task agent fails for a phase, log the error, record spec as failed, and continue to next spec in batch mode or halt in single mode").

### Response v2 (2026-02-11)
**Applied:** All recommendations from Audit v2

**Changes:**
1. [✓] Key Links section consistency — Verified line 52 already reads `<autopilot>true</autopilot>` (auditor corrected during write-back). Already addressed.
2. [✓] Add fallback section — Added "Fallback Behavior" subsection after Step 9 in workflow, describing behavior when Task agent fails: log error, record spec as failed, continue in batch mode or halt in single mode, leave spec in current state.

### Audit v3 (2026-02-11)
**Status:** APPROVED

**Context Estimate:** ~25% total

**Execution Scope:**

| Metric | Est. Context | Target | Status |
|--------|--------------|--------|--------|
| Total spec context | ~25% | <=50% | OK |
| Largest task group (G1) | ~20% | <=30% | OK |
| Worker overhead | ~10% | <=10% | OK |

**Quality Projection:**

| Context Range | Expected Quality | Status |
|---------------|------------------|--------|
| 0-30% | PEAK | <-- Current estimate |
| 30-50% | GOOD | - |
| 50-70% | DEGRADING | - |
| 70%+ | POOR | - |

**Goal-Backward Validation:** All 7 observable truths have corresponding artifacts. All artifacts have purpose. Wiring is complete. 3 key links identified.

**Strategic fit:** Aligned with project goals -- directly reduces user friction and is a prerequisite for parallel spec execution (TODO-013).

**Project compliance:** No PROJECT.md exists; spec follows all observable codebase conventions (command file structure, model profile lookup, STATE.md rotation, agent spawning via Task tool).

**Assumptions Assessment:**

| # | Assumption | If wrong, impact |
|---|------------|------------------|
| A1 | Agents respect autopilot tag | Low -- mitigated by scope="all" bypassing interactive prompts |
| A2 | STATE.md Next Step field reliable | Low -- mitigated by reading spec frontmatter as canonical |
| A3 | Review History structure consistent | Low -- established pattern across all completed specs |
| A4 | Cycle limits of 3 appropriate | Low -- configurable via config.json |
| A5 | Done logic can be inlined | Low -- simple file operations |
| A6 | Sequential batch processing OK | Low -- intentional, parallel is separate TODO |

**Comment:** Comprehensive and well-structured specification. All issues from Audit v1 and recommendations from Audit v2 have been addressed. The spec now includes complete status handling (including needs_decomposition and paused), clear autopilot tag mechanism documentation, accurate context estimates, fallback behavior, and future considerations. The state machine logic in Step 5.3 covers all known spec statuses. Implementation Tasks are appropriately scoped with two independent groups in Wave 1. Ready for implementation.

---

## Execution Summary

**Executed:** 2026-02-11
**Mode:** orchestrated
**Commits:** 2

### Execution Waves

| Wave | Groups | Status |
|------|--------|--------|
| 1 | G1, G2 | complete |

### Files Created
- `commands/sf/autopilot.md` — Autopilot command with full lifecycle workflow (argument parsing, phase detection, agent spawning, cycle detection, halt logic, done logic, batch mode, summary report)

### Files Modified
- `commands/sf/help.md` — Added Autonomous Execution section, autopilot alternative in Typical Session, step 8 in Quick Start

### Acceptance Criteria Status
- [x] `commands/sf/autopilot.md` exists with valid command frontmatter (name, description, argument-hint, allowed-tools)
- [x] Command processes spec from "draft" to "done" (workflow Steps 5-7)
- [x] Halts when audit->revise cycles exceed MAX_AUDIT_CYCLES (Step 5.5)
- [x] Halts when review->fix cycles exceed MAX_FIX_CYCLES (Step 5.5)
- [x] `--all` processes all actionable specs in Queue order (Step 7)
- [x] Summary report displayed at end (Step 9)
- [x] AskUserQuestion NOT in allowed-tools
- [x] Same model profile lookup as existing commands (Step 6)
- [x] STATE.md updated correctly after each phase transition (Step 5.5)
- [x] `commands/sf/help.md` includes `/sf:autopilot` in Autonomous Execution section

### Deviations
None

---

## Completion

**Completed:** 2026-02-11
**Total Commits:** 2
**Audit Cycles:** 3
**Review Cycles:** 1

---

## Review History

### Review v1 (2026-02-11 15:30)
**Result:** APPROVED
**Reviewer:** impl-reviewer (subagent)

**Passed:**

- [✓] File existence verified — `/Users/koristuvac/Projects/specflow-cc/commands/sf/autopilot.md` exists (601 lines)
- [✓] File existence verified — `/Users/koristuvac/Projects/specflow-cc/commands/sf/help.md` modified correctly
- [✓] No files to delete — specification did not require any file deletions
- [✓] Frontmatter compliance — all required fields present (name, description, argument-hint, allowed-tools)
- [✓] AskUserQuestion excluded — not in allowed-tools list (per AC7)
- [✓] Command structure follows pattern — has purpose, context, workflow, fallback, success_criteria sections
- [✓] Argument parsing implemented — Step 2 handles (none), SPEC-XXX, and --all modes
- [✓] Configuration constants — Step 3 reads config.json with autopilot.max_audit_cycles and autopilot.max_fix_cycles
- [✓] Tracking state initialization — Step 4 defines all required variables
- [✓] Phase transition table complete — Step 5.3 covers all statuses including needs_decomposition and paused
- [✓] Review History inspection logic — Step 5.3 section 5.4 checks for APPROVED/CHANGES_REQUESTED
- [✓] Cycle detection — Step 5.5 increments counters and checks limits (AC3, AC4)
- [✓] Cycle counter reset logic — Step 5.5 point 5 resets on phase transitions
- [✓] STATE.md decision rotation — Step 5.5 point 2 implements >100 lines, >7 decisions rotation
- [✓] Agent spawning details — Step 6 defines all phases with correct subagent types
- [✓] Model profile lookup — Step 6.1 uses same pattern as other commands (grep config.json)
- [✓] Execution mode selection — Step 6.2 determines spec-executor vs orchestrator
- [✓] Agent prompts include autopilot tag — Step 6.3 shows `<autopilot>true</autopilot>` in all prompts
- [✓] Done phase inline logic — Step 5.6 implements archive, STATE.md update, commit (AC2)
- [✓] Batch mode implementation — Step 7 handles --all with queue advancement (AC5)
- [✓] Agent failure handling — Step 8 defines fallback behavior
- [✓] Summary report — Step 9 displays results table with audit/fix cycle counts (AC6)
- [✓] Fallback section present — describes agent failure handling
- [✓] Success criteria checklist — comprehensive and matches workflow steps
- [✓] Help.md updated — "Autonomous Execution" section added (AC10)
- [✓] Help.md Typical Session — "Autonomous Alternative" section added
- [✓] Help.md Quick Start — step 8 added for autopilot
- [✓] No agent files modified — constraint respected (verified via git diff)
- [✓] STATE.md format unchanged — constraint respected
- [✓] Code quality — clear, well-structured command file following established patterns
- [✓] Integration — matches style and structure of existing commands (run.md, done.md references verified)

**Summary:** Excellent implementation that fully satisfies all 10 acceptance criteria and respects all constraints. The autopilot command is comprehensive, well-documented, and follows established command patterns precisely. The implementation includes robust cycle detection, proper STATE.md rotation logic, complete phase transition handling including edge cases (needs_decomposition, paused), and graceful error handling for agent failures. The help.md integration is clean and consistent with existing sections. No critical, major, or minor issues identified.

---

## Next Step

`/sf:done` — finalize and archive
