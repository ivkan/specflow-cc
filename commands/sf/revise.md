---
name: sf:revise
description: Revise specification based on audit feedback
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
Revise the active specification based on audit feedback. Can apply all comments, specific numbered items, or custom changes described by user.
</purpose>

<context>
@.specflow/STATE.md
@.specflow/PROJECT.md
@~/.claude/specflow-cc/agents/spec-reviser.md
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
No active specification to revise.

Run `/sf:new "task description"` to create one.
```
Exit.

## Step 3: Load Specification

Read the active spec file: `.specflow/specs/SPEC-XXX.md`

**If status is not 'draft', 'auditing', or 'revision_requested':**
```
Specification SPEC-XXX cannot be revised (status: {status}).

Use `/sf:status` to see current state.
```
Exit.

## Step 4: Extract Latest Audit

Find the most recent audit section in Audit History. Can be:
- `### Audit v[N]` — internal audit
- `### External Audit v[N]` — imported external feedback

**If no audit exists:**
```
Specification SPEC-XXX has no audit history.

Run `/sf:audit` first to get feedback,
or `/sf:audit --import "feedback"` to import external review.
```
Exit.

**Determine audit type:**
```bash
LATEST_AUDIT=$(grep -E "^### (External )?Audit v[0-9]+" .specflow/specs/SPEC-XXX.md | tail -1)
if echo "$LATEST_AUDIT" | grep -q "External"; then
    AUDIT_TYPE="external"
else
    AUDIT_TYPE="internal"
fi
```

## Step 4.5: Pre-analyze External Feedback

**Only for external audits (AUDIT_TYPE="external"):**

Skip this step if:
- `--no-analysis` flag is present in arguments
- AUDIT_TYPE is "internal"

### Analysis Process

Read the specification and project context, then analyze each external feedback item:

For each item in the external audit:
1. Check if the issue actually exists in the current specification
2. Evaluate relevance to the specification's scope and goals
3. Consider project architecture and constraints
4. Determine recommendation: Apply / Discuss / Skip

### Display Analysis Results

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 ANALYSIS: EXTERNAL FEEDBACK — SPEC-XXX
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Based on specification context and project architecture:

