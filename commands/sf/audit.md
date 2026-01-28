---
name: sf:audit
description: Audit the active specification in a fresh context
argument-hint: "[SPEC-XXX] [--import \"feedback\"]"
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
Audit the active specification using a fresh context subagent. The auditor evaluates clarity, completeness, testability, scope, and feasibility without bias from the creation process.

Also supports importing external feedback (from code reviews, security audits, team discussions) for critical evaluation and selective application.
</purpose>

<context>
@.specflow/STATE.md
@.specflow/PROJECT.md
@~/.claude/specflow-cc/agents/spec-auditor.md
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
No active specification to audit.

Run `/sf:new "task description"` to create one.
```
Exit.

## Step 3: Load Specification

Read the active spec file: `.specflow/specs/SPEC-XXX.md`

**If status is not 'draft', 'auditing', or 'revision_requested':**
```
Specification SPEC-XXX is already audited (status: {status}).

Use `/sf:run` to implement or `/sf:status` to see current state.
```
Exit.

## Step 3.5: Check for --import Flag

Parse arguments for `--import "feedback text"` pattern.

**If --import flag present:** Go to Step 4-IMPORT
**Otherwise:** Continue to Step 4 (internal audit)

---

## Step 4-IMPORT: Import External Feedback

### 4.1 Parse External Feedback

Extract the feedback text from the `--import` argument.

**Expected formats in feedback:**
- `[Critical]` or `[CRITICAL]` — blocking issues
- `[Major]` or `[Recommend]` — should fix
- `[Minor]` or `[Optional]` — nice to have
- Numbered lists (1. 2. 3.)
- Bullet points (- or *)

If no severity markers found, treat all items as `[Major]`.

### 4.2 Structure the Feedback

Parse items into structured format:

```
Critical Issues:
1. {item}
2. {item}

Major Issues:
3. {item}
4. {item}

Minor Issues:
5. {item}
```

### 4.3 Get Next Audit Version

```bash
AUDIT_COUNT=$(grep -c "### Audit v" .specflow/specs/SPEC-XXX.md 2>/dev/null || echo 0)
EXTERNAL_COUNT=$(grep -c "### External Audit" .specflow/specs/SPEC-XXX.md 2>/dev/null || echo 0)
NEXT_VERSION=$((AUDIT_COUNT + EXTERNAL_COUNT + 1))
```

### 4.4 Append to Audit History

Append to the spec's `## Audit History` section:

```markdown
### External Audit v{N} ({date} {time})
**Source:** External review
**Status:** PENDING_REVIEW

**Critical Issues:**
1. {parsed critical item}
2. {parsed critical item}

**Major Issues:**
3. {parsed major item}

**Minor Issues:**
4. {parsed minor item}

---
*Imported feedback requires review before application.*
*Use `/sf:revise` to critically evaluate and selectively apply.*
```

### 4.5 Update Spec Status

In spec frontmatter, set: `status: revision_requested`

### 4.6 Update STATE.md

Update STATE.md:
- Status → "external_review"
- Next Step → "/sf:revise"
- Add decision: "Imported external feedback for SPEC-XXX"

### 4.7 Display Import Result

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 EXTERNAL FEEDBACK IMPORTED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Specification:** SPEC-XXX
**Source:** External review

### Imported Items

**Critical:** {count} items
**Major:** {count} items
**Minor:** {count} items

### Preview

{Show first 2-3 items as preview}

---

📄 File: .specflow/specs/SPEC-XXX.md

---

## Next Step

`/sf:revise` — critically review and selectively apply

Options:
• `/sf:revise` — interactive review (recommended)
• `/sf:revise all` — apply all items
• `/sf:revise 1,2,5` — apply specific items
• `/sf:discuss SPEC-XXX` — discuss items before deciding

