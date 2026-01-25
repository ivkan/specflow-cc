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

Find the most recent "Audit v[N]" section in Audit History.

**If no audit exists:**
```
Specification SPEC-XXX has no audit history.

Run `/sf:audit` first to get feedback.
```
Exit.

## Step 5: Parse Arguments

| Argument | Action |
|----------|--------|
| (none) | Interactive mode — show comments, ask what to fix |
| "all" | Apply all critical issues AND recommendations |
| "1,2,3" | Apply only numbered items |
| "..." | Treat as custom revision instructions |

### If Interactive Mode (no arguments):

Display audit comments:

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

Append to Audit History:

```markdown
### Response v{N} ({date} {time})
**Applied:** {scope description}

**Changes:**
1. [✓/✗] {Item} — {what was done}
2. [✓/✗] {Item} — {what was done}
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
