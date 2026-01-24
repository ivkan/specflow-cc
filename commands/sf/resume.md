---
name: sf:resume
description: Restore context from last pause and continue work
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - AskUserQuestion
---

<purpose>
Restore the work context from the last pause. Reads the pause file, displays full context summary, verifies current state matches, and provides clear next steps. Essential for seamless session continuity.
</purpose>

<context>
@.specflow/STATE.md
</context>

<workflow>

## Step 1: Verify Initialization

```bash
[ -d .specflow ] && echo "OK" || echo "NOT_INITIALIZED"
```

**If NOT_INITIALIZED:**
```
SpecFlow not initialized.

Run `/sf:init` to start.
```
Exit.

## Step 2: Check for Orchestrated Checkpoint

First, check for `.continue-here` file (orchestrated execution):

```bash
[ -f .specflow/.continue-here ] && echo "ORCHESTRATED" || echo "CHECK_SESSION"
```

**If ORCHESTRATED:**
Skip to Step 2.5 (Orchestrated Resume).

**If CHECK_SESSION:**
Continue to Step 2.1.

## Step 2.1: Find Latest Pause File (single mode)

```bash
ls -1 .specflow/sessions/PAUSE-*.md 2>/dev/null | sort -r | head -1
```

**If no pause files found:**
```
---------------------------------------------------------
 NO PAUSED SESSION
---------------------------------------------------------

No paused session found.

**Options:**
- `/sf:status` -- view current state
- `/sf:next` -- find next task to work on
- `/sf:list` -- see all specifications
```
Exit.

## Step 2.5: Orchestrated Resume (if .continue-here exists)

**Load checkpoint:**
Read `.specflow/.continue-here` JSON.

**Load full state:**
Read state file referenced in checkpoint.

**Verify commits exist:**

For each commit in `commits_completed`:
```bash
git log --oneline | grep {hash}
```

**Results:**
```
Verifying previous progress...

- Wave 1: [checkmark] 2 commits found (abc1234, def5678)
- Wave 2/G2: [checkmark] 1 commit found (ghi7890)
- Checkpoint: [checkmark] wip commit found (jkl0123)

All {N} commits verified.
```

**If any commit NOT found:**
```
WARNING: Some commits not found in git history

Missing commits:
- abc1234 (Wave 1/G1)

This may indicate:
- Git history was modified (rebase, reset)
- Commits were made in a different branch

Options:
1. "Re-run from Wave 1" -- restart affected waves
2. "Continue anyway" -- skip verification, proceed
3. "Abort" -- cancel resume
```

Use AskUserQuestion to let user decide.

**Display resume summary:**
```
---------------------------------------------------------
 RESUMING ORCHESTRATED EXECUTION
---------------------------------------------------------

Resuming SPEC-XXX execution...

**Verified:**
- Wave 1: [checkmark] 2 commits found
- Wave 2/G2: [checkmark] 1 commit found

**Continuing from:** Wave 2, Group G3

---
```

**Spawn fresh orchestrator agent:**

```
Task(prompt="
<specification>
@.specflow/specs/SPEC-XXX.md
</specification>

<project_context>
@.specflow/PROJECT.md
</project_context>

<execution_state>
@.specflow/execution/SPEC-XXX-state.json
</execution_state>

<execution_mode>resume</execution_mode>
<verified_commits>{list of verified commit hashes}</verified_commits>

Resume orchestrated execution from checkpoint.
Commits have been verified - skip verified groups.
Continue from Wave {N}, Group {G}.
", subagent_type="sf-spec-executor-orchestrator", description="Resume orchestrated execution")
```

**Clean up .continue-here:**
```bash
rm .specflow/.continue-here
```

Exit (orchestrator takes over).

## Step 3: Read Pause File

Parse the pause file and extract:
- Timestamp
- Specification ID and title
- Status at pause
- Progress (criteria checked/total)
- Recent changes list
- User notes
- Conversation summary

## Step 4: Calculate Time Since Pause

