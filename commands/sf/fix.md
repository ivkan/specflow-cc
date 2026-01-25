---
name: sf:fix
description: Fix implementation based on review feedback
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
  - Task
  - AskUserQuestion
---

<purpose>
Fix the implementation based on review feedback. Can apply all fixes, specific numbered items, or custom fixes described by user. Creates atomic commits for each fix.
</purpose>

<context>
@.specflow/STATE.md
@.specflow/PROJECT.md
@~/.claude/specflow-cc/agents/spec-executor.md
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
No active specification to fix.

Run `/sf:new "task description"` to create one.
```
Exit.

## Step 3: Load Specification

Read the active spec file: `.specflow/specs/SPEC-XXX.md`

**If status is not 'review':**
```
Specification SPEC-XXX is not in review status (status: {status}).

{If not yet run:}
Run `/sf:run` first to implement the specification.

{If already done:}
Specification already completed.
```
Exit.

## Step 4: Extract Latest Review

Find the most recent "Review v[N]" section in Review History.

**If no review exists:**
```
Specification SPEC-XXX has no review history.

Run `/sf:review` first to get feedback.
```
Exit.

## Step 5: Parse Arguments

| Argument | Action |
|----------|--------|
| (none) | Interactive mode — show issues, ask what to fix |
| "all" | Apply all critical AND major AND minor fixes |
| "1,2,3" | Apply only numbered items |
| "..." | Treat as custom fix instructions |

### If Interactive Mode (no arguments):

Display review findings:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 FIX: SPEC-XXX
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Last review (v{N}) found:

**Critical:**
1. {Issue} — `path/file.ts:line`

**Major:**
2. {Issue} — `path/file.ts:line`

**Minor:**
3. {Issue}

---

What to fix?
```

Use AskUserQuestion with options:
- "Fix all issues" → treat as "all"
- "Fix critical and major only (1, 2)" → treat as "1,2"
- "Custom selection" → ask for numbers or description

## Step 6: Apply Fixes

For each issue to fix:

### 6.1 Locate

Find the file and location mentioned.

### 6.2 Fix

Apply the fix following:
- The reviewer's suggestion
- Project patterns from PROJECT.md
- Specification requirements

### 6.3 Commit

Create atomic commit:

```bash
git add <files>
git commit -m "fix(sf-XXX): {brief description}

- Fixed: {issue description}
"
```

## Step 7: Record Fix Response

Append to Review History:

```markdown
### Fix Response v[N] ([date] [time])
**Applied:** {scope description}

**Fixes:**
1. [✓/✗] {Issue} — {what was done}
   - Commit: {hash}
2. [✓/✗] {Issue} — {what was done}
   - Commit: {hash}

{If any skipped:}
**Skipped:** {reason}
```

## Step 8: Update STATE.md

- Status → "review" (ready for re-review)
- Next Step → "/sf:review"

## Step 9: Display Result

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 FIXES APPLIED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Specification:** SPEC-XXX
**Review:** v{N} → Fix Response v{N}

### Fixes Applied

1. [✓] {Issue} — {what was done}
   - Commit: {hash}
2. [✓] {Issue} — {what was done}
   - Commit: {hash}

{If any skipped:}
### Skipped

3. [✗] {Issue} — {reason}

---

📄 File: .specflow/specs/SPEC-XXX.md

---

## Next Step

`/sf:review` — re-review to verify fixes

<sub>/clear recommended → reviewer needs fresh context</sub>
```

</workflow>

<fallback>

**If complex fixes needed**, spawn executor agent in fix mode.

First, determine model profile:

```bash
[ -f .specflow/config.json ] && cat .specflow/config.json | grep -o '"model_profile"[[:space:]]*:[[:space:]]*"[^"]*"' | cut -d'"' -f4 || echo "balanced"
```

**Profile Table:**

| Profile | spec-creator | spec-auditor | spec-splitter | discusser | spec-executor | spec-executor-orchestrator | spec-executor-worker | impl-reviewer | spec-reviser | researcher | codebase-scanner |
|---------|--------------|--------------|---------------|-----------|---------------|---------------------------|---------------------|---------------|--------------|------------|-----------------|
| quality | opus | opus | opus | opus | opus | opus | opus | sonnet | sonnet | sonnet | sonnet |
| balanced | opus | opus | opus | opus | sonnet | sonnet | sonnet | sonnet | sonnet | sonnet | sonnet |
| budget | sonnet | sonnet | sonnet | sonnet | sonnet | sonnet | sonnet | haiku | sonnet | haiku | haiku |

Use model for `spec-executor` from selected profile (default: balanced = sonnet).

```
Task(prompt="
<specification>
@.specflow/specs/SPEC-XXX.md
</specification>

<project_context>
@.specflow/PROJECT.md
</project_context>

<fix_scope>
{Parsed scope: "all", "1,2", or custom instructions}
</fix_scope>

<review_findings>
{Latest review findings from spec}
</review_findings>

Fix the implementation issues identified in the review.
Create atomic commits for each fix.
Record Fix Response in Review History.
", subagent_type="sf-spec-executor", model="{profile_model}", description="Fix implementation")
```

## Inline Fix (for simple fixes)

### Locate Issues

Parse review findings with file paths and line numbers.

### Apply Each Fix

1. Read the file
2. Make the correction
3. Verify fix works
4. Commit:
```bash
git add <file>
git commit -m "fix(sf-XXX): {description}"
```

### Record Response

Get fix response version:
```bash
FIX_COUNT=$(grep -c "### Fix Response v" .specflow/specs/SPEC-XXX.md 2>/dev/null || echo 0)
NEXT_VERSION=$((FIX_COUNT + 1))
```

Append to Review History.

### Update STATE.md

- Status → "review"
- Next Step → "/sf:review"

</fallback>

<success_criteria>
- [ ] Active specification identified
- [ ] Latest review parsed
- [ ] Fix scope determined (all/specific/custom)
- [ ] All requested fixes applied
- [ ] Atomic commits created for each fix
- [ ] Fix Response recorded in Review History
- [ ] STATE.md updated
- [ ] Clear summary of fixes shown
</success_criteria>
