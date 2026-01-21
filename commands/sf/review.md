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

## Step 5: Spawn Reviewer Agent

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
", subagent_type="sf-impl-reviewer", description="Review implementation")
```

## Step 6: Handle Agent Response

The agent will:
1. Verify all files created/deleted
2. Check acceptance criteria
3. Review code quality
4. Categorize findings
5. Append Review v[N] to spec
6. Update STATE.md

## Step 7: Display Result

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
