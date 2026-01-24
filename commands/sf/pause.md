---
name: sf:pause
description: Save current work context for later resumption
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - AskUserQuestion
---

<purpose>
Save the current work context to enable seamless resumption later. Creates a pause file with active specification, progress, recent changes, and optional notes. Essential for context preservation across sessions.
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

## Step 2: Get Current State

Read `.specflow/STATE.md` and extract:
- Active Specification
- Status
- Next Step

**If no active specification:**
```
No active work to pause.

Current state: idle
```
But still allow pausing to capture general notes.

## Step 3: Load Active Specification Details

If active spec exists, read `.specflow/specs/SPEC-XXX.md`:
- Title
- Type
- Priority
- Complexity
- Acceptance Criteria (for progress tracking)

## Step 4: Capture Git State

```bash
# Get uncommitted changes
git status --porcelain 2>/dev/null

# Get recent commits related to spec (if any)
git log --oneline -5 2>/dev/null
```

Categorize changes:
- New files (A or ??)
- Modified files (M)
- Deleted files (D)

## Step 5: Estimate Progress

If acceptance criteria exist with checkboxes:
- Count total criteria
- Count checked criteria
- Calculate progress percentage

Also count:
- Files created
- Files modified
- Commits made (from Execution Summary if exists)

## Step 6: Check for Orchestrated Execution

```bash
ls .specflow/execution/SPEC-XXX-state.json 2>/dev/null
```

**If orchestrated execution in progress:**

This is a special case - we need to create `.continue-here` for seamless resumption.

1. Read current execution state
2. Identify current wave and group
3. Commit any pending work if possible

**Create `.specflow/.continue-here`:**
```json
{
  "type": "orchestrated",
  "spec_id": "SPEC-XXX",
  "state_file": ".specflow/execution/SPEC-XXX-state.json",
  "paused_at": {
    "wave": 2,
    "group": "G3",
    "status": "in_progress"
  },
  "commits_completed": ["abc123", "def456", "ghi789"],
  "timestamp": "2026-01-23T14:45:00Z"
}
```

**Attempt to commit pending work:**
```bash
git status --porcelain
```

If uncommitted changes exist:
```bash
git add -A
git commit -m "wip(sf-XXX): pause checkpoint at Wave {N}, Group {G}"
```

Store this commit hash in `.continue-here` as well.

**Skip to Step 9** with orchestrated-specific output.

## Step 6.5: Ask for Notes

Use AskUserQuestion:
- header: "Notes"
- question: "Add notes for next session? (Enter to skip)"
- options: (freeform text)

Notes help remember context that isn't captured in code.

## Step 7: Create Sessions Directory

```bash
mkdir -p .specflow/sessions
```

## Step 8: Generate Pause File

Create `.specflow/sessions/PAUSE-{YYYYMMDD}-{HHMMSS}.md`:

```markdown
# Session Pause — {YYYY-MM-DD HH:MM:SS}

## Context

- **Specification:** {SPEC-XXX} ({title}) | none
- **Status:** {status}
- **Workflow Position:** {description based on status}

## Specification Details

{If active spec:}
- **Type:** {feature|refactor|bugfix}
- **Priority:** {priority}
- **Complexity:** {complexity}

## Progress

- **Acceptance Criteria:** {checked}/{total} ({percentage}%)
- **Files Created:** {count}
- **Files Modified:** {count}
- **Commits:** {count}

## Recent Changes

{If uncommitted changes:}
```
+ {new file 1}
+ {new file 2}
M {modified file 1}
D {deleted file 1}
```

{If no uncommitted changes:}
No uncommitted changes.

## Notes

{User's notes or "No notes added."}

## Conversation Summary

{Brief summary of what was being worked on}
{Key decisions made}
{What needs to happen next}

---
*Paused at: {YYYY-MM-DD HH:MM:SS}*
```

## Step 9: Update STATE.md

Add reference to pause file:

Under Current Position, add:
```markdown
- **Last Pause:** PAUSE-{YYYYMMDD}-{HHMMSS}
```

## Step 10: Display Confirmation

**For single-mode execution:**

```
---------------------------------------------------------
 SESSION PAUSED
---------------------------------------------------------

**Saved:** PAUSE-{YYYYMMDD}-{HHMMSS}

---

## Context

- **Specification:** {SPEC-XXX} -- {title}
- **Status:** {status}
- **Progress:** {checked}/{total} criteria ({percentage}%)

## Recent Changes

{List of changed files}

{If notes provided:}
## Notes Saved

"{notes}"

---

**Session saved successfully.**

Resume with: `/sf:resume`
```

**For orchestrated execution:**

```
---------------------------------------------------------
 EXECUTION PAUSED
---------------------------------------------------------

Execution paused at Wave {N}, Group {G}.

**Progress saved to:** .specflow/.continue-here
**State file:** .specflow/execution/SPEC-XXX-state.json
**Commits completed:** {count}

---

## Execution Progress

- Wave 1: [checkmark] Complete (G1) - 2 commits
- Wave 2: [lightning] In Progress
  - G2: [checkmark] Complete - 1 commit
  - G3: [circle] Paused here
  - G4: [circle] Pending
- Wave 3: [circle] Pending (G5)

{If pending work was committed:}
## Checkpoint Commit

Created checkpoint commit: {hash}
Message: "wip(sf-XXX): pause checkpoint at Wave {N}, Group {G}"

---

**Execution state preserved.**

To resume: `/sf:resume`
```

</workflow>

<success_criteria>
- [ ] Initialization verified
- [ ] Current state captured from STATE.md
- [ ] Active spec details loaded (if any)
- [ ] Git state captured
- [ ] Progress estimated
- [ ] Orchestrated execution detected and handled specially
- [ ] .continue-here created for orchestrated execution
- [ ] Pending work committed if orchestrated (checkpoint commit)
- [ ] User notes captured (optional)
- [ ] Sessions directory created
- [ ] PAUSE-{timestamp}.md created with full context (single mode)
- [ ] STATE.md updated with pause reference
- [ ] Clear confirmation with resume instructions
</success_criteria>
