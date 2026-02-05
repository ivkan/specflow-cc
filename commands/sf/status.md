---
name: sf:status
description: Show current SpecFlow state and recommended next step
allowed-tools:
  - Read
  - Bash
  - Glob
---

<purpose>
Display the current SpecFlow state including active specification, queue, and recommended next action. Provides situational awareness for continuing work.
</purpose>

<context>
@.specflow/STATE.md
@.specflow/PROJECT.md
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

## Step 2: Load State

Read `.specflow/STATE.md` and extract:
- Active Specification
- Status
- Next Step
- Queue
- Recent Decisions
- Warnings

## Step 3: Load Project Info

Read `.specflow/PROJECT.md` and extract:
- Project name
- Tech stack summary

## Step 4: Count Statistics

```bash
# Total specs
TOTAL=$(ls .specflow/specs/SPEC-*.md 2>/dev/null | wc -l)

# Completed specs
DONE=$(ls .specflow/archive/SPEC-*.md 2>/dev/null | wc -l)

# Pending todos
TODOS=$(ls .specflow/todos/*.md 2>/dev/null | wc -l)
```

## Step 4.5: Validate State Consistency

Check for mismatches between STATE.md and actual files:

```bash
# Check for orphan specs (exist in specs/ but STATE.md says "None")
ORPHAN_SPECS=$(ls .specflow/specs/SPEC-*.md 2>/dev/null | head -1)

# Check for duplicate IDs (same spec in both specs/ and archive/)
for f in .specflow/specs/SPEC-*.md; do
  [ -f "$f" ] || continue
  ID=$(basename "$f")
  [ -f ".specflow/archive/$ID" ] && echo "DUPLICATE: $ID"
done
```

**If STATE.md shows "Active Specification: None" but specs exist in specs/:**
Add warning:
```
STATE MISMATCH: Found {N} spec(s) in specs/ but STATE.md shows no active spec.
Likely cause: STATE.md was not updated after spec creation.
Run: Read the spec file and manually update STATE.md, or delete orphan spec if duplicate.
```

**If duplicate IDs found:**
Add warning:
```
DUPLICATE ID: {SPEC-XXX} exists in both specs/ and archive/.
Likely cause: Spec numbering bug - archive was not checked when generating ID.
Fix: Rename the spec in specs/ to next available ID.
```

## Step 5: Determine Next Action

Based on current status:

| Status | Next Action |
|--------|-------------|
| idle | `/sf:new "task"` — create specification |
| drafting | `/sf:audit` — audit specification |
| revision_requested | `/sf:revise` — fix issues |
| external_review | `/sf:revise` — review external feedback |
| audited | `/sf:run` — implement |
| running | Continue implementation or `/sf:review` |
| reviewing | `/sf:fix` or `/sf:done` |

## Step 6: Display Status

**IMPORTANT:** Output the following directly as formatted text, NOT wrapped in a markdown code block:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 SPECFLOW STATUS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Project:** [name]
**Progress:** [████████░░] {done}/{total} specs complete

---

## Current Position

**Active:** {SPEC-XXX: Title | none}
**Status:** {status}

{If active spec exists:}
**Type:** {feature | refactor | bugfix}
**Complexity:** {small | medium | large}
**Priority:** {high | medium | low}

---

## Queue

| # | ID | Title | Priority | Status |
|---|----|-------|----------|--------|
{Queue from STATE.md}

{If queue empty:}
No specifications in queue.

---

{If recent decisions exist:}
## Recent Decisions

| Spec | Decision |
|------|----------|
{Last 3-5 decisions}

---

{If warnings exist:}
## Warnings

{List warnings}

---

## Next Step

`{recommended command}` — {description}

{Additional context-specific suggestions}
```

## Step 7: Context-Specific Suggestions

Based on state, provide additional guidance:

**If idle for long time:**
```
**Tip:** Have ideas? Use `/sf:todo "idea"` to capture for later.
```

**If spec is large:**
```
**Tip:** Consider `/sf:split SPEC-XXX` to break into smaller specs.
```

**If multiple specs in queue:**
```
**Tip:** Use `/sf:next` to work on highest priority item.
```

**If warnings present:**
```
**Note:** {N} warnings recorded. Review before continuing.
```

</workflow>

<success_criteria>
- [ ] Initialization verified
- [ ] STATE.md loaded
- [ ] PROJECT.md info extracted
- [ ] Statistics calculated
- [ ] Current position displayed
- [ ] Queue shown
- [ ] Recommended next step clear
- [ ] Context-specific tips provided
</success_criteria>
