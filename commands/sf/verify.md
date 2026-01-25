---
name: sf:verify
description: Interactive human verification of acceptance criteria
allowed-tools:
  - Read
  - Write
  - Bash
  - AskUserQuestion
---

<purpose>
Guide the user through interactive verification of each acceptance criterion in the active specification. Records pass/fail/skip status with optional notes, enabling human UAT (User Acceptance Testing) before finalizing.
</purpose>

<context>
@.specflow/STATE.md
@.specflow/specs/SPEC-XXX.md
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
No active specification to verify.

Run `/sf:new "task description"` to create one.
```
Exit.

## Step 3: Load Specification

Read the active spec file: `.specflow/specs/SPEC-XXX.md`

**If status is not 'running', 'review', or 'done':**
```
Specification SPEC-XXX is not ready for verification (status: {status}).

Verification should be run after implementation (/sf:run) or review (/sf:review).
```
Exit.

## Step 4: Extract Acceptance Criteria

Parse the "## Acceptance Criteria" section from the specification.

Handle both formats:
- **Numbered list:** `1. criterion text`
- **Checkbox format:** `- [ ] criterion text` or `- [x] criterion text`

Extract each criterion as:
```
{
  "number": 1,
  "text": "criterion text"
}
```

**If no acceptance criteria found:**
```
No acceptance criteria found in SPEC-XXX.

Ensure the specification has an "## Acceptance Criteria" section.
```
Exit.

## Step 5: Determine Verification Version

Check if Verification History section exists in spec:

**If exists:** Count existing verification entries (v1, v2, etc.) and set NEXT_VERSION = max + 1
**If not exists:** Set NEXT_VERSION = 1

## Step 6: Display Verification Start

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 HUMAN VERIFICATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Specification:** SPEC-XXX
**Verification:** v{NEXT_VERSION}
**Criteria Count:** {N}

This is interactive human verification.
For each criterion, test the feature and respond:
  y/yes  — Verified working
  n/no   — Failed verification
  skip/s — Not tested

---
```

## Step 7: Interactive Verification Loop

For each criterion (i = 1 to N):

### Display Criterion

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 CRITERION [{i}/{N}]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{criterion text}

---
```

### Prompt for Verification

Use AskUserQuestion:
- Question: "Did you verify this works? [y/n/skip]"
- Options: ["y", "n", "skip"]

### Handle Response

**If y/yes:**
- Record status: VERIFIED
- Record notes: (empty)

**If n/no:**
- Ask follow-up: "What went wrong? (optional, press Enter to skip)"
- Record status: FAILED
- Record notes: user's response (if provided)

**If skip/s:**
- Ask follow-up: "Why skipped? (optional, press Enter to skip)"
- Record status: SKIPPED
- Record notes: user's response (if provided)

### Continue to Next

Repeat for all criteria.

## Step 8: Calculate Summary

Count results:
- verified_count = count of VERIFIED
- failed_count = count of FAILED
- skipped_count = count of SKIPPED
- total = N

Determine overall result:
- **PASSED:** All criteria verified (failed_count = 0, skipped_count = 0)
- **PARTIAL:** Some verified, some skipped, none failed (failed_count = 0, skipped_count > 0)
- **FAILED:** Any criterion failed (failed_count > 0)

## Step 9: Record Verification in Specification

### Find or Create Verification History Section

**If section exists:** Append new verification entry after last entry
**If section does not exist:** Add after Review History section (or at end if no Review History)

### Format Verification Entry

```markdown
---

## Verification History

### Verification v{VERSION} ({date} {time})
**Verifier:** user
**Result:** {PASSED|PARTIAL|FAILED} ({verified_count}/{total} verified{, failed_count failed if > 0}{, skipped_count skipped if > 0})

| # | Criterion | Status | Notes |
|---|-----------|--------|-------|
| 1 | {criterion 1 text (truncated if long)} | {VERIFIED|FAILED|SKIPPED} | {notes or empty} |
| 2 | {criterion 2 text} | {status} | {notes} |
...
```

### Preserve Existing Content

DO NOT modify:
- Acceptance criteria text
- Audit History
- Review History
- Execution Summary
- Any other existing sections

## Step 10: Display Summary

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 VERIFICATION COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Specification:** SPEC-XXX
**Result:** {PASSED|PARTIAL|FAILED}

### Summary

| Status   | Count |
|----------|-------|
| VERIFIED | {verified_count} |
| FAILED   | {failed_count} |
| SKIPPED  | {skipped_count} |
| **Total**| {total} |

{If FAILED:}
### Failed Criteria

{For each failed criterion:}
- **#{number}:** {criterion text}
  {If notes:} Note: "{notes}"

{If SKIPPED:}
### Skipped Criteria

{For each skipped criterion:}
- **#{number}:** {criterion text}
  {If notes:} Note: "{notes}"

---

## Next Steps

{If PASSED:}
All criteria verified. Ready to finalize.
`/sf:done` — finalize and archive specification

{If PARTIAL:}
Verification incomplete. Consider testing skipped criteria.
- `/sf:verify` — run verification again for skipped items
- `/sf:done` — finalize anyway

{If FAILED:}
Some criteria failed verification. Consider fixing issues.
- `/sf:fix` — address implementation issues
- `/sf:verify` — run verification again after fixes
```

</workflow>

<fallback>

## Manual Verification Recording

If interactive prompts fail, record verification manually:

### Collect Results

Ask user to provide results for all criteria in one message:
```
List your verification results (one per line):
1. VERIFIED/FAILED/SKIPPED [optional note]
2. VERIFIED/FAILED/SKIPPED [optional note]
...
```

### Parse and Record

Parse user's response and append Verification History section as specified in Step 9.

</fallback>

<success_criteria>
- [ ] Active specification identified
- [ ] Acceptance criteria extracted (numbered or checkbox format)
- [ ] Each criterion presented interactively
- [ ] User responses recorded (y/n/skip)
- [ ] Optional notes collected for failed/skipped
- [ ] Verification History section added to spec
- [ ] Summary displayed with counts
- [ ] Multiple verification rounds supported (v1, v2, etc.)
- [ ] Existing spec content preserved
- [ ] Clear next steps provided
</success_criteria>