| # | Item | Recommendation | Reason |
|---|------|----------------|--------|
| 1 | {issue description} | ✓ Apply | {why it's relevant} |
| 2 | {issue description} | ✓ Apply | {why it's relevant} |
| 3 | {issue description} | ? Discuss | {why clarification needed} |
| 4 | {issue description} | ✗ Skip | {why not applicable} |

**Summary:** {N} recommended, {M} need discussion, {K} likely irrelevant

---
```

### Recommendation Criteria

**✓ Apply** — recommend when:
- Issue clearly exists in the specification
- Fix aligns with specification goals
- Within scope of current work

**? Discuss** — recommend when:
- Issue may be valid but requires clarification
- Trade-offs need user decision
- Significant architectural change implied

**✗ Skip** — recommend when:
- Issue doesn't exist in current specification
- Clearly out of scope for this specification
- Based on incorrect assumptions about the project
- Would conflict with explicit requirements

Continue to Step 5 with analysis context available.

## Step 5: Parse Arguments

| Argument | Action |
|----------|--------|
| (none) | Interactive mode — show comments, ask what to fix |
| "all" | Apply all critical issues AND recommendations |
| "1,2,3" | Apply only numbered items |
| "--no-analysis" | Skip pre-analysis, go directly to review mode |
| "..." | Treat as custom revision instructions |

**Check for `--no-analysis` flag:**
```bash
if echo "$ARGS" | grep -q "\-\-no-analysis"; then
    SKIP_ANALYSIS=true
    # Remove flag from args for further processing
    ARGS=$(echo "$ARGS" | sed 's/--no-analysis//g' | xargs)
fi
```

### If Interactive Mode (no arguments):

Display audit comments with context about source:

**For internal audit:**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 REVISION: SPEC-XXX
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Last audit (v{N}) found:

**Critical:**
1. [Issue 1]
2. [Issue 2]

**Recommendations:**
3. [Recommendation 1]
4. [Recommendation 2]

---

What to fix?
```

Use AskUserQuestion with options:
- "Apply all feedback" → treat as "all"
- "Fix critical only (1, 2)" → treat as "1,2"
- "Custom selection" → ask for numbers or description

**For external audit (requires critical evaluation):**

**If pre-analysis was performed (Step 4.5):**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 REVIEW EXTERNAL FEEDBACK: SPEC-XXX
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

External Audit (v{N}) — with analysis:

| # | Item | Severity | Recommendation | Reason |
|---|------|----------|----------------|--------|
| 1 | {issue} | Critical | ✓ Apply | {reason} |
| 2 | {issue} | Critical | ✓ Apply | {reason} |
| 3 | {issue} | Major | ? Discuss | {reason} |
| 4 | {issue} | Major | ✗ Skip | {reason} |
| 5 | {issue} | Minor | ✓ Apply | {reason} |

**Analysis:** {N} recommended, {M} need discussion, {K} skip suggested

---

How to proceed?
```

Use AskUserQuestion with options:
- "Apply recommended" → apply items marked ✓ Apply (recommended)
- "Review each item" → interactive per-item evaluation
- "Apply all" → apply everything (ignore analysis)
- "Select specific" → ask for numbers

**If pre-analysis was skipped (`--no-analysis` or internal flow):**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 REVIEW EXTERNAL FEEDBACK: SPEC-XXX
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️  External feedback requires critical evaluation.
    Not all suggestions may be applicable or correct.

External Audit (v{N}) items:

**Critical:**
1. [Issue 1]
2. [Issue 2]

**Major:**
3. [Issue 3]
4. [Issue 4]

**Minor:**
5. [Issue 5]

---

How to proceed?
```

Use AskUserQuestion with options:
- "Review each item" → interactive per-item evaluation (recommended)
- "Apply all" → apply everything (use with caution)
- "Apply critical only" → treat as critical items
- "Select specific" → ask for numbers

**If "Review each item" selected:**

For each item, use AskUserQuestion:
```
Item {N}: {issue description}

Evaluate this feedback:
```

Options:
- "Apply" — implement this change
- "Skip" — not applicable, with reason
- "Discuss" — need clarification
- "Defer" — valid but out of scope

Record each decision in Response section.

## Step 6: Determine Model Profile

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

Use model for `spec-reviser` from selected profile (default: balanced = sonnet).

## Step 7: Spawn Reviser Agent

Launch the spec-reviser subagent:

```
Task(prompt="
<specification>
@.specflow/specs/SPEC-XXX.md
</specification>

<project_context>
@.specflow/PROJECT.md
</project_context>

<revision_scope>
{Parsed scope: "all", "1,2", or custom instructions}
</revision_scope>

Revise this specification following the spec-reviser agent instructions.
Apply the specified changes and record the revision response.
", subagent_type="sf-spec-reviser", model="{profile_model}", description="Revise specification")
```

## Step 8: Handle Agent Response

The agent will:
1. Parse the latest audit
2. Apply requested revisions
3. Record Response v[N] in Audit History
4. Update status to "auditing"
5. Update STATE.md

## Step 9: Display Result

**For internal audit:**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 REVISION COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Specification:** SPEC-XXX
**Audit:** v{N} → Response v{N}

### Changes Applied

1. [✓] {Change description}
2. [✓] {Change description}

{If any skipped:}
### Skipped

3. [✗] {Item} — {reason}

---

📄 File: .specflow/specs/SPEC-XXX.md

---

## Next Step

`/sf:audit` — re-audit revised specification

<sub>/clear recommended → auditor needs fresh context</sub>
```

**For external audit:**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 EXTERNAL FEEDBACK REVIEWED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Specification:** SPEC-XXX
**External Audit:** v{N} → Response v{N}

### Decisions Summary

| # | Item | Decision | Reason |
|---|------|----------|--------|
| 1 | {short description} | ✓ Applied | — |
| 2 | {short description} | ✗ Skipped | {reason} |
| 3 | {short description} | ⏸ Deferred | Out of scope |
| 4 | {short description} | ? Discuss | Needs clarification |

**Applied:** {count} | **Skipped:** {count} | **Deferred:** {count}

{If any items marked "Discuss":}
### Needs Discussion

Items {N, M} require clarification before deciding.

---

📄 File: .specflow/specs/SPEC-XXX.md

---

## Next Steps

{If items need discussion:}
`/sf:discuss SPEC-XXX` — clarify items {N, M}

{If all decided:}
`/sf:audit` — re-audit with applied changes

{If deferred items exist:}
<sub>Deferred items saved to `.specflow/todos/` for future consideration.</sub>
```

</workflow>

<fallback>

**If agent spawning fails**, execute inline:

## Inline Revision

### Parse Audit Comments

Extract issues from latest audit section.

### Apply Changes

For each item in scope:

1. Locate the relevant section
2. Make minimal, targeted changes
3. Track what was changed

### Record Response

Get response version:

```bash
RESPONSE_COUNT=$(grep -c "### Response v" .specflow/specs/SPEC-XXX.md 2>/dev/null || echo 0)
NEXT_VERSION=$((RESPONSE_COUNT + 1))
```

**For internal audit, append:**

```markdown
### Response v{N} ({date} {time})
**Applied:** {scope description}

**Changes:**
1. [✓/✗] {Item} — {what was done}
2. [✓/✗] {Item} — {what was done}
```

**For external audit, append:**

```markdown
### Response v{N} ({date} {time})
**Source:** External Audit v{M}
**Review Type:** {interactive | bulk}

**Decisions:**
| # | Item | Decision | Reason |
|---|------|----------|--------|
| 1 | {description} | Applied | — |
| 2 | {description} | Skipped | {reason} |
| 3 | {description} | Deferred | {reason} |

**Summary:** Applied {X}/{Y} items, Skipped {Z}, Deferred {W}
```

### Update Status

In spec frontmatter: `status: auditing`

In STATE.md:
- Status → "auditing"
- Next Step → "/sf:audit"

</fallback>

<success_criteria>
- [ ] Active specification identified
- [ ] Latest audit parsed
- [ ] Revision scope determined (all/specific/custom)
- [ ] Changes applied correctly
- [ ] Response recorded in Audit History
- [ ] Spec frontmatter status updated
- [ ] STATE.md updated
- [ ] Clear summary of changes shown
</success_criteria>
