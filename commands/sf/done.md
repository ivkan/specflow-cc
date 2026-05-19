---
name: sf:done
description: Finalize specification, archive, and update state
# SPEC-011: Accepts optional SPEC-XXX as first positional arg; resolves via state resolve
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
  - AskUserQuestion
---

<purpose>
Finalize the completed specification. Archives the spec, updates STATE.md, extracts decisions, and prepares for the next task.
</purpose>

<context>
@.specflow/STATE.md
@.specflow/PROJECT.md
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

## Step 2: Resolve Active Specification

Call `node bin/sf-tools.cjs state resolve $ARGUMENTS` (pass the optional SPEC-XXX arg if provided).

Parse the JSON response:
- `{"action":"use","id":"SPEC-XXX"}` → proceed with SPEC-XXX
- `{"action":"error","code":"NO_ACTIVE_SPEC"}` → display error and exit:
  ```
  No active specification to finalize.

  Run `/sf:new "task description"` to create one.
  ```
- `{"action":"error","code":"SPEC_NOT_ACTIVE","id":"SPEC-XXX"}` → display error and exit:
  ```
  SPEC-XXX is not in the Active Specifications table.
  ```
- `{"action":"ask","options":[...]}` → use AskUserQuestion to show picker:
  ```
  Multiple active specifications. Which one to finalize?
  Options: {id — title (status)} for each entry
  ```

## Step 2.5: Handle `--apply=minor` Flag

**Check if `--apply=minor` was passed in the invocation arguments.**

**If `--apply=minor` is NOT present:** Continue to Step 3 (existing behavior unchanged).

**If `--apply=minor` IS present:**

### 2.5.a Verify Status Precondition

Confirm the resolved spec has `status == "review"` in its frontmatter.

If status is NOT `review`:
```
Error: --apply=minor requires status 'review' (current: {status})
```
Exit 1. No state mutation.

### 2.5.b Parse Severity Counts from Latest Review History

Read the spec file and find the most recent `### Review v[N]` entry in Review History.

Extract Critical, Major, and Minor counts from that entry.

Run:
```bash
node bin/sf-tools.cjs recommend --source review --critical N --major M --minor K
```

Parse the JSON response.

If `action != "done --apply=minor"`:
```
Error: --apply=minor cannot be used when Critical or Major findings exist (found {N} Critical, {M} Major). Run /sf:fix instead.
```
Exit 1. No state mutation.

### 2.5.c Apply Minor Fixes via `/sf:fix` Machinery

Parse the latest Review History entry and extract the numbered list of Minor findings (the sequential numbers as they appear in the Minor section, e.g. `"4,5,7"`).

Invoke existing `/sf:fix` machinery passing the numbered target list and `--internal` flag (so `/sf:fix` Step 8 does NOT mutate STATE.md — the caller owns the status transition):
```
/sf:fix SPEC-XXX "{N,M,K}" --internal
```

This reuses `/sf:fix`'s existing per-fix atomic commit behavior. Do NOT duplicate fix logic.

### 2.5.d Test Gate

Detect and run the project test command:

1. If `package.json` exists and has `scripts.test` → run `npm test`
2. Else if `test/` directory exists → run `node --test test/`
3. Else → note `No test command detected; proceeding without test gate.`

If test command exits non-zero:
- Print captured stdout+stderr
- Leave STATE.md status as `review` (no transition)
- Exit 1
- Note: Fix commits remain in git history; user can manually `git revert` or run full `/sf:fix` cycle.

### 2.5.e Lint Gate

Detect and run lint:

1. If `package.json` exists and has `scripts.lint` → run `npm run lint`
2. Else if `.eslintrc*` or `eslint.config.*` present → run `npx eslint .`
3. Else → skip silently

If lint exits non-zero:
- Same abort semantics as 2.5.d (print output, leave STATUS as `review`, exit 1)

### 2.5.f On Gate Success: Continue to Finalization

On all gates passing: continue into existing Step 3+ finalization path (update spec frontmatter status → "done", archive, generate L1 summary per SPEC-012).

All STATE.md mutations use Read+Write per SPEC-004 (not Bash/awk/sed).

---

## Step 3: Load Specification

Read the active spec file: `.specflow/specs/SPEC-XXX.md`

## Step 4: Check Review Status

**If status is "done" (already approved):**
Continue to finalization.

**If status is "review" but has APPROVED review:**
Continue to finalization.

**If status is NOT approved:**
Show warning:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 WARNING: Specification has not passed review
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Specification:** SPEC-XXX
**Current Status:** {status}

{If review exists with issues:}
### Outstanding Issues

From last review (v{N}):

