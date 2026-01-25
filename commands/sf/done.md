---
name: sf:done
description: Finalize specification, archive, and update state
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
  - AskUserQuestion
---

<purpose>
Finalize the completed specification. Archives the spec, updates STATE.md, extracts decisions, and prepares for the next task.
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

Run `/sf:init` first.
```
Exit.

## Step 2: Get Active Specification

Read `.specflow/STATE.md` and extract Active Specification.

**If no active specification:**
```
No active specification to finalize.

Run `/sf:new "task description"` to create one.
```
Exit.

## Step 3: Load Specification

Read the active spec file: `.specflow/specs/SPEC-XXX.md`

## Step 4: Check Review Status

**If status is "done" (already approved):**
Continue to finalization.

**If status is "review" but has APPROVED review:**
Continue to finalization.

**If status is NOT approved:**
Show warning:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 WARNING: Specification has not passed review
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Specification:** SPEC-XXX
**Current Status:** {status}

{If review exists with issues:}
### Outstanding Issues

From last review (v{N}):

1. {Critical issue}
2. {Major issue}

---

Proceeding without review approval may result in:
- Incomplete or buggy implementation in production
- Technical debt

Continue anyway?
```

Use AskUserQuestion with options:
- "Yes, finalize anyway" → continue, log warning
- "No, run review first" → exit with `/sf:review` suggestion

**If user proceeds anyway:**
Log in STATE.md Warnings table:
```
| {date} | SPEC-XXX | Finalized without review approval |
```

## Step 4.5: Check Verification Status

Check if Verification History section exists in spec.

**If no Verification History exists:**
Note it but continue (verification is optional):
```
Note: No human verification was performed.
Consider running `/sf:verify` for user acceptance testing.
```
Continue to Step 5.

**If Verification History exists:**
Parse the most recent verification entry (highest version number).

**If result is PASSED:**
Continue normally to Step 5.

**If result is PARTIAL:**
Show warning but allow proceed:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 NOTE: Verification Incomplete
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Specification:** SPEC-XXX
**Last Verification:** v{N} — PARTIAL

Some criteria were skipped during verification.

---
```
Continue to Step 5.

**If result is FAILED:**
Show warning and require confirmation:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 WARNING: Verification Failed
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Specification:** SPEC-XXX
**Last Verification:** v{N} — FAILED

### Failed Criteria

{List each failed criterion with notes}

---

Proceeding with failed verification may result in:
- Features that don't work as expected
- User-facing bugs

Continue anyway?
```

Use AskUserQuestion with options:
- "Yes, finalize anyway" → continue, log warning in STATE.md
- "No, fix first" → exit with `/sf:fix` or `/sf:verify` suggestion

**If user proceeds anyway:**
Log in STATE.md Warnings table:
```
| {date} | SPEC-XXX | Finalized with failed verification |
```

## Step 5: Create Archive Directory

```bash
mkdir -p .specflow/archive
```

## Step 6: Update Specification Status

Update frontmatter:
- status → "done"

Add completion timestamp:

```markdown
---

## Completion

**Completed:** {date} {time}
**Total Commits:** {count from Execution Summary}
**Review Cycles:** {count of Review v[N] entries}
```

## Step 7: Extract Decisions

Scan specification for important decisions:
- Technology choices mentioned in Context or Assumptions
- Patterns established during implementation
- Constraints discovered

If significant decisions found, add to STATE.md Decisions table:

```markdown
| {date} | SPEC-XXX | {decision description} |
```

## Step 8: Archive Specification

Move spec to archive:

```bash
mv .specflow/specs/SPEC-XXX.md .specflow/archive/
```

## Step 9: Update STATE.md

### Clear Active Specification

- Active Specification → "none"
- Status → "idle"
- Next Step → "/sf:new or /sf:next"

### Remove from Queue

Remove SPEC-XXX row from Queue table.

### Update Project Patterns (if applicable)

If implementation established new patterns, add to Project Patterns section.

### Check STATE.md Size and Rotate if Needed

After updating STATE.md, check if rotation is needed:

