---
name: sf:audit
description: Audit the active specification in a fresh context
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
  - Task
---

<purpose>
Audit the active specification using a fresh context subagent. The auditor evaluates clarity, completeness, testability, scope, and feasibility without bias from the creation process.
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

**If status is not 'draft' or 'revision_requested':**
```
Specification SPEC-XXX is already audited (status: {status}).

Use `/sf:run` to implement or `/sf:status` to see current state.
```
Exit.

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
    DECISIONS=$(awk '/^## Decisions$/,/^## / {print}' .specflow/STATE.md | grep -E '^\| [0-9]{4}-' || true)
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

        # Append old decisions to archive (insert after table header)
        TEMP_ARCHIVE=$(mktemp)
        awk -v old="$OLD_DECISIONS" '
            /^\| Date \| Decision \|$/ { print; getline; print; print old; next }
            {print}
        ' .specflow/DECISIONS_ARCHIVE.md > "$TEMP_ARCHIVE"
        mv "$TEMP_ARCHIVE" .specflow/DECISIONS_ARCHIVE.md

        # Update STATE.md with only recent decisions
        TEMP_STATE=$(mktemp)
        awk -v recent="$RECENT_DECISIONS" '
            /^## Decisions$/ {
                print
                print ""
                print "| Date | Decision |"
                print "|------|----------|"
                print recent
                in_decisions=1
                next
            }
            /^## / && in_decisions { in_decisions=0 }
            !in_decisions || !/^\|/ { print }
        ' .specflow/STATE.md > "$TEMP_STATE"
        mv "$TEMP_STATE" .specflow/STATE.md

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