1. {Critical issue}
2. {Major issue}

---

Proceeding without review approval may result in:
- Incomplete or buggy implementation in production
- Technical debt

Continue anyway?
```

Use AskUserQuestion with options:
- "Yes, finalize anyway" → continue, log warning
- "No, run review first" → exit with `/sf:review` suggestion

**If user proceeds anyway:**
Log in STATE.md Warnings table:
```
| {date} | SPEC-XXX | Finalized without review approval |
```

## Step 4.5: Check Verification Status

Check if Verification History section exists in spec.

**If no Verification History exists:**
Note it but continue (verification is optional):
```
Note: No human verification was performed.
Consider running `/sf:verify` for user acceptance testing.
```
Continue to Step 5.

**If Verification History exists:**
Parse the most recent verification entry (highest version number).

**If result is PASSED:**
Continue normally to Step 5.

**If result is PARTIAL:**
Show warning but allow proceed:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 NOTE: Verification Incomplete
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Specification:** SPEC-XXX
**Last Verification:** v{N} — PARTIAL

Some criteria were skipped during verification.

---
```
Continue to Step 5.

**If result is FAILED:**
Show warning and require confirmation:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 WARNING: Verification Failed
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Specification:** SPEC-XXX
**Last Verification:** v{N} — FAILED

### Failed Criteria

{List each failed criterion with notes}

---

Proceeding with failed verification may result in:
- Features that don't work as expected
- User-facing bugs

Continue anyway?
```

Use AskUserQuestion with options:
- "Yes, finalize anyway" → continue, log warning in STATE.md
- "No, fix first" → exit with `/sf:fix` or `/sf:verify` suggestion

**If user proceeds anyway:**
Log in STATE.md Warnings table:
```
| {date} | SPEC-XXX | Finalized with failed verification |
```

## Step 5: Create Archive Directory

```bash
mkdir -p .specflow/archive
```

## Step 6: Update Specification Status

Update frontmatter:
- status → "done"

Check if the spec frontmatter contains `delta: true`.

**If delta spec (`delta: true`):** Add the following completion summary section, which includes a "Changes Applied" subsection populated from the spec's `## Delta` section content:

```markdown
---

## Completion

**Completed:** {date} {time}
**Total Commits:** {count from Execution Summary}
**Review Cycles:** {count of Review v[N] entries}

### Outcome

{1-2 sentence summary of what was delivered}

### Key Files

- `{path}` — {what it does/why it matters}

### Changes Applied

**Added:**
- `path/to/new-file.md` — {brief description}

**Modified:**
- `path/to/existing-file.md` — {brief description of changes}

**Removed:**
- `path/to/obsolete-file.md` — {brief description}

{Omit any subsection (Added/Modified/Removed) if it has no entries.}

{If a /sf:review was performed before /sf:done, include this subsection noting differences between what the Delta section specified and what was actually implemented. If no deviations were found or no review was performed, omit this subsection entirely:}

### Deviations from Delta

- `path/to/file.md` — {description of how actual implementation differed from Delta entry}

### Patterns Established

{List any new patterns, conventions, or architectural decisions introduced.
If none: "None — followed existing patterns."}

### Spec Deviations

{Any deviations from the original spec during implementation (unrelated to delta changes).
If none: "None — implemented as specified."}
```

**If NOT a delta spec:** Add the standard completion summary section (no "Changes Applied" or "Deviations from Delta" subsections):

```markdown
---

## Completion

**Completed:** {date} {time}
**Total Commits:** {count from Execution Summary}
**Review Cycles:** {count of Review v[N] entries}

### Outcome

{1-2 sentence summary of what was delivered}

### Key Files

- `{path}` — {what it does/why it matters}

### Patterns Established

{List any new patterns, conventions, or architectural decisions introduced.
If none: "None — followed existing patterns."}

### Deviations

{Any deviations from the original spec during implementation.
If none: "None — implemented as specified."}
```

## Step 7: Extract Decisions

Scan specification and Completion section for important decisions:
- Technology choices mentioned in Context or Assumptions
- Patterns established during implementation
- Constraints discovered
- Deviations that became new conventions

If significant decisions found, add to STATE.md Decisions table:

```markdown
| {date} | SPEC-XXX | {decision description} |
```

## Step 7.5: Clean Up Source TODO (safety net)

Check if the spec frontmatter contains a `source:` field (e.g., `source: TODO-006`).

**If `source:` field exists:**

1. Check if `.specflow/todos/{source}.md` exists (per-file format):

```bash
[ -f .specflow/todos/{source}.md ] && echo "FOUND" || echo "NOT_FOUND"
```

2. **If FOUND:** Delete the file and reindex:

```bash
rm .specflow/todos/{source}.md
```

```bash
node ~/.claude/specflow-cc/bin/sf-tools.cjs todo reindex
```

3. **If NOT_FOUND (backward compatibility):** Also check legacy format — look in `.specflow/todos/TODO.md` for the referenced ID. If found there, remove the block using the Edit tool.

No "Last updated" lines to update in per-file format.

**If no `source:` field or TODO already removed:** Skip — no action needed.

## Step 8: Archive Specification

Move spec to archive:

```bash
mv .specflow/specs/SPEC-XXX.md .specflow/archive/
```

## Step 8.5: Generate L1 Summary

Generate a compact summary of the just-archived spec for agent consumption:

    node ~/.claude/specflow-cc/bin/sf-tools.cjs archive summarize SPEC-XXX

On success, `.specflow/archive/SPEC-XXX.summary.md` exists.

If the command fails (parser cannot extract required fields), log a warning to the completion summary but do NOT abort archival — the full spec is already archived and the summary can be regenerated later via `node ~/.claude/specflow-cc/bin/sf-tools.cjs archive backfill`.

## Step 9: Update STATE.md

### Remove from Active Specifications Table

```bash
node bin/sf-tools.cjs state remove-active SPEC-XXX
```

### Remove from Queue

Remove SPEC-XXX row from Queue table.

### Update Project Patterns (if applicable)

If implementation established new patterns, add to Project Patterns section.

### Check STATE.md Size and Rotate if Needed

After updating STATE.md, check if rotation is needed:

1. Use the Read tool to read `.specflow/STATE.md` and count total lines
2. If total lines <= 100, no action needed
3. If total lines > 100:
   a. Read the `## Decisions` section and extract all decision rows (lines matching `| YYYY-`)
   b. Count decision rows. If <= 7, no rotation needed
   c. If > 7 decisions:
      - Identify the 5 most recent decisions (last 5 rows) -- these STAY
      - Identify older decisions (all rows except last 5) -- these MOVE to archive
      - Read `.specflow/DECISIONS_ARCHIVE.md` (create with template if missing)
      - Write updated DECISIONS_ARCHIVE.md: insert old decisions after the table header row
      - Write updated STATE.md: replace Decisions section content with only the 5 most recent decisions

## Step 10: Create Final Commit (if needed)

Check for uncommitted changes:

```bash
git status --porcelain
```

If changes exist:

```bash
git add .specflow/
git commit -m "docs(sf): complete SPEC-XXX

- Archived specification
- Updated STATE.md
"
```

## Step 11: Display Completion Summary

**IMPORTANT:** Output the following directly as formatted text, NOT wrapped in a markdown code block:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 SPECIFICATION COMPLETED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Specification:** SPEC-XXX
**Title:** {title}
**Type:** {feature|refactor|bugfix}

### Summary

- **Files created:** {count}
- **Files modified:** {count}
- **Files deleted:** {count}
- **Commits:** {count}
- **Audit cycles:** {count}
- **Review cycles:** {count}

{If decisions extracted:}
### Decisions Recorded

• {decision 1}
• {decision 2}

---

📄 File: .specflow/archive/SPEC-XXX.md

---

## Next Step

{If queue has more specs:}
`/sf:next` — start next specification (SPEC-YYY)

{If queue is empty:}
Choose one:
• `/sf:new "task"` — create new specification
• `/sf:todos` — see pending ideas
```

</workflow>

<fallback>

## Inline Finalization

### Update Spec

Set frontmatter status to "done".
Add Completion section with timestamp.

### Archive

```bash
mkdir -p .specflow/archive
mv .specflow/specs/SPEC-XXX.md .specflow/archive/
```

### Update STATE.md

1. Set Active Specification to "none"
2. Set Status to "idle"
3. Set Next Step to "/sf:new or /sf:next"
4. Remove from Queue table
5. Add any extracted decisions

### Commit

```bash
git add .specflow/
git commit -m "docs(sf): complete SPEC-XXX"
```

</fallback>

<success_criteria>
- [ ] Active specification identified
- [ ] Review status checked (warning if not approved)
- [ ] Spec status updated to "done"
- [ ] Completion section added
- [ ] Decisions extracted (if any)
- [ ] Source TODO file deleted (if `source:` field exists in spec and file exists in todos/)
- [ ] Spec moved to archive
- [ ] L1 summary file created at .specflow/archive/SPEC-XXX.summary.md (or warning logged)
- [ ] STATE.md updated (cleared active, removed from queue)
- [ ] Final commit created
- [ ] Clear completion summary shown
- [ ] Next steps provided
</success_criteria>