Calculate elapsed time:
- If < 1 hour: "X minutes ago"
- If < 24 hours: "X hours ago"
- If < 7 days: "X days ago"
- Otherwise: show date

## Step 5: Verify Current State

Read `.specflow/STATE.md` and compare:
- Active Specification: same or different?
- Status: same or different?

### If State Matches

Continue to Step 7.

### If State Changed

Display warning:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 STATE CHANGED SINCE PAUSE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Pause State:**
- Specification: {SPEC-XXX}
- Status: {status_at_pause}

**Current State:**
- Specification: {SPEC-YYY or same}
- Status: {current_status}

**Changes Detected:**
- {description of what changed}

---
```

Use AskUserQuestion:
- header: "State"
- question: "How should we proceed?"
- options:
  1. "Use current state (recommended)" — Accept changes, show current context
  2. "Restore pause state" — Revert STATE.md to pause state
  3. "View diff" — Show detailed differences

**If "Restore pause state":**
Update STATE.md to match pause state.

**If "View diff":**
Show detailed comparison and ask again.

## Step 6: Update STATE.md (if needed)

Ensure active specification and status match the resumed context.

## Step 7: Load Current Specification Details

If specification exists, read `.specflow/specs/SPEC-XXX.md`:
- Full acceptance criteria with current checkbox state
- Context and Task sections
- Any audit/review history

## Step 8: Check Current Git State

```bash
git status --porcelain 2>/dev/null
```

Compare with pause state changes to identify:
- Files still modified
- New changes since pause

## Step 9: Display Full Resume Context

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 SESSION RESUMED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Restoring:** PAUSE-{YYYYMMDD}-{HHMMSS} ({time_ago})

---

## Context

**Specification:** {SPEC-XXX} — {title}
**Status:** {status}
**Priority:** {priority} | **Complexity:** {complexity}

---

## Where You Left Off

{Conversation summary from pause file}

{If user notes exist:}
**Your Notes:**
> {notes}

---

## Progress

**Acceptance Criteria:** {checked}/{total} ({percentage}%)

| Status | Criterion |
|--------|-----------|
| [x] | {completed criterion 1} |
| [x] | {completed criterion 2} |
| [ ] | {pending criterion 3} |
| [ ] | {pending criterion 4} |

---

## Files in Progress

{If files tracked at pause:}
| File | Status at Pause | Current |
|------|-----------------|---------|
| src/auth/middleware.ts | Created | ✓ exists |
| src/types/auth.ts | Created | ✓ exists |
| src/utils/jwt.ts | Modified | ✓ modified |

{If new uncommitted changes since pause:}
**New Changes Since Pause:**
- {new file or modification}

---

## Recommended Action

Based on status `{status}`:

**Next Step:** `{recommended_command}` — {description}

{Context-specific guidance based on where they left off}
```

## Step 10: Provide Focus Hints

Based on notes and context:

```
---

## Focus Points

Based on your notes and progress:

1. {Key thing to focus on next}
2. {Related file or section}
3. {Pending acceptance criterion to complete}
```

## Step 11: Clean Up Old Pause Files (Optional)

If more than 5 pause files exist, suggest cleanup:

```
**Note:** {N} old pause files in sessions/. Run `/sf:history` to review or clean up.
```

</workflow>

<success_criteria>
- [ ] Initialization verified
- [ ] Orchestrated checkpoint (.continue-here) detected if present
- [ ] Commits verified before orchestrated resume
- [ ] Fresh orchestrator spawned for orchestrated resume
- [ ] .continue-here cleaned up after orchestrated resume
- [ ] Latest pause file found and read (single mode)
- [ ] Time since pause calculated
- [ ] Current state compared with pause state
- [ ] State conflict handled if detected
- [ ] Full context restored and displayed
- [ ] Acceptance criteria progress shown
- [ ] Files in progress tracked
- [ ] User notes displayed
- [ ] Clear recommended next action
- [ ] Focus hints provided
</success_criteria>