```bash
LINE_COUNT=$(wc -l < .specflow/STATE.md)
if [ $LINE_COUNT -gt 100 ]; then
    echo "STATE.md exceeds 100 lines ($LINE_COUNT), rotating old decisions..."

    # Parse decisions table and extract all decisions
    DECISIONS=$(awk '/^## Decisions$/ { found=1; next } /^## / && found { exit } found { print }' .specflow/STATE.md | grep -E '^\| [0-9]{4}-' || true)
    DECISION_COUNT=$(echo "$DECISIONS" | grep -c '^|' || echo 0)

    if [ "$DECISION_COUNT" -gt 7 ]; then
        # Keep only 5 most recent decisions
        RECENT_DECISIONS=$(echo "$DECISIONS" | tail -5)
        OLD_DECISION_COUNT=$((DECISION_COUNT - 5))
        OLD_DECISIONS=$(echo "$DECISIONS" | head -n $OLD_DECISION_COUNT)

        # Create or append to archive
        if [ ! -f .specflow/DECISIONS_ARCHIVE.md ]; then
            cat > .specflow/DECISIONS_ARCHIVE.md << 'EOF'
# SpecFlow Decisions Archive

Historical decisions rotated from STATE.md to maintain compactness.

## Archived Decisions

| Date | Decision |
|------|----------|
EOF
        fi

        # Write old decisions to temp file for awk to read (awk -v cannot handle multiline strings)
        TEMP_OLD=$(mktemp)
        echo "$OLD_DECISIONS" > "$TEMP_OLD"

        # Append old decisions to archive (insert after table header)
        TEMP_ARCHIVE=$(mktemp)
        awk -v oldfile="$TEMP_OLD" '
            /^\| Date \| Decision \|$/ { print; getline; print; while ((getline line < oldfile) > 0) print line; close(oldfile); next }
            {print}
        ' .specflow/DECISIONS_ARCHIVE.md > "$TEMP_ARCHIVE"
        mv "$TEMP_ARCHIVE" .specflow/DECISIONS_ARCHIVE.md
        rm -f "$TEMP_OLD"

        # Write recent decisions to temp file for awk to read
        TEMP_RECENT=$(mktemp)
        echo "$RECENT_DECISIONS" > "$TEMP_RECENT"

        # Update STATE.md with only recent decisions
        TEMP_STATE=$(mktemp)
        awk -v recentfile="$TEMP_RECENT" '
            /^## Decisions$/ {
                print
                print ""
                print "| Date | Decision |"
                print "|------|----------|"
                while ((getline line < recentfile) > 0) print line
                close(recentfile)
                in_decisions=1
                next
            }
            /^## / && in_decisions { in_decisions=0 }
            !in_decisions || !/^\|/ { print }
        ' .specflow/STATE.md > "$TEMP_STATE"
        mv "$TEMP_STATE" .specflow/STATE.md
        rm -f "$TEMP_RECENT"

        echo "Rotated $(echo "$OLD_DECISIONS" | grep -c '^|') old decisions to DECISIONS_ARCHIVE.md"
    fi
fi
```

## Step 10: Create Final Commit (if needed)

Check for uncommitted changes:

```bash
git status --porcelain
```

If changes exist:

```bash
git add .specflow/
git commit -m "docs(sf): complete SPEC-XXX

- Archived specification
- Updated STATE.md
"
```

## Step 11: Display Completion Summary

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 SPECIFICATION COMPLETED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Specification:** SPEC-XXX
**Title:** {title}
**Type:** {feature|refactor|bugfix}

### Summary

- **Files created:** {count}
- **Files modified:** {count}
- **Files deleted:** {count}
- **Commits:** {count}
- **Audit cycles:** {count}
- **Review cycles:** {count}

### Archived To

`.specflow/archive/SPEC-XXX.md`

{If decisions extracted:}
### Decisions Recorded

- {decision 1}
- {decision 2}

---

## Queue Status

{If queue has more specs:}
**Next in queue:** SPEC-YYY — {title}

Run `/sf:next` to start the next specification.

{If queue is empty:}
Queue is empty.

Run `/sf:new "task"` to create a new specification
or `/sf:todos` to see pending ideas.
```

</workflow>

<fallback>

## Inline Finalization

### Update Spec

Set frontmatter status to "done".
Add Completion section with timestamp.

### Archive

```bash
mkdir -p .specflow/archive
mv .specflow/specs/SPEC-XXX.md .specflow/archive/
```

### Update STATE.md

1. Set Active Specification to "none"
2. Set Status to "idle"
3. Set Next Step to "/sf:new or /sf:next"
4. Remove from Queue table
5. Add any extracted decisions

### Commit

```bash
git add .specflow/
git commit -m "docs(sf): complete SPEC-XXX"
```

</fallback>

<success_criteria>
- [ ] Active specification identified
- [ ] Review status checked (warning if not approved)
- [ ] Spec status updated to "done"
- [ ] Completion section added
- [ ] Decisions extracted (if any)
- [ ] Spec moved to archive
- [ ] STATE.md updated (cleared active, removed from queue)
- [ ] Final commit created
- [ ] Clear completion summary shown
- [ ] Next steps provided
</success_criteria>