<sub>External feedback should be critically evaluated, not blindly applied.</sub>
```

Exit.

---

## Step 4: Determine Model Profile

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

Use model for `spec-auditor` from selected profile (default: balanced = opus).

## Step 5: Spawn Auditor Agent

Launch the spec-auditor subagent with fresh context:

```
Task(prompt="
<specification>
@.specflow/specs/SPEC-XXX.md
</specification>

<project_context>
@.specflow/PROJECT.md
</project_context>

Audit this specification following the spec-auditor agent instructions.
Do NOT read any conversation history — audit with fresh eyes.
", subagent_type="sf-spec-auditor", model="{profile_model}", description="Audit specification")
```

## Step 6: Handle Agent Response

The agent will:
1. Evaluate 5 quality dimensions
2. Categorize issues (critical vs recommendations)
3. Append audit to spec's Audit History
4. Update STATE.md
5. Return structured result

## Step 6.5: Check STATE.md Size and Rotate if Needed

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

## Step 7: Display Result

### If APPROVED (no recommendations):

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 AUDIT PASSED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Specification:** SPEC-XXX
**Status:** APPROVED

{Comment from auditor}

---

📄 File: .specflow/specs/SPEC-XXX.md

---

## Next Step

`/sf:run` — implement specification
```

### If APPROVED (with optional recommendations):

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 AUDIT PASSED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Specification:** SPEC-XXX
**Status:** APPROVED

### Recommendations (Optional)

1. [Recommendation 1]
2. [Recommendation 2]

---

📄 File: .specflow/specs/SPEC-XXX.md

---

## Next Steps

Choose one:
• `/sf:run` — implement specification as-is
• `/sf:revise` — apply optional recommendations first ({N} items)
```

### If NEEDS_REVISION:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 AUDIT: NEEDS REVISION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Specification:** SPEC-XXX
**Status:** NEEDS_REVISION

### Critical Issues

1. [Issue 1]
2. [Issue 2]

### Recommendations

3. [Recommendation 1]

---

📄 File: .specflow/specs/SPEC-XXX.md

---

## Next Step

`/sf:revise` — address critical issues

Options:
- `/sf:revise all` — apply all feedback
- `/sf:revise 1,2` — fix specific issues
- `/sf:revise [instructions]` — custom changes

<sub>Optional: `/sf:discuss SPEC-XXX` — clarify requirements before revising</sub>
```

</workflow>

<fallback>

**If agent spawning fails**, execute inline:

## Inline Audit

### Check Quality Dimensions

Read spec and evaluate:

**Clarity:**
- [ ] Title clearly describes task
- [ ] Context explains why
- [ ] No vague terms

**Completeness:**
- [ ] All files listed
- [ ] Interfaces defined (if needed)
- [ ] Deletions specified (if refactor)

**Testability:**
- [ ] Each criterion measurable
- [ ] Concrete success conditions

**Scope:**
- [ ] Clear boundaries
- [ ] No scope creep

**Feasibility:**
- [ ] Technically sound
- [ ] Reasonable assumptions

### Record Audit

Get audit version number:

```bash
AUDIT_COUNT=$(grep -c "### Audit v" .specflow/specs/SPEC-XXX.md 2>/dev/null || echo 0)
NEXT_VERSION=$((AUDIT_COUNT + 1))
```

Append to spec's Audit History:

```markdown
### Audit v{N} ({date} {time})
**Status:** [APPROVED | NEEDS_REVISION]

{Issues and recommendations}
```

### Update STATE.md

- If APPROVED: Status → "audited", Next Step → "/sf:run"
- If NEEDS_REVISION: Status → "revision_requested", Next Step → "/sf:revise"

</fallback>

<success_criteria>
- [ ] Active specification identified
- [ ] Fresh context audit performed
- [ ] All 5 dimensions evaluated
- [ ] Issues categorized
- [ ] Audit recorded in spec's Audit History
- [ ] STATE.md updated
- [ ] Clear next step provided
</success_criteria>
