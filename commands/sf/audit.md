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

## Step 4: Spawn Auditor Agent

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
", subagent_type="sf-spec-auditor", description="Audit specification")
```

## Step 5: Handle Agent Response

The agent will:
1. Evaluate 5 quality dimensions
2. Categorize issues (critical vs recommendations)
3. Append audit to spec's Audit History
4. Update STATE.md
5. Return structured result

## Step 6: Display Result

### If APPROVED (no recommendations):

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 AUDIT PASSED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Specification:** SPEC-XXX
**Status:** APPROVED

{Comment from auditor}

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

## Next Step

`/sf:revise` — address critical issues

Options:
- `/sf:revise all` — apply all feedback
- `/sf:revise 1,2` — fix specific issues
- `/sf:revise [instructions]` — custom changes
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
