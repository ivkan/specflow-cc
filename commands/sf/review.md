---
name: sf:review
description: Review the implementation against specification
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
  - Task
---

<purpose>
Review the implementation of the active specification in a fresh context. The reviewer evaluates code quality, specification compliance, security, and completeness without bias from the implementation process.
</purpose>

<context>
@.specflow/STATE.md
@.specflow/PROJECT.md
@~/.claude/specflow-cc/agents/impl-reviewer.md
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
No active specification to review.

Run `/sf:new "task description"` to create one.
```
Exit.

## Step 3: Load Specification

Read the active spec file: `.specflow/specs/SPEC-XXX.md`

**If status is not 'running' or 'review':**
```
Specification SPEC-XXX is not ready for review (status: {status}).

{If status is draft/auditing/revision_requested:}
Run `/sf:run` first to implement the specification.

{If status is done:}
Specification already completed. Use `/sf:history` to view archived specs.
```
Exit.

## Step 4: Verify Implementation Exists

Check that Execution Summary exists in spec:

**If no Execution Summary:**
```
No implementation found for SPEC-XXX.

Run `/sf:run` to execute the specification first.
```
Exit.

## Step 5: Determine Model Profile

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

Use model for `impl-reviewer` from selected profile (default: balanced = sonnet).

## Step 6: Spawn Reviewer Agent

Launch the impl-reviewer subagent with fresh context:

```
Task(prompt="
<specification>
@.specflow/specs/SPEC-XXX.md
</specification>

<project_context>
@.specflow/PROJECT.md
</project_context>

Review this implementation following the impl-reviewer agent instructions.
Evaluate compliance, quality, security, and completeness.
Do NOT read any conversation history — review with fresh eyes.
", subagent_type="sf-impl-reviewer", model="{profile_model}", description="Review implementation")
```

## Step 7: Handle Agent Response

The agent will:
1. Verify all files created/deleted
2. Check acceptance criteria
3. Review code quality
4. Categorize findings
5. Append Review v[N] to spec
6. Update STATE.md

## Step 7.5: Check STATE.md Size and Rotate if Needed

After the agent updates STATE.md, check if rotation is needed:

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

## Step 8: Display Result

### If APPROVED (no minor issues):

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 REVIEW PASSED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Specification:** SPEC-XXX
**Result:** APPROVED

### Summary

{Brief assessment from reviewer}

### Verified

- [✓] All acceptance criteria met
- [✓] All files created
- [✓] All deletions performed
- [✓] Code quality acceptable

---

📄 File: .specflow/specs/SPEC-XXX.md

---

## Next Step

`/sf:done` — finalize and archive specification
```

### If APPROVED (with minor suggestions):

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 REVIEW PASSED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Specification:** SPEC-XXX
**Result:** APPROVED

### Verified

- [✓] All acceptance criteria met
- [✓] All files created
- [✓] All deletions performed
- [✓] Code quality acceptable

### Minor Suggestions (Optional)

1. {Suggestion 1}
2. {Suggestion 2}

---

📄 File: .specflow/specs/SPEC-XXX.md

---

## Next Steps

Choose one:
• `/sf:done` — finalize and archive as-is
• `/sf:fix` — apply minor suggestions first ({N} items)
```

### If CHANGES_REQUESTED:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 REVIEW: CHANGES REQUESTED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Specification:** SPEC-XXX
**Result:** CHANGES_REQUESTED

### Critical Issues

1. **{Title}**
   - File: `{path}:{line}`
   - Issue: {description}
   - Fix: {suggestion}

### Major Issues

2. **{Title}**
   - File: `{path}:{line}`
   - Issue: {description}

### Minor Issues

3. {description}

### Passed

- [✓] {What's working}

---

📄 File: .specflow/specs/SPEC-XXX.md

---

## Next Step

`/sf:fix` — address the issues

Options:
- `/sf:fix all` — apply all fixes
- `/sf:fix 1,2` — fix specific issues
- `/sf:fix [instructions]` — custom fixes
```

</workflow>

<fallback>

**If agent spawning fails**, execute inline:

## Inline Review

### Load Requirements

From specification:
- List of acceptance criteria
- Files to create
- Files to delete
- Interfaces defined

### Verify Files

Check created files exist:
```bash
[ -f "path/to/file" ] && echo "EXISTS" || echo "MISSING"
```

Check deleted files removed:
```bash
[ ! -f "path/to/old" ] && echo "DELETED" || echo "STILL_EXISTS"
```

### Check Acceptance Criteria

For each criterion, verify:
- Feature works as specified
- Edge cases handled
- Constraints respected

### Code Quality Review

For each file, check:
- Clean, readable code
- No obvious bugs
- Proper error handling
- Follows project patterns

### Determine Result

- APPROVED: No critical/major issues
- CHANGES_REQUESTED: Has critical or major issues

### Record Review

Get review version:
```bash
REVIEW_COUNT=$(grep -c "### Review v" .specflow/specs/SPEC-XXX.md 2>/dev/null || echo 0)
NEXT_VERSION=$((REVIEW_COUNT + 1))
```

Append Review History to spec.

### Update STATE.md

- If APPROVED: Status → "done", Next Step → "/sf:done"
- If CHANGES_REQUESTED: Status → "review", Next Step → "/sf:fix"

</fallback>

<success_criteria>
- [ ] Active specification identified
- [ ] Implementation exists (Execution Summary present)
- [ ] Fresh context review performed
- [ ] All acceptance criteria checked
- [ ] File operations verified
- [ ] Code quality evaluated
- [ ] Findings categorized
- [ ] Review recorded in spec
- [ ] STATE.md updated
- [ ] Clear next step provided
</success_criteria>
