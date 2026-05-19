---
name: sf:review
description: Review the implementation against specification
# SPEC-011: Accepts optional SPEC-XXX as first positional arg; resolves via state resolve
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

## Step 2: Resolve Active Specification

Call `node bin/sf-tools.cjs state resolve $ARGUMENTS` (pass the optional SPEC-XXX arg if provided).

Parse the JSON response:
- `{"action":"use","id":"SPEC-XXX"}` → proceed with SPEC-XXX
- `{"action":"error","code":"NO_ACTIVE_SPEC"}` → display error and exit:
  ```
  No active specification to review.

  Run `/sf:new "task description"` to create one.
  ```
- `{"action":"error","code":"SPEC_NOT_ACTIVE","id":"SPEC-XXX"}` → display error and exit:
  ```
  SPEC-XXX is not in the Active Specifications table.
  ```
- `{"action":"ask","options":[...]}` → use AskUserQuestion to show picker:
  ```
  Multiple active specifications. Which one to review?
  Options: {id — title (status)} for each entry
  ```

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

## Step 5: Determine Model Profile

Check `.specflow/config.json` for model profile setting:

```bash
[ -f .specflow/config.json ] && cat .specflow/config.json | grep -o '"model_profile"[[:space:]]*:[[:space:]]*"[^"]*"' | cut -d'"' -f4 || echo "balanced"
```

**Profile Table:**

| Profile | spec-creator | spec-auditor | spec-splitter | discusser | spec-executor | spec-executor-orchestrator | spec-executor-worker | impl-reviewer | spec-reviser | researcher | codebase-scanner |
|---------|--------------|--------------|---------------|-----------|---------------|---------------------------|---------------------|---------------|--------------|------------|-----------------|
| max | opus | opus | opus | opus | opus | opus | opus | opus | opus | opus | opus |
| quality | opus | opus | opus | opus | opus | opus | opus | sonnet | sonnet | sonnet | sonnet |
| balanced | opus | opus | opus | opus | sonnet | sonnet | sonnet | sonnet | sonnet | sonnet | sonnet |
| budget | sonnet | sonnet | sonnet | sonnet | sonnet | sonnet | sonnet | haiku | sonnet | haiku | haiku |

Use model for `impl-reviewer` from selected profile (default: balanced = sonnet).

## Step 6: Spawn Reviewer Agent

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
", subagent_type="sf-impl-reviewer", model="{profile_model}", description="Review implementation")
```

## Step 7: Handle Agent Response

The agent will:
1. Verify all files created/deleted
2. Check acceptance criteria
3. Review code quality
4. Categorize findings
5. Append Review v[N] to spec
6. Update STATE.md

## Step 7.5: Check STATE.md Size and Rotate if Needed

After the agent updates STATE.md, check if rotation is needed:

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

## Step 8: Display Result

**IMPORTANT:** Output the following directly as formatted text, NOT wrapped in a markdown code block:

### If APPROVED (no minor issues):

The `Recommendation:` line is emitted by the reviewer agent (Step 7.5 in `agents/impl-reviewer.md`) using `node bin/sf-tools.cjs recommend --source review --critical 0 --major 0 --minor 0`. The STATE.md Next Step remains `/sf:done` (canonical).

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

📄 File: .specflow/specs/SPEC-XXX.md

---

## Next Step

**Recommendation:** done — implementation is clean, ready to finalize

`/sf:done` — finalize and archive specification
```

### If APPROVED (with minor suggestions):

The `Recommendation:` line uses action `done --apply=minor` when only Minor findings exist. STATE.md Next Step stays `/sf:done` (canonical; the `--apply=minor` suffix is advisory here only).

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

📄 File: .specflow/specs/SPEC-XXX.md

---

## Next Step

**Recommendation:** done --apply=minor — {N} minor finding(s), apply inline before finalize

Choose one:
• `/sf:done` — finalize and archive as-is
• `/sf:done --apply=minor` — apply minor fixes inline and finalize in one step
• `/sf:fix` — apply minor suggestions first ({N} items) then finalize
```

### If CHANGES_REQUESTED:

The `Recommendation:` line uses action `fix` when Critical or Major findings exist (STATE.md Next Step is `/sf:fix`).

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

📄 File: .specflow/specs/SPEC-XXX.md

---

## Next Step

**Recommendation:** fix — {N} critical/major finding(s) block finalize

`/sf:fix` — address the issues

Options:
• `/sf:fix all` — apply all fixes
• `/sf:fix 1,2` — fix specific issues
• `/sf:fix [instructions]` — custom fixes
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

```bash
# If APPROVED:
node bin/sf-tools.cjs state add-active SPEC-XXX done /sf:done
# If CHANGES_REQUESTED:
node bin/sf-tools.cjs state add-active SPEC-XXX review /sf:fix
```

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
