---
name: sf:validate
description: Validate implementation against spec's validation checklist
argument-hint: [SPEC-XXX]
allowed-tools:
  - Read
  - Bash
  - Glob
  - Grep
  - Write
  - AskUserQuestion
---

<purpose>
Run the validation checklist from a specification after implementation. Executes automated checks (test commands, grep verifications) and prompts for manual checks. Reports pass/fail per item and overall validation status.
</purpose>

<context>
@.specflow/STATE.md
</context>

<workflow>

## Step 1: Verify Initialization

```bash
[ -d .specflow ] && echo "OK" || echo "NOT_INITIALIZED"
```

**If NOT_INITIALIZED:**
```
SpecFlow not initialized. Run `/sf:init` first.
```
Exit.

## Step 2: Resolve Specification

**If SPEC-XXX argument provided:** Use that spec.
**If no argument:** Use active spec from STATE.md.

Read the spec file from `.specflow/specs/SPEC-XXX.md`.

**If spec not found:** Check `.specflow/archive/SPEC-XXX.md`.

**If still not found:**
```
Specification {ID} not found.
```
Exit.

## Step 3: Extract Validation Checklist

Look for `## Validation Checklist` section in the spec.

**If section not found:**
```
No validation checklist found in {ID}.

The spec was created without a validation checklist.
You can:
1. Add one manually to the spec
2. Use `/sf:verify` for interactive human verification
3. Use `/sf:review` for AI-powered code review
```
Exit.

Parse checklist items. Each item should have:
- **Action:** What to do (command to run, endpoint to hit, UI to check)
- **Expected:** What should happen

## Step 4: Display Plan

**IMPORTANT:** Output the following directly as formatted text, NOT wrapped in a markdown code block:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 VALIDATION: {SPEC-XXX}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Spec:** {title}
**Checklist items:** {count}

Running validation...
```

## Step 5: Execute Checks

For each checklist item:

### 5.1 Automated Checks

If the item contains a runnable command (backtick-wrapped command, `npm test`, `curl`, etc.):
1. Execute the command
2. Check exit code and output against expected result
3. Record: PASS or FAIL with output

### 5.2 Code Verification Checks

If the item references code behavior (file exists, function exists, pattern present):
1. Use Glob/Grep/Read to verify
2. Record: PASS or FAIL

### 5.3 Manual Checks

If the item requires manual/visual verification (UI behavior, browser check):
1. Ask user via AskUserQuestion: "Did this pass? {item description}"
2. Record user's response

### 5.4 Track Results

For each item, record:
- Item description
- Type: automated / code / manual
- Result: PASS / FAIL / SKIP
- Details: output or user note

## Step 6: Display Results

**IMPORTANT:** Output the following directly as formatted text, NOT wrapped in a markdown code block:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 VALIDATION RESULTS: {SPEC-XXX}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

| # | Check | Type | Result |
|---|-------|------|--------|
| 1 | {description} | automated | PASS |
| 2 | {description} | code | PASS |
| 3 | {description} | manual | FAIL |

---

**Result:** {passed}/{total} checks passed

{If all passed:}
Validation PASSED. Ready for `/sf:done`.

{If any failed:}
Validation FAILED. Fix issues and re-run `/sf:validate`.
```

</workflow>

<success_criteria>
- [ ] Spec resolved (argument or active)
- [ ] Validation checklist extracted from spec
- [ ] Missing checklist handled gracefully
- [ ] Automated commands executed and verified
- [ ] Code checks performed via tools
- [ ] Manual checks prompted to user
- [ ] Clear pass/fail report displayed
- [ ] Guidance on next step provided
</success_criteria>
